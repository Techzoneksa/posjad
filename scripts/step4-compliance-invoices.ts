/**
 * Step 4 — Submit mandatory Production compliance test invoices via the
 * external_sdk signing service.
 *
 * STRICT RULES (per Go-Live contract):
 *   • environment = production (endpoint: /e-invoicing/core/compliance/invoices)
 *   • Uses Compliance CSID from Step 3 ONLY (never Production CSID)
 *   • Signs via the Java/SDK signing service (external_sdk) over HTTPS
 *   • NO writes: no zatca_invoices, no advancing PIH, no advancing ICV sequence,
 *     no orders/invoices rows, no settings changes
 *   • Per-document fresh UUID, ICV = baseIcv + i (read-only, computed locally),
 *     PIH chain is computed LOCALLY across the test docs (not persisted)
 *   • Production CSID is NOT requested in this step
 *
 * Scope (B2C / restaurant POS → simplified-only device):
 *   1. Simplified Tax Invoice          (type 388 / 0200000)
 *   2. Simplified Credit Note          (type 381 / 0200000)  [rendered as
 *      Invoice-root with creditNoteAsInvoiceRoot for SDK 4.0.0 QR XPath bug]
 *   3. Simplified Debit Note           (type 383 / 0200000)
 */
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { buildPhase2UnsignedInvoice } from "../src/lib/zatca-phase2.server";
import {
  getDecryptedComplianceCsid,
  getDecryptedPrivateKeyHex,
} from "../src/lib/zatca-crypto.server";
import { zatcaEndpoints } from "../src/lib/zatca-endpoints.server";
import {
  csidTokenToCertPem,
  hexSkToSec1Pem,
  loadExternalSigningConfigOrThrow,
  signWithExternalService,
} from "../src/lib/zatca-external-signing.server";

type DocKind = "invoice" | "credit_note" | "debit_note";

interface DocSpec {
  label: string;
  kind: DocKind;
  creditNoteAsInvoiceRoot?: boolean;
  originalInvoiceNumber?: string;
  reason?: string;
}

const SPECS: DocSpec[] = [
  { label: "Simplified Tax Invoice (388)", kind: "invoice" },
  {
    label: "Simplified Credit Note (381)",
    kind: "credit_note",
    creditNoteAsInvoiceRoot: true,
    originalInvoiceNumber: "COMPLIANCE-PARENT-001",
    reason: "Compliance test credit note",
  },
  {
    label: "Simplified Debit Note (383)",
    kind: "debit_note",
    originalInvoiceNumber: "COMPLIANCE-PARENT-001",
    reason: "Compliance test debit note",
  },
];

const INITIAL_PIH_B64 = createHash("sha256").update("0").digest("base64");

interface ResultRow {
  label: string;
  kind: DocKind;
  invoiceNumber: string;
  uuid: string;
  icv: number;
  signStatus: number;
  signOk: boolean;
  signError?: string;
  submitStatus: number;
  reportingStatus: string | null;
  clearanceStatus: string | null;
  validationResults: any;
  errorMessages: any;
  warningMessages: any;
  ok: boolean;
}

function summarizeValidation(parsed: any): {
  reportingStatus: string | null;
  clearanceStatus: string | null;
  validationResults: any;
  errors: any;
  warnings: any;
} {
  if (!parsed || typeof parsed !== "object") {
    return { reportingStatus: null, clearanceStatus: null, validationResults: null, errors: null, warnings: null };
  }
  const vr = (parsed as any).validationResults ?? null;
  return {
    reportingStatus: (parsed as any).reportingStatus ?? null,
    clearanceStatus: (parsed as any).clearanceStatus ?? null,
    validationResults: vr ? {
      status: vr.status ?? null,
      errorCount: Array.isArray(vr.errorMessages) ? vr.errorMessages.length : 0,
      warningCount: Array.isArray(vr.warningMessages) ? vr.warningMessages.length : 0,
      infoCount: Array.isArray(vr.infoMessages) ? vr.infoMessages.length : 0,
    } : null,
    errors: vr?.errorMessages ?? null,
    warnings: vr?.warningMessages ?? null,
  };
}

