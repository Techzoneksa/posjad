// ZATCA queue submitter (server-only).
//
// Submits already-generated invoices to ZATCA. No re-signing, no XML
// mutation. Runs a local validation pass first; on failure, marks the
// invoice as `local_validation_failed` and never touches the network.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getDecryptedComplianceCsid,
  loadDeviceKeysRow,
} from "./zatca-crypto.server";
import { advancePih } from "./zatca-signing.server";
import { zatcaLog } from "./zatca.server";
import { zatcaEndpoints, type ZatcaEnv } from "./zatca-endpoints.server";
import { validateInvoiceLocal, type LocalValidationIssue } from "./zatca-xml.server";
import { validatePhase2FromSignedXml } from "./zatca-phase2.server";

interface SettingsRow {
  environment: "simulation" | "production";
  sandbox_base_url: string;
  production_base_url: string;
  onboarding_status: string;
}

async function loadEnv(): Promise<SettingsRow> {
  const { data } = await supabaseAdmin
    .from("zatca_settings")
    .select("environment, sandbox_base_url, production_base_url, onboarding_status")
    .eq("id", true)
    .maybeSingle();
  return data as any;
}

async function basicAuthHeader(): Promise<string> {
  const cs = await getDecryptedComplianceCsid();
  if (!cs) throw new Error("Device not onboarded (no CSID).");
  return "Basic " + Buffer.from(`${cs.token}:${cs.secret}`).toString("base64");
}

interface SubmitResult {
  ok: boolean;
  status: number;
  body: any;
}

export const ZATCA_NETWORK_SUBMISSION_DISABLED = true;

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function extractZatcaDiagnostics(result: SubmitResult) {
  const body = result.body ?? null;
  const validationResults = body?.validationResults ?? {};
  const errors = asArray(validationResults.errorMessages ?? body?.errorMessages ?? body?.errors);
  const warnings = asArray(validationResults.warningMessages ?? body?.warningMessages ?? body?.warnings);
  const firstIssue = errors[0] ?? warnings[0] ?? null;
  const responseCode = String(
    body?.reportingStatus ??
    body?.clearanceStatus ??
    body?.status ??
    body?.code ??
    firstIssue?.code ??
    (result.status ? `HTTP_${result.status}` : "EXCEPTION"),
  );
  const responseMessage = String(
    body?.message ??
    body?.error ??
    firstIssue?.message ??
    (result.status ? `HTTP ${result.status}` : "Request failed before reaching ZATCA"),
  );
  const shortMessage = `HTTP ${result.status}${responseCode ? ` — ${responseCode}` : ""}${responseMessage ? `: ${responseMessage}` : ""}`.slice(0, 900);

  return {
    zatca_http_status: result.status || null,
    zatca_response_code: responseCode,
    zatca_response_message: responseMessage,
    zatca_validation_errors: errors.length ? errors : null,
    zatca_warnings: warnings.length ? warnings : null,
    zatca_raw_response: body,
    last_error_message: result.status === 0 ? responseMessage : shortMessage,
    last_error_at: new Date().toISOString(),
    shortMessage,
    errors,
    warnings,
  };
}

async function postReporting(endpoint: string, signedXmlB64: string, invoiceHashB64: string, uuid: string): Promise<SubmitResult> {
  let auth: string;
  try {
    auth = await basicAuthHeader();
  } catch (e: any) {
    return { ok: false, status: 0, body: { error: e.message } };
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Version": "V2",
        "Accept-Language": "en",
        // Simplified tax invoices are reported (no clearance).
        "Clearance-Status": "0",
        Authorization: auth,
      },
      body: JSON.stringify({
        invoiceHash: invoiceHashB64,
        uuid,
        invoice: signedXmlB64,
      }),
    });
    let body: any;
    try { body = await res.json(); } catch { body = { raw: await res.text().catch(() => "") }; }
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return { ok: false, status: 0, body: { error: String(e?.message ?? e) } };
  }
}

export interface ProcessQueueSummary {
  processed: number;
  synced: number;
  failed: number;
  skipped: number;
  reason?: string;
}

