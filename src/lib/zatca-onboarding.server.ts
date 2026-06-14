// Sprint F-2 — ZATCA onboarding (CSR + CSID compliance request) (server-only).
//
// Flow:
//   1) prepareDevice() — generates secp256k1 key pair, encrypts private
//      key, builds CSR PEM, stores both, sets onboarding_status to
//      "ready_for_otp". No network call. Idempotent (re-running rotates
//      key + CSR — only allowed before CSID is obtained).
//   2) requestComplianceCsid({ otp }) — calls the sandbox compliance
//      endpoint with the CSR + OTP. On success, stores the CSID token,
//      CSID secret, request id, and sets onboarding_status to
//      "onboarded".  On failure, records last_error and leaves status
//      unchanged. OTP is consumed immediately; never persisted.
//
// SECURITY: server-only. The CSR is the only thing that leaves the
// server. The OTP is forwarded straight to ZATCA in the same call and
// then discarded.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCsrPem,
  decryptSecret,
  encryptSecret,
  generateDeviceKeyPair,
  loadDeviceKeysRow,
} from "./zatca-crypto.server";
import { zatcaLog } from "./zatca.server";


export interface PrepareDeviceResult {
  ok: true;
  hasKey: true;
  hasCsr: true;
  csrLength: number;
}