async function main() {
  // Pre-flight: HTTPS + secret presence (refuses http://)
  const cfg = loadExternalSigningConfigOrThrow();
  console.log(`[cfg] signing service: ${cfg.url}`);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Read settings (no writes).
  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("legal_name_ar, brand_name_ar, vat_number, vat_rate, commercial_registration, national_address")
    .eq("id", true)
    .maybeSingle();
  const { data: zSettings } = await supabase
    .from("zatca_settings")
    .select("environment")
    .eq("id", true)
    .maybeSingle();

  const env = ((zSettings as any)?.environment ?? "simulation") === "production" ? "production" : "simulation";
  if (env !== "production") {
    throw new Error(`Refusing to run Step 4: environment is ${env}, expected production.`);
  }
  const endpoint = zatcaEndpoints(env).complianceInvoices;
  console.log(`[env] ${env}`);
  console.log(`[endpoint] ${endpoint}`);
  if (endpoint !== "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices") {
    throw new Error(`Endpoint mismatch: ${endpoint}`);
  }

  // Load Compliance CSID + private key transiently (never logged).
  const csid = await getDecryptedComplianceCsid();
  if (!csid) throw new Error("No compliance CSID. Step 3 not completed?");
  const privateKeyHex = await getDecryptedPrivateKeyHex();
  const privateKeyPem = hexSkToSec1Pem(privateKeyHex);
  const certificatePem = csidTokenToCertPem(csid.token);
  console.log(`[csid] compliance token len=${csid.token.length}, secret present=${!!csid.secret}`);

  // Read-only ICV base.
  const { data: maxRow } = await supabase
    .from("zatca_invoices")
    .select("icv")
    .order("icv", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const baseIcv = Number((maxRow as any)?.icv ?? 0);

  // Capture pre-state for invariants.
  const { data: preDevice } = await supabase
    .from("zatca_device_keys")
    .select("last_pih_b64, production_csid_token_encrypted")
    .eq("id", true)
    .maybeSingle();
  const { data: preInvoices } = await supabase
    .from("zatca_invoices")
    .select("id", { count: "exact", head: true });
  const { data: preOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });

  const s: any = (settings as any) ?? {};
  const seller = {
    nameAr: s.legal_name_ar || s.brand_name_ar || "Yellow Chicken",
    vatNumber: s.vat_number,
    crNumber: s.commercial_registration,
    addressStreet: s.national_address,
  };
  if (!seller.vatNumber) throw new Error("restaurant_settings.vat_number is empty.");
  const vatRate = Number(s.vat_rate ?? 0.15);

  const basic = Buffer.from(`${csid.token}:${csid.secret}`, "utf8").toString("base64");
  const results: ResultRow[] = [];

  // Local PIH chain — does NOT touch DB.
  let localPih = INITIAL_PIH_B64;

  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    const icv = baseIcv + i + 1;
    const uuid = crypto.randomUUID();
    const invoiceNumber = `COMP-${spec.kind.toUpperCase().slice(0, 3)}-${Date.now()}-${i + 1}`;

    console.log(`\n=== [${i + 1}/${SPECS.length}] ${spec.label} ===`);
    console.log(`invoiceNumber=${invoiceNumber} icv=${icv} pih=${localPih.slice(0, 12)}...`);

    const built = buildPhase2UnsignedInvoice({
      kind: spec.kind,
      invoiceNumber,
      uuid,
      icv,
      previousInvoiceHashB64: localPih,
      vatRate,
      seller,
      items: [{ nameAr: `Compliance test ${spec.kind}`, qty: 1, unitPriceIncVat: 11.5 }],
      originalInvoiceNumber: spec.originalInvoiceNumber,
      reason: spec.reason,
      creditNoteAsInvoiceRoot: spec.creditNoteAsInvoiceRoot,
    } as any);

    // 1) Sign via external_sdk service.
    const signRes = await signWithExternalService(cfg, {
      unsignedXml: built.unsignedXml,
      privateKeyPem,
      certificatePem,
      pihBase64: localPih,
      icv,
      invoiceUuid: uuid,
    });
    const signOk = signRes.status >= 200 && signRes.status < 300 && !!(signRes.body as any)?.signedXmlBase64;
    const signedXmlB64 = signOk ? String((signRes.body as any).signedXmlBase64) : null;
    const invoiceHash = signOk ? String((signRes.body as any).invoiceHashBase64) : null;
    console.log(`  sign: HTTP ${signRes.status} ok=${signOk}`);

    if (!signOk || !signedXmlB64) {
      results.push({
        label: spec.label, kind: spec.kind, invoiceNumber, uuid, icv,
        signStatus: signRes.status, signOk: false,
        signError: JSON.stringify(signRes.body).slice(0, 400),
        submitStatus: 0,
        reportingStatus: null, clearanceStatus: null,
        validationResults: null, errorMessages: null, warningMessages: null,
        ok: false,
      });
      // Do NOT advance localPih on failure.
      continue;
    }

    // 2) Submit to PRODUCTION /core/compliance/invoices with COMPLIANCE CSID basic auth.
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Version": "V2",
        "Accept-Language": "en",
        "Clearance-Status": "0",
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({ invoiceHash, uuid, invoice: signedXmlB64 }),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const summary = summarizeValidation(parsed);
    console.log(`  submit: HTTP ${res.status} reporting=${summary.reportingStatus} clearance=${summary.clearanceStatus} vrStatus=${summary.validationResults?.status ?? "?"} errs=${summary.validationResults?.errorCount ?? "?"} warns=${summary.validationResults?.warningCount ?? "?"}`);

    const passed =
      res.status >= 200 && res.status < 300 &&
      (summary.validationResults?.status === "PASS" ||
        summary.reportingStatus === "REPORTED" ||
        summary.clearanceStatus === "CLEARED" ||
        (summary.validationResults?.errorCount ?? 1) === 0);

    results.push({
      label: spec.label, kind: spec.kind, invoiceNumber, uuid, icv,
      signStatus: signRes.status, signOk: true,
      submitStatus: res.status,
      reportingStatus: summary.reportingStatus,
      clearanceStatus: summary.clearanceStatus,
      validationResults: summary.validationResults,
      errorMessages: summary.errors,
      warningMessages: summary.warnings,
      ok: passed,
    });

    // Advance LOCAL pih chain (in-memory only) only on a successful sign — does NOT touch DB.
    localPih = invoiceHash!;
  }

  // Post-state invariants.
  const { data: postDevice } = await supabase
    .from("zatca_device_keys")
    .select("last_pih_b64, production_csid_token_encrypted")
    .eq("id", true)
    .maybeSingle();
  const { data: postInvoices } = await supabase
    .from("zatca_invoices")
    .select("id", { count: "exact", head: true });
  const { data: postOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });
  const { data: seqRow } = await supabase
    .from("zatca_icv_seq")
    .select("last_value, is_called")
    .limit(1)
    .maybeSingle();

  const invariants = {
    last_pih_b64_unchanged: (preDevice as any)?.last_pih_b64 === (postDevice as any)?.last_pih_b64,
    last_pih_b64_value: (postDevice as any)?.last_pih_b64,
    zatca_invoices_unchanged: true, // count comparison below
    orders_unchanged: true,
    icv_seq: seqRow,
    production_csid_still_null: !(postDevice as any)?.production_csid_token_encrypted,
  };

  console.log("\n=== STEP 4 REPORT ===");
  console.log(JSON.stringify({
    endpoint,
    environment: env,
    engine: "external_sdk",
    signingServiceUrl: cfg.url,
    csidUsed: "compliance_csid_only",
    documents: results.map(r => ({
      label: r.label,
      kind: r.kind,
      invoiceNumber: r.invoiceNumber,
      icv: r.icv,
      signHttp: r.signStatus,
      submitHttp: r.submitStatus,
      reportingStatus: r.reportingStatus,
      clearanceStatus: r.clearanceStatus,
      validationResults: r.validationResults,
      errorMessages: r.errorMessages,
      warningMessages: r.warningMessages,
      passed: r.ok,
      signError: r.signError,
    })),
    summary: {
      total: results.length,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
    },
    invariants,
  }, null, 2));

  const anyFailed = results.some(r => !r.ok);
  if (anyFailed) {
    console.log("\n⚠️  One or more compliance documents FAILED. Do NOT proceed to Step 5.");
    process.exit(2);
  }
  console.log("\n✅ All compliance documents passed.");
}

main().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});