function decodeStoredXml(row: any): string | null {
  if (!row?.signed_xml_b64) return null;
  try {
    return Buffer.from(String(row.signed_xml_b64), "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function processQueue(opts: { maxItems?: number; invoiceId?: string; allowNetworkSubmit?: boolean } = {}): Promise<ProcessQueueSummary> {
  const manualSingleSubmit = ZATCA_NETWORK_SUBMISSION_DISABLED && opts.allowNetworkSubmit === true && !!opts.invoiceId;
  if (ZATCA_NETWORK_SUBMISSION_DISABLED && !manualSingleSubmit) {
    await zatcaLog({
      event: "queue.network_frozen",
      detail: { invoiceId: opts.invoiceId ?? null, allowNetworkSubmit: opts.allowNetworkSubmit === true },
    });
    return { processed: 0, synced: 0, failed: 0, skipped: 0, reason: "network_submission_frozen" };
  }

  const env = await loadEnv();
  if (!env) return { processed: 0, synced: 0, failed: 0, skipped: 0, reason: "no_settings" };
  if (env.onboarding_status !== "onboarded") {
    return { processed: 0, synced: 0, failed: 0, skipped: 0, reason: "not_onboarded" };
  }
  const zEnv: ZatcaEnv = env.environment === "production" ? "production" : "simulation";
  const eps = zatcaEndpoints(zEnv);
  const dev = await loadDeviceKeysRow();
  const hasProdCsid = !!dev?.production_csid_token_encrypted;
  const endpoint = hasProdCsid ? eps.reportingSingle : eps.complianceInvoices;
  await zatcaLog({ event: "queue.endpoint.selected", detail: { endpoint, hasProdCsid, env: zEnv } });

  const limit = Math.min(opts.maxItems ?? 25, 100);

  let invoiceQuery = supabaseAdmin
    .from("zatca_invoices")
    .select("*")
    .eq("status", "pending_sync")
    .order("created_at", { ascending: true })
    .limit(opts.invoiceId ? 1 : limit);
  if (opts.invoiceId) invoiceQuery = invoiceQuery.eq("id", opts.invoiceId);
  const { data: invRows } = await invoiceQuery;

  const { data: cnRows } = opts.invoiceId ? { data: [] as any[] } : await supabaseAdmin
    .from("zatca_credit_notes")
    .select("*")
    .eq("status", "pending_sync")
    .order("created_at", { ascending: true })
    .limit(limit);

  let synced = 0;
  let failed = 0;
  let processed = 0;

  for (const row of invRows ?? []) {
    processed++;
    const xml = decodeStoredXml(row);
    if (!xml || !row.invoice_hash_b64 || !row.zatca_uuid) {
      const issues: LocalValidationIssue[] = [{ code: "MISSING_GENERATION", message: "Invoice has no signed XML / hash / UUID. Regenerate before sending." }];
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: "local_validation_failed",
          local_validation_errors: issues as any,
          last_error_message: issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      await zatcaLog({ level: "error", event: "queue.invoice.missing_generation", refType: "zatca_invoices", refId: row.id });
      continue;
    }

    // 1. Local validation gate.
    const issues = validateInvoiceLocal({
      xml,
      invoiceHashB64: row.invoice_hash_b64,
      uuid: row.zatca_uuid,
      icv: Number(row.icv ?? 0),
      pihB64: row.previous_invoice_hash_b64 ?? "",
      qrPayloadB64: row.qr_payload ?? "",
      totals: { lineNetSum: 0, taxExclusive: 0, taxInclusive: 0, vat: 0, payable: 1 },
      kind: "invoice",
      environment: zEnv,
      endpoint,
    });
    if (issues.length) {
      failed++;
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: "local_validation_failed",
          local_validation_errors: issues as any,
          last_error_message: issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ level: "error", event: "queue.invoice.local_validation_failed", refType: "zatca_invoices", refId: row.id, detail: { issues } });
      continue;
    }

    // 1b. Phase-2 byte-equality gate (run on the FINAL signed XML + FINAL QR).
    const p2 = validatePhase2FromSignedXml({
      signedXml: xml,
      qrPayloadB64: row.qr_payload ?? "",
      environment: zEnv,
      endpoint,
      kind: "invoice",
    });
    if (p2.issues.length) {
      failed++;
      const payload = { issues: p2.issues, diagnostics: p2.diagnostics } as any;
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: "local_validation_failed",
          local_validation_errors: payload,
          last_error_message: p2.issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({
        level: "error",
        event: "queue.invoice.phase2_validation_failed",
        refType: "zatca_invoices",
        refId: row.id,
        detail: { issues: p2.issues, diagnostics: p2.diagnostics },
      });
      continue;
    }
    // Persist proof-of-equality even on success — surfaced in the UI so
    // the user can audit "we matched ZATCA byte-for-byte" before submit.
    await zatcaLog({
      event: "queue.invoice.phase2_validation_passed",
      refType: "zatca_invoices",
      refId: row.id,
      detail: { diagnostics: p2.diagnostics },
    });

    // Only manual submit calls may bypass the local-only queue lock.
    const manualOverride = opts.allowNetworkSubmit === true;
    if (!opts.allowNetworkSubmit || (ZATCA_NETWORK_SUBMISSION_DISABLED && !manualOverride)) {
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: "validated_blocked",
          local_validation_errors: { issues: [], diagnostics: p2.diagnostics, network_blocked: true } as any,
          last_error_message: "Network submission is disabled; local validation passed.",
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ event: "queue.invoice.network_blocked_after_local_pass", refType: "zatca_invoices", refId: row.id, detail: { disabled: ZATCA_NETWORK_SUBMISSION_DISABLED, manualOverride, diagnostics: p2.diagnostics } });
      continue;
    }

    await supabaseAdmin
      .from("zatca_invoices")
      .update({ status: "submitting", submitted_endpoint: endpoint, last_attempt_at: new Date().toISOString() })
      .eq("id", row.id);
    await zatcaLog({ event: "zatca.request.sent", refType: "zatca_invoices", refId: row.id, detail: { endpoint, uuid: row.zatca_uuid } });

    const signedXmlB64 = String(row.signed_xml_b64);
    const result = await postReporting(endpoint, signedXmlB64, row.invoice_hash_b64, row.zatca_uuid);
    await zatcaLog({
      level: result.ok ? "info" : "error",
      event: "zatca.response.received",
      refType: "zatca_invoices",
      refId: row.id,
      detail: { httpStatus: result.status, ok: result.ok, body: result.body },
    });

    if (result.ok) {
      synced++;
      await advancePih(row.invoice_hash_b64);
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: "sent",
          submitted_at: new Date().toISOString(),
          submitted_endpoint: endpoint,
          response_payload: result.body,
          zatca_http_status: result.status,
          zatca_response_code: (result.body as any)?.reportingStatus ?? (result.body as any)?.clearanceStatus ?? (result.body as any)?.status ?? null,
          zatca_response_message: (result.body as any)?.message ?? null,
          zatca_validation_errors: null,
          zatca_warnings: (result.body as any)?.validationResults?.warningMessages ?? null,
          zatca_raw_response: result.body,
          error_message: null,
          last_error_message: null,
          last_error_at: null,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ event: "invoice.sent", refType: "zatca_invoices", refId: row.id, detail: { httpStatus: result.status } });
    } else {
      failed++;
      const rejected = result.status >= 400 && result.status < 500;
      const diagnostics = extractZatcaDiagnostics(result);
      await supabaseAdmin
        .from("zatca_invoices")
        .update({
          status: rejected ? "rejected" : "failed",
          submitted_endpoint: endpoint,
          response_payload: result.body,
          error_message: diagnostics.shortMessage,
          zatca_http_status: diagnostics.zatca_http_status,
          zatca_response_code: diagnostics.zatca_response_code,
          zatca_response_message: diagnostics.zatca_response_message,
          zatca_validation_errors: diagnostics.zatca_validation_errors,
          zatca_warnings: diagnostics.zatca_warnings,
          zatca_raw_response: diagnostics.zatca_raw_response,
          last_error_message: diagnostics.last_error_message,
          last_error_at: diagnostics.last_error_at,
          retry_count: (row.retry_count ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ level: "error", event: "zatca.validation.failed", refType: "zatca_invoices", refId: row.id, detail: { httpStatus: result.status, code: diagnostics.zatca_response_code, message: diagnostics.zatca_response_message, errors: diagnostics.errors, warnings: diagnostics.warnings } });
    }
  }

  for (const row of cnRows ?? []) {
    processed++;
    const xml = decodeStoredXml(row);
    if (!xml || !row.invoice_hash_b64 || !row.zatca_uuid) {
      const issues: LocalValidationIssue[] = [{ code: "MISSING_GENERATION", message: "Credit note has no signed XML / hash / UUID. Regenerate before sending." }];
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: "local_validation_failed",
          local_validation_errors: issues as any,
          last_error_message: issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      continue;
    }
    const issues = validateInvoiceLocal({
      xml,
      invoiceHashB64: row.invoice_hash_b64,
      uuid: row.zatca_uuid,
      icv: Number(row.icv ?? 0),
      pihB64: row.previous_invoice_hash_b64 ?? "",
      qrPayloadB64: row.qr_payload ?? "",
      totals: { lineNetSum: 0, taxExclusive: 0, taxInclusive: 0, vat: 0, payable: 1 },
      kind: "credit_note",
      environment: zEnv,
      endpoint,
    });
    if (issues.length) {
      failed++;
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: "local_validation_failed",
          local_validation_errors: issues as any,
          last_error_message: issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }
    const p2cn = validatePhase2FromSignedXml({
      signedXml: xml,
      qrPayloadB64: row.qr_payload ?? "",
      environment: zEnv,
      endpoint,
      kind: "credit_note",
    });
    if (p2cn.issues.length) {
      failed++;
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: "local_validation_failed",
          local_validation_errors: { issues: p2cn.issues, diagnostics: p2cn.diagnostics } as any,
          last_error_message: p2cn.issues[0].message,
          last_error_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ level: "error", event: "queue.cn.phase2_validation_failed", refType: "zatca_credit_notes", refId: row.id, detail: { issues: p2cn.issues, diagnostics: p2cn.diagnostics } });
      continue;
    }
    if (ZATCA_NETWORK_SUBMISSION_DISABLED || !opts.allowNetworkSubmit) {
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: "validated_blocked",
          local_validation_errors: { issues: [], diagnostics: p2cn.diagnostics, network_blocked: true } as any,
          last_error_message: "Network submission is disabled; local validation passed.",
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await zatcaLog({ event: "queue.cn.network_blocked_after_local_pass", refType: "zatca_credit_notes", refId: row.id, detail: { diagnostics: p2cn.diagnostics } });
      continue;
    }
    const result = await postReporting(endpoint, String(row.signed_xml_b64), row.invoice_hash_b64, row.zatca_uuid);
    if (result.ok) {
      synced++;
      await advancePih(row.invoice_hash_b64);
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: "synced",
          submitted_at: new Date().toISOString(),
          submitted_endpoint: endpoint,
          response_payload: result.body,
          zatca_http_status: result.status,
          zatca_response_code: (result.body as any)?.reportingStatus ?? (result.body as any)?.clearanceStatus ?? (result.body as any)?.status ?? null,
          zatca_response_message: (result.body as any)?.message ?? null,
          zatca_validation_errors: null,
          zatca_warnings: (result.body as any)?.validationResults?.warningMessages ?? null,
          zatca_raw_response: result.body,
          error_message: null,
          last_error_message: null,
          last_error_at: null,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } else {
      failed++;
      const rejected = result.status >= 400 && result.status < 500;
      const diagnostics = extractZatcaDiagnostics(result);
      await supabaseAdmin
        .from("zatca_credit_notes")
        .update({
          status: rejected ? "rejected" : "failed",
          submitted_endpoint: endpoint,
          response_payload: result.body,
          error_message: diagnostics.shortMessage,
          zatca_http_status: diagnostics.zatca_http_status,
          zatca_response_code: diagnostics.zatca_response_code,
          zatca_response_message: diagnostics.zatca_response_message,
          zatca_validation_errors: diagnostics.zatca_validation_errors,
          zatca_warnings: diagnostics.zatca_warnings,
          zatca_raw_response: diagnostics.zatca_raw_response,
          last_error_message: diagnostics.last_error_message,
          last_error_at: diagnostics.last_error_at,
          retry_count: (row.retry_count ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  await supabaseAdmin
    .from("zatca_settings")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", true);

  return { processed, synced, failed, skipped: 0 };
}