async function loadSettings() {
  const { data: rs } = await supabaseAdmin
    .from("restaurant_settings")
    .select("vat_number, legal_name_ar, brand_name_ar")
    .eq("id", true)
    .maybeSingle();
  const { data: zs } = await supabaseAdmin
    .from("zatca_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return { rs: rs as any, zs: zs as any };
}

export async function prepareDevice(): Promise<PrepareDeviceResult> {
  const { rs, zs } = await loadSettings();
  if (!rs?.vat_number || !/^\d{15}$/.test(String(rs.vat_number))) {
    throw new Error("VAT number is missing or not 15 digits. Update restaurant settings first.");
  }
  const existing = await loadDeviceKeysRow();
  if (existing?.compliance_csid_token_encrypted) {
    throw new Error("Device is already onboarded. Reset CSID before regenerating the key pair.");
  }

  const kp = generateDeviceKeyPair();
  const enc = await encryptSecret(kp.privateKeyHex);

  const csrPem = buildCsrPem({
    commonName: zs?.csr_common_name ?? "JAAD CLOUD POS 01",
    serialNumber: zs?.csr_serial_number ?? "1-YC|2-POS|3-01",
    organizationUnit: zs?.csr_organization_unit ?? "JAAD CLOUD Branch",
    organizationName: zs?.csr_organization_name ?? rs?.legal_name_ar ?? "JAAD CLOUD",
    country: zs?.csr_country ?? "SA",
    vatNumber: rs.vat_number,
    invoiceType: zs?.csr_invoice_type ?? "0100",
    locationAddress: zs?.csr_location_address ?? "Makkah",
    businessCategory: zs?.csr_business_category ?? "Restaurant",
    environment: (zs?.environment as "simulation" | "production") ?? "simulation",
    publicKeyHex: kp.publicKeyHex,
    privateKeyHex: kp.privateKeyHex,
  });

  await supabaseAdmin
    .from("zatca_device_keys")
    .update({
      private_key_encrypted: enc.ciphertext,
      private_key_iv: enc.iv,
      public_key_pem: kp.publicKeyHex, // hex form is fine for sandbox
      csr_pem: csrPem,
    })
    .eq("id", true);

  await supabaseAdmin
    .from("zatca_settings")
    .update({
      onboarding_status: "ready_for_otp",
      last_error: null,
      notes: "CSR ready; awaiting OTP",
    })
    .eq("id", true);

  await zatcaLog({
    event: "csr.prepared",
    detail: { csrLength: csrPem.length },
  });

  return { ok: true, hasKey: true, hasCsr: true, csrLength: csrPem.length };
}

export interface ComplianceResult {
  ok: boolean;
  status: number;
  requestId?: string;
  error?: string;
}

/**
 * Calls the ZATCA sandbox compliance CSID endpoint with the stored CSR + OTP.
 *
 * NOTE: The exact endpoint path and response shape are determined by the
 * sandbox environment. We POST to `${sandbox_base_url}/compliance` with the
 * documented headers and accept the response body shape used by the
 * developer portal:
 *   { binarySecurityToken, secret, requestID }
 */
export async function requestComplianceCsid(otp: string): Promise<ComplianceResult> {
  const { zs } = await loadSettings();
  const row = await loadDeviceKeysRow();
  if (!row?.csr_pem || !row?.private_key_encrypted) {
    return { ok: false, status: 0, error: "CSR not prepared. Run prepareDevice first." };
  }

  const csrB64 = Buffer.from(row.csr_pem).toString("base64");
  const env = ((zs?.environment as string) === "production" ? "production" : "simulation") as
    | "simulation"
    | "production";
  const { zatcaEndpoints } = await import("./zatca-endpoints.server");
  const endpoint = zatcaEndpoints(env).complianceCsid;

  // Guard: never POST to a URL that is not the compliance endpoint.
  if (!endpoint.endsWith("/compliance")) {
    const msg = `Refusing to call ZATCA: built URL does not end with /compliance (env=${env}, url=${endpoint})`;
    await supabaseAdmin
      .from("zatca_settings")
      .update({ last_error: msg, onboarding_status: "ready_for_otp" })
      .eq("id", true);
    await zatcaLog({ level: "error", event: "csid.bad_url_guard", detail: { env, endpoint } });
    return { ok: false, status: 0, error: msg };
  }

  await zatcaLog({ event: "csid.request", detail: { env, endpoint } });

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Version": "V2",
        "OTP": otp,
      },
      body: JSON.stringify({ csr: csrB64 }),
    });
  } catch (e: any) {
    await zatcaLog({ level: "error", event: "csid.network_error", detail: { message: String(e?.message ?? e) } });
    return { ok: false, status: 0, error: `Network error contacting ZATCA: ${e?.message ?? e}` };
  }

  const status = res.status;
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = { raw: await res.text().catch(() => "") };
  }

  if (!res.ok) {
    await supabaseAdmin
      .from("zatca_settings")
      .update({
        last_error: `CSID HTTP ${status} from ${endpoint} :: ${JSON.stringify(body).slice(0, 300)}`,
      })
      .eq("id", true);
    await zatcaLog({ level: "error", event: "csid.http_error", detail: { status, endpoint, body } });
    return { ok: false, status, error: `ZATCA returned ${status} from ${endpoint}` };
  }

  const token = body?.binarySecurityToken ?? body?.token ?? null;
  const secret = body?.secret ?? null;
  const requestId = body?.requestID ?? body?.requestId ?? null;
  if (!token || !secret) {
    await zatcaLog({ level: "error", event: "csid.missing_fields", detail: { keys: Object.keys(body ?? {}) } });
    return { ok: false, status, error: "ZATCA response missing token/secret." };
  }

  const encToken = await encryptSecret(String(token));
  const encSecret = await encryptSecret(String(secret));

  await supabaseAdmin
    .from("zatca_device_keys")
    .update({
      compliance_csid_token_encrypted: encToken.ciphertext,
      compliance_csid_iv: encToken.iv,
      compliance_csid_secret_encrypted: encSecret.ciphertext,
      compliance_csid_secret_iv: encSecret.iv,
      compliance_request_id: requestId ? String(requestId) : null,
      csid_issued_at: new Date().toISOString(),
    })
    .eq("id", true);

  await supabaseAdmin
    .from("zatca_settings")
    .update({
      onboarding_status: "onboarded",
      compliance_csid_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", true);

  await zatcaLog({ event: "csid.obtained", detail: { requestId } });
  return { ok: true, status, requestId: requestId ? String(requestId) : undefined };
}

// ---------------------------------------------------------------------------
// Production CSID issuance (simulation track).
//
// Calls POST {root}/production/csids with Basic auth = compliance CSID token
// + compliance CSID secret, and body { compliance_request_id }. On success,
// stores the production CSID token + secret (encrypted) and the production
// request id. Does NOT touch zatca_invoices, PIH, ICV, or signing service.
// No new OTP is required — the compliance CSID authorizes this call.
// ---------------------------------------------------------------------------

export interface ProductionCsidResult {
  ok: boolean;
  status: number;
  productionRequestId?: string;
  tokenPrefix?: string;
  tokenLength?: number;
  secretPresent?: boolean;
  fieldsUpdated?: string[];
  error?: string;
  endpoint?: string;
}

export async function requestProductionCsid(): Promise<ProductionCsidResult> {
  const { zs } = await loadSettings();
  const row = await loadDeviceKeysRow();

  if (!row?.compliance_csid_token_encrypted || !row?.compliance_csid_secret_encrypted) {
    return { ok: false, status: 0, error: "Compliance CSID not found. Cannot issue production CSID." };
  }
  if (!row?.compliance_request_id) {
    return { ok: false, status: 0, error: "compliance_request_id missing on zatca_device_keys." };
  }

  // Decrypt compliance creds (used for Basic auth, never logged in cleartext).
  let complianceToken: string;
  let complianceSecret: string;
  try {
    complianceToken = await decryptSecret(row.compliance_csid_token_encrypted, row.compliance_csid_iv);
    complianceSecret = await decryptSecret(row.compliance_csid_secret_encrypted, row.compliance_csid_secret_iv);
  } catch (e: any) {
    await zatcaLog({ level: "error", event: "prod_csid.decrypt_failed", detail: { message: String(e?.message ?? e) } });
    return { ok: false, status: 0, error: "Failed to decrypt compliance CSID." };
  }

  const env = ((zs?.environment as string) === "production" ? "production" : "simulation") as
    | "simulation"
    | "production";
  const { zatcaEndpoints } = await import("./zatca-endpoints.server");
  const endpoint = zatcaEndpoints(env).productionCsids;

  // Safety guard: must end with /production/csids
  if (!endpoint.endsWith("/production/csids")) {
    const msg = `Refusing to call ZATCA: built URL does not end with /production/csids (env=${env}, url=${endpoint})`;
    await zatcaLog({ level: "error", event: "prod_csid.bad_url_guard", detail: { env, endpoint } });
    return { ok: false, status: 0, error: msg, endpoint };
  }

  await zatcaLog({ event: "prod_csid.request", detail: { env, endpoint, compliance_request_id: row.compliance_request_id } });

  const basic = Buffer.from(`${complianceToken}:${complianceSecret}`).toString("base64");

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Version": "V2",
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({ compliance_request_id: String(row.compliance_request_id) }),
    });
  } catch (e: any) {
    await zatcaLog({ level: "error", event: "prod_csid.network_error", detail: { message: String(e?.message ?? e) } });
    return { ok: false, status: 0, error: `Network error contacting ZATCA: ${e?.message ?? e}`, endpoint };
  }

  const status = res.status;
  let body: any = null;
  try { body = await res.json(); } catch { body = { raw: await res.text().catch(() => "") }; }

  if (!res.ok) {
    await supabaseAdmin
      .from("zatca_settings")
      .update({
        last_error: `Prod CSID HTTP ${status} from ${endpoint} :: ${JSON.stringify(body).slice(0, 300)}`,
      })
      .eq("id", true);
    await zatcaLog({ level: "error", event: "prod_csid.http_error", detail: { status, endpoint, body } });
    return { ok: false, status, error: `ZATCA returned ${status}`, endpoint };
  }

  const token = body?.binarySecurityToken ?? body?.token ?? null;
  const secret = body?.secret ?? null;
  const requestId = body?.requestID ?? body?.requestId ?? null;
  const disposition = body?.dispositionMessage ?? null;

  if (!token || !secret) {
    await zatcaLog({ level: "error", event: "prod_csid.missing_fields", detail: { keys: Object.keys(body ?? {}), disposition } });
    return { ok: false, status, error: "ZATCA response missing token/secret.", endpoint };
  }

  const encToken = await encryptSecret(String(token));
  const encSecret = await encryptSecret(String(secret));

  const updateFields = {
    production_csid_token_encrypted: encToken.ciphertext,
    production_csid_iv: encToken.iv,
    production_csid_secret_encrypted: encSecret.ciphertext,
    production_csid_secret_iv: encSecret.iv,
  } as const;

  const { error: updErr } = await supabaseAdmin
    .from("zatca_device_keys")
    .update(updateFields)
    .eq("id", true);
  if (updErr) {
    await zatcaLog({ level: "error", event: "prod_csid.db_update_failed", detail: { message: updErr.message } });
    return { ok: false, status, error: `DB update failed: ${updErr.message}`, endpoint };
  }

  // Store production_request_id in zatca_settings.notes-adjacent field;
  // we keep compliance_request_id in zatca_device_keys.compliance_request_id
  // and record prod request id + timestamp in zatca_settings.
  await supabaseAdmin
    .from("zatca_settings")
    .update({
      production_csid_at: new Date().toISOString(),
      csid_reference: requestId ? String(requestId) : null,
      last_error: null,
    })
    .eq("id", true);

  await zatcaLog({
    event: "prod_csid.obtained",
    detail: { requestId, disposition, tokenLength: String(token).length },
  });

  const tokenStr = String(token);
  return {
    ok: true,
    status,
    productionRequestId: requestId ? String(requestId) : undefined,
    tokenPrefix: tokenStr.slice(0, 16),
    tokenLength: tokenStr.length,
    secretPresent: true,
    fieldsUpdated: [
      "zatca_device_keys.production_csid_token_encrypted",
      "zatca_device_keys.production_csid_iv",
      "zatca_device_keys.production_csid_secret_encrypted",
      "zatca_device_keys.production_csid_secret_iv",
      "zatca_settings.production_csid_at",
      "zatca_settings.csid_reference",
    ],
    endpoint,
  };
}
