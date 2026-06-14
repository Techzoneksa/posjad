// Shared server-only ZATCA single-invoice submission service.
//
// This is THE one place that performs a real ZATCA submission. Both:
//   • Manual Submit  (POST /api/public/zatca/submit-real-invoice)
//   • Auto Runner    (advanceOneInvoice / auto-runner-tick)
// call into submitSingleInvoiceToZatca() so behavior cannot drift.
//
// Strict rules preserved from the original Manual route:
//   • Exactly ONE invoice per call (resolved by invoiceId).
//   • Refuses submission-blocking duplicates (sent/in-flight) on the
//     zatca_invoices row; pre-submit stubs (generated, validated_blocked,
//     local_validation_failed) are eligible — those rows are UPDATEd in place.
//   • Safe wrong-environment retry exception preserved.
//   • dryRun=true → preview only. No lock acquisition, no signing,
//     no submit, no DB writes, no ICV/PIH advance.
//   • dryRun=false → lease lock → claim stub → allocate ICV via next_zatca_icv()
//     → external signing service → ZATCA POST → write row → advance PIH only
//     on REPORTED + (PASS|WARNING).
//   • Production only for real submission (simulation blocked).
//   • Endpoint resolved through src/lib/zatca-endpoints.server.ts.
//   • KSA-25 WARNING alone with reportingStatus=REPORTED is accepted.
//   • Any validation ERROR, any non-REPORTED, any HTTP/network error halts.
//
// Lease lock contract (zatca_submission_lock singleton):
//   • 120s lease, atomically claimed via zatca_acquire_submission_lock().
//   • Heartbeat renews every ~50s while signing/submit is in flight.
//   • Renewal failure BEFORE the ZATCA POST → halt + manual_review_required.
//   • Renewal failure AFTER  the ZATCA POST → halt + submission_unknown.
//   • Always released in finally via zatca_release_submission_lock(attempt_id).
//
// Never stores: Authorization, CSID token/secret, private key, or full
// credentials in zatca_auto_run_items. Audit row contains only metadata.

import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decryptSecret,
  getDecryptedPrivateKeyHex,
  loadDeviceKeysRow,
} from "@/lib/zatca-crypto.server";
import { advancePih, getCurrentPih } from "@/lib/zatca-signing.server";
import { zatcaEndpoints } from "@/lib/zatca-endpoints.server";
import { buildPhase2UnsignedInvoice } from "@/lib/zatca-phase2.server";
import { zatcaLog } from "@/lib/zatca.server";
import {
  csidTokenToCertPem,
  hexSkToSec1Pem,
  loadExternalSigningConfigOrThrow,
  signWithExternalService,
} from "@/lib/zatca-external-signing.server";

const INITIAL_PIH_B64 = createHash("sha256").update("0").digest("base64");

export type SubmitSource = "manual" | "auto_runner";

export interface SubmitArgs {
  invoiceId: string;
  initiatedBy: string | null;
  source: SubmitSource;
  runId?: string | null;
  dryRun?: boolean;
}

export interface SubmitResult {
  httpStatus: number;
  body: any;
}

async function getDecryptedProductionCsid(): Promise<{ token: string; secret: string } | null> {
  const row = await loadDeviceKeysRow();
  if (!row?.production_csid_token_encrypted || !row?.production_csid_secret_encrypted) return null;
  const token = await decryptSecret(row.production_csid_token_encrypted, row.production_csid_iv);
  const secret = await decryptSecret(row.production_csid_secret_encrypted, row.production_csid_secret_iv);
  return { token, secret };
}

// ---- Lock helpers (atomic via SECURITY DEFINER pg functions) ----

async function acquireLock(args: {
  source: SubmitSource;
  invoiceId: string;
  zatcaInvoiceId: string | null;
  initiatedBy: string | null;
}): Promise<string | null> {
  const { data, error } = await (supabaseAdmin as any).rpc("zatca_acquire_submission_lock", {
    _source: args.source,
    _invoice_id: args.invoiceId,
    _zatca_invoice_id: args.zatcaInvoiceId,
    _initiated_by: args.initiatedBy,
    _lease_seconds: 120,
  });
  if (error) throw new Error(`lock_acquire_failed: ${error.message}`);
  return (data as string | null) ?? null;
}

async function renewLock(attemptId: string): Promise<boolean> {
  const { data, error } = await (supabaseAdmin as any).rpc("zatca_renew_submission_lock", {
    _attempt_id: attemptId,
    _lease_seconds: 120,
  });
  if (error) return false;
  return data === true;
}

async function releaseLock(attemptId: string): Promise<void> {
  try {
    await (supabaseAdmin as any).rpc("zatca_release_submission_lock", { _attempt_id: attemptId });
  } catch { /* non-fatal */ }
}

// ---- Audit ----

async function writeAuditRow(args: {
  source: SubmitSource;
  runId: string | null | undefined;
  invoiceId: string;
  zatcaInvoiceId: string | null;
  attemptId: string;
  result: "reported" | "failed" | "submission_unknown" | "manual_review_required" | "skipped";
  httpStatus?: number | null;
  reportingStatus?: string | null;
  validationStatus?: string | null;
  errorSummary?: string | null;
  icv?: number | null;
  invoiceHashB64?: string | null;
  previousHashB64?: string | null;
  submittedEndpoint?: string | null;
  xGlobalTransactionId?: string | null;
  submissionStartedAt?: string | null;
  responseReceivedAt?: string | null;
}) {
  const isAuto = args.source === "auto_runner";
  try {
    await supabaseAdmin.from("zatca_auto_run_items").insert({
      run_id: isAuto ? (args.runId ?? null) : null,
      invoice_id: args.invoiceId,
      zatca_invoice_id: args.zatcaInvoiceId,
      attempt_id: args.attemptId,
      source: args.source,
      result: args.result,
      http_status: args.httpStatus ?? null,
      reporting_status: args.reportingStatus ?? null,
      zatca_response_code: args.reportingStatus ?? null,
      validation_status: args.validationStatus ?? null,
      error_summary: args.errorSummary ?? null,
      icv: args.icv ?? null,
      invoice_hash_b64: args.invoiceHashB64 ?? null,
      previous_hash_b64: args.previousHashB64 ?? null,
      submitted_endpoint: args.submittedEndpoint ?? null,
      x_global_transaction_id: args.xGlobalTransactionId ?? null,
      submission_started_at: args.submissionStartedAt ?? null,
      response_received_at: args.responseReceivedAt ?? null,
      finished_at: new Date().toISOString(),
    });
  } catch (e: any) {
    await zatcaLog({
      level: "warn",
      event: "auto_run_item.insert_failed",
      refType: "invoice",
      refId: args.invoiceId,
      detail: { error: e?.message ?? String(e), source: args.source, result: args.result },
    });
  }
}

function ok(body: any): SubmitResult { return { httpStatus: 200, body }; }
function err(status: number, body: any): SubmitResult { return { httpStatus: status, body }; }

const SUBMITTED_STATUSES = new Set(["sent", "reported", "synced", "rejected"]);
const IN_FLIGHT_STATUSES = new Set(["pending_sync", "submitting", "signed", "pending_generation"]);

export async function submitSingleInvoiceToZatca(args: SubmitArgs): Promise<SubmitResult> {
  const { invoiceId, initiatedBy, source, runId, dryRun } = args;

  // ----- Resolve invoice -----
  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, order_id, issued_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return err(404, { error: "invoice_not_found" });
  if ((invoice as any).invoice_number?.startsWith?.("EXTSDK-")) {
    return err(400, { error: "test_prefix_blocked", invoice_number: (invoice as any).invoice_number });
  }

  // ----- Resolve environment (DB is source of truth) -----
  const { data: zEnvRow } = await supabaseAdmin
    .from("zatca_settings")
    .select("environment")
    .eq("id", true)
    .maybeSingle();
  const zEnv: "production" | "simulation" =
    ((zEnvRow as any)?.environment === "production" ? "production" : "simulation");

  // ----- Duplicate guard + safe wrong-env retry exception -----
  const { data: existing } = await supabaseAdmin
    .from("zatca_invoices")
    .select("id, status, submitted_at, signed_xml_b64, zatca_http_status, submitted_endpoint, environment, zatca_response_code, zatca_raw_response")
    .eq("invoice_id", (invoice as any).id)
    .maybeSingle();

  if (existing) {
    const ex: any = existing;
    const httpStatus = Number(ex.zatca_http_status ?? 0);
    const httpOk = httpStatus >= 200 && httpStatus < 300;
    const reportingStatus: string | null =
      ex.zatca_response_code ?? ex.zatca_raw_response?.reportingStatus ?? null;
    const wasSimulationEndpoint =
      typeof ex.submitted_endpoint === "string" && ex.submitted_endpoint.includes("/simulation/");
    const isFailedWrongEnv =
      ex.status === "failed" &&
      wasSimulationEndpoint &&
      zEnv === "production" &&
      !httpOk &&
      reportingStatus !== "REPORTED";

    let safeRetryEligible = false;
    if (isFailedWrongEnv) {
      const { data: dkRow } = await supabaseAdmin
        .from("zatca_device_keys")
        .select("last_pih_b64")
        .eq("id", true)
        .maybeSingle();
      const pihUnchanged = !(dkRow as any)?.last_pih_b64;
      const { count: acceptedCount } = await supabaseAdmin
        .from("zatca_invoices")
        .select("id", { count: "exact", head: true })
        .eq("environment", "production")
        .in("status", ["sent", "synced"]);
      safeRetryEligible = pihUnchanged && (acceptedCount ?? 0) === 0;
    }

    if (!safeRetryEligible) {
      if (ex.submitted_at != null || SUBMITTED_STATUSES.has(ex.status)) {
        return err(409, { error: "already_submitted", existing: ex });
      }
      if (IN_FLIGHT_STATUSES.has(ex.status)) {
        return err(409, { error: "in_flight", existing: ex });
      }
    }
  }
  const existingStubId: string | null = (existing as any)?.id ?? null;

  // ----- Resolve order + items + settings (read-only) -----
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, total_including_vat, vat_included_amount, net_amount_excluding_vat, created_at")
    .eq("id", (invoice as any).order_id)
    .maybeSingle();
  if (!order) return err(404, { error: "order_not_found" });
  if (!["paid", "completed"].includes((order as any).status)) {
    return err(412, { error: "order_not_finalized", status: (order as any).status });
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("name_snapshot, quantity, unit_price")
    .eq("order_id", (invoice as any).order_id);
  if (!items || items.length === 0) return err(412, { error: "no_line_items" });

  const { data: settings } = await supabaseAdmin
    .from("restaurant_settings")
    .select("legal_name_ar, brand_name_ar, vat_number, vat_rate, commercial_registration, national_address")
    .eq("id", true)
    .maybeSingle();
  const s: any = (settings as any) ?? {};

  const pihBefore = (await getCurrentPih()) || INITIAL_PIH_B64;
  const endpoint = zatcaEndpoints(zEnv).reportingSingle;

  // ----- DRY RUN — no lock, no writes -----
  if (dryRun) {
    return ok({
      dryRun: true,
      invoice: {
        invoiceId: (invoice as any).id,
        invoiceNumber: (invoice as any).invoice_number,
        orderId: (order as any).id,
        orderNumber: (order as any).order_number,
        issuedAt: (invoice as any).issued_at,
        total: (order as any).total_including_vat,
        vat: (order as any).vat_included_amount,
        net: (order as any).net_amount_excluding_vat,
        lineItemCount: items.length,
      },
      chain: { pihBefore, endpoint, environment: zEnv },
      sideEffects: { wroteZatcaInvoices: false, advancedPih: false, advancedIcvSequence: false, ranQueue: false },
    });
  }

  // ----- Environment / CSID gating -----
  if (zEnv !== "production") {
    return err(412, {
      error: "environment_not_production",
      environment: zEnv,
      reason: "Real submission requires zatca_settings.environment = 'production'.",
    });
  }
  let cfg;
  try { cfg = loadExternalSigningConfigOrThrow(); }
  catch (e: any) { return err(412, { error: "signing_service_unavailable", reason: e?.message }); }
  const prodCsid = await getDecryptedProductionCsid();
  if (!prodCsid) return err(412, { error: "no_production_csid", environment: zEnv });

  // ----- Acquire shared lease lock -----
  const attemptId = await acquireLock({
    source,
    invoiceId: (invoice as any).id,
    zatcaInvoiceId: existingStubId,
    initiatedBy,
  });
  if (!attemptId) {
    return err(409, { error: "zatca_submission_locked" });
  }

  // ----- Heartbeat -----
  let heartbeatFailedBeforePost = false;
  let heartbeatFailedAfterPost = false;
  let postStarted = false;
  const heartbeat = setInterval(async () => {
    const okRenew = await renewLock(attemptId);
    if (!okRenew) {
      if (postStarted) heartbeatFailedAfterPost = true;
      else heartbeatFailedBeforePost = true;
    }
  }, 50_000);

  try {
    const privateKeyHex = await getDecryptedPrivateKeyHex();

    // Claim stub: mark as submitting BEFORE ICV allocation so a concurrent
    // second caller (defeated by the lock anyway) would also see in-flight.
    if (existingStubId) {
      await supabaseAdmin
        .from("zatca_invoices")
        .update({ status: "submitting", last_attempt_at: new Date().toISOString() })
        .eq("id", existingStubId);
    }

    if (heartbeatFailedBeforePost) {
      await writeAuditRow({
        source, runId, invoiceId: (invoice as any).id, zatcaInvoiceId: existingStubId,
        attemptId, result: "manual_review_required",
        errorSummary: "lease lost before signing", previousHashB64: pihBefore,
        submittedEndpoint: endpoint,
      });
      return err(503, { error: "lease_lost_before_signing" });
    }

    const { data: icvRow } = await supabaseAdmin.rpc("next_zatca_icv");
    const icv = Number(icvRow ?? 0);
    const uuid = crypto.randomUUID();
    const issueDateTime = new Date((invoice as any).issued_at ?? (order as any).created_at ?? Date.now());

    await zatcaLog({
      event: "real_invoice.submit.started",
      refType: "invoice",
      refId: (invoice as any).id,
      detail: { invoiceNumber: (invoice as any).invoice_number, uuid, icv, endpoint, pihBefore, source, runId: runId ?? null, attemptId },
    });

    const built = buildPhase2UnsignedInvoice({
      kind: "invoice",
      invoiceNumber: (invoice as any).invoice_number,
      uuid,
      icv,
      previousInvoiceHashB64: pihBefore,
      vatRate: Number(s.vat_rate ?? 0.15),
      seller: {
        nameAr: s.legal_name_ar || s.brand_name_ar || "JAAD CLOUD",
        vatNumber: s.vat_number || "300000000000003",
        crNumber: s.commercial_registration,
        addressStreet: s.national_address,
      },
      items: (items as any[]).map((it) => ({
        nameAr: it.name_snapshot,
        qty: Number(it.quantity),
        unitPriceIncVat: Number(it.unit_price),
      })),
      issueDateTime,
    });

    const signRes = await signWithExternalService(cfg, {
      unsignedXml: built.unsignedXml,
      privateKeyPem: hexSkToSec1Pem(privateKeyHex),
      certificatePem: csidTokenToCertPem(prodCsid.token),
      pihBase64: pihBefore,
      icv,
      invoiceUuid: uuid,
    });
    const signedXmlB64 =
      signRes.status >= 200 && signRes.status < 300 ? (signRes.body as any)?.signedXmlBase64 ?? null : null;
    const invoiceHash = signedXmlB64 ? (signRes.body as any)?.invoiceHashBase64 : null;
    const qrBase64Str: string | null = (signRes.body as any)?.qrBase64 ?? null;

    if (!signedXmlB64) {
      await zatcaLog({
        level: "error", event: "real_invoice.sign_failed",
        refType: "invoice", refId: (invoice as any).id,
        detail: { signStatus: signRes.status, icvBurned: icv, source, attemptId },
      });
      await writeAuditRow({
        source, runId, invoiceId: (invoice as any).id, zatcaInvoiceId: existingStubId,
        attemptId, result: "failed", errorSummary: `signing failed (status ${signRes.status})`,
        icv, previousHashB64: pihBefore, submittedEndpoint: endpoint,
      });
      return err(502, {
        invoice: { invoiceId: (invoice as any).id, invoiceNumber: (invoice as any).invoice_number },
        icvAllocated: icv, pihBefore, pihAfter: pihBefore, lastPihUpdated: false,
        signStep: { status: signRes.status, body: signRes.body, invoiceHashBase64: null, signedXmlBytes: 0, qrPresent: false },
        submitStep: null, zatcaInvoicesRow: null,
        sideEffects: { wroteZatcaInvoices: false, advancedPih: false, ranQueue: false, touchedOtherInvoices: false },
      });
    }

    if (heartbeatFailedBeforePost) {
      await writeAuditRow({
        source, runId, invoiceId: (invoice as any).id, zatcaInvoiceId: existingStubId,
        attemptId, result: "manual_review_required",
        errorSummary: "lease lost between signing and submit",
        icv, previousHashB64: pihBefore, submittedEndpoint: endpoint,
      });
      return err(503, { error: "lease_lost_before_post", icvBurned: icv });
    }

    // ----- ZATCA POST -----
    const basic = Buffer.from(`${prodCsid.token}:${prodCsid.secret}`, "utf8").toString("base64");
    const submitBody = { invoiceHash, uuid, invoice: signedXmlB64 };

    postStarted = true;
    const submissionStartedAt = new Date().toISOString();
    let submitStatus = 0;
    let submitRaw = "";
    const submitHeaders: Record<string, string> = {};
    let submitParsed: any = null;
    try {
      const sres = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Version": "V2",
          "Accept-Language": "en",
          "Clearance-Status": "0",
          Authorization: `Basic ${basic}`,
        },
        body: JSON.stringify(submitBody),
      });
      submitStatus = sres.status;
      sres.headers.forEach((v, k) => { submitHeaders[k] = v; });
      submitRaw = await sres.text();
      try { submitParsed = JSON.parse(submitRaw); } catch { submitParsed = null; }
    } catch (e: any) {
      submitRaw = `network_error: ${e?.message ?? String(e)}`;
    }
    const responseReceivedAt = new Date().toISOString();

    const reportingStatus: string | null = submitParsed?.reportingStatus ?? null;
    const validationResults = submitParsed?.validationResults ?? null;
    const xGlobalTxnId =
      submitHeaders["x-global-transaction-id"] ??
      submitHeaders["X-Global-Transaction-Id"] ??
      null;
    const valStatus: string | null = validationResults?.status ?? null;

    const isReported = reportingStatus === "REPORTED" && (valStatus === "PASS" || valStatus === "WARNING");
    const httpOk = submitStatus >= 200 && submitStatus < 300;

    let rowStatus: "sent" | "rejected" | "failed";
    if (httpOk && isReported) rowStatus = "sent";
    else if (httpOk) rowStatus = "rejected";
    else rowStatus = "failed";

    const warningMessages = Array.isArray(validationResults?.warningMessages) ? validationResults.warningMessages : [];
    const errorMessages = Array.isArray(validationResults?.errorMessages) ? validationResults.errorMessages : [];

    const rowPayload = {
      invoice_id: (invoice as any).id,
      order_id: (invoice as any).order_id,
      doc_type: "invoice" as const,
      status: rowStatus,
      environment: zEnv,
      zatca_uuid: uuid,
      icv,
      previous_invoice_hash_b64: pihBefore,
      invoice_hash_b64: invoiceHash,
      xml_hash: invoiceHash,
      qr_payload: qrBase64Str,
      signed_xml_b64: signedXmlB64,
      submitted_endpoint: endpoint,
      submitted_at: submissionStartedAt,
      zatca_http_status: submitStatus,
      zatca_response_code: reportingStatus,
      zatca_response_message: valStatus,
      zatca_validation_errors: errorMessages as any,
      zatca_warnings: warningMessages as any,
      zatca_raw_response: submitParsed as any,
      last_attempt_at: submissionStartedAt,
      last_error_message: isReported ? null : (errorMessages[0]?.message ?? errorMessages[0] ?? submitRaw?.slice(0, 500) ?? null),
      last_error_at: isReported ? null : responseReceivedAt,
    };

    const { data: insertedRow, error: insertErr } = existingStubId
      ? await supabaseAdmin.from("zatca_invoices").update(rowPayload).eq("id", existingStubId).select("id, status").maybeSingle()
      : await supabaseAdmin.from("zatca_invoices").insert(rowPayload).select("id, status").maybeSingle();

    let pihAfter = pihBefore;
    let lastPihUpdated = false;
    if (isReported && invoiceHash) {
      await advancePih(invoiceHash);
      pihAfter = invoiceHash;
      lastPihUpdated = true;
    }

    try {
      await supabaseAdmin
        .from("zatca_settings")
        .update({ last_error: isReported ? null : (errorMessages[0]?.message ?? submitRaw?.slice(0, 500) ?? "ZATCA rejection") })
        .eq("id", true);
    } catch { /* non-fatal */ }

    await zatcaLog({
      event: "real_invoice.submit.completed",
      refType: "invoice",
      refId: (invoice as any).id,
      detail: {
        signStatus: signRes.status, submitStatus, reportingStatus, valStatus,
        invoiceHash, xGlobalTxnId, pihAdvanced: lastPihUpdated, icv,
        zatcaInvoicesRowId: (insertedRow as any)?.id,
        insertError: insertErr?.message ?? null,
        source, runId: runId ?? null, attemptId,
        heartbeatFailedAfterPost,
      },
    });

    await writeAuditRow({
      source, runId,
      invoiceId: (invoice as any).id,
      zatcaInvoiceId: ((insertedRow as any)?.id ?? existingStubId) ?? null,
      attemptId,
      result: heartbeatFailedAfterPost
        ? "submission_unknown"
        : isReported ? "reported" : "failed",
      httpStatus: submitStatus,
      reportingStatus,
      validationStatus: valStatus,
      errorSummary: isReported ? null : (errorMessages[0]?.message ?? submitRaw?.slice(0, 500) ?? null),
      icv,
      invoiceHashB64: invoiceHash,
      previousHashB64: pihBefore,
      submittedEndpoint: endpoint,
      xGlobalTransactionId: xGlobalTxnId,
      submissionStartedAt,
      responseReceivedAt,
    });

    if (heartbeatFailedAfterPost) {
      return err(503, {
        error: "lease_lost_after_post",
        warning: "submission_unknown — verify ZATCA acceptance manually before any further submission",
        invoice: { invoiceId: (invoice as any).id, invoiceNumber: (invoice as any).invoice_number },
        icvAllocated: icv, pihBefore, pihAfter, lastPihUpdated,
        submitStep: { status: submitStatus, reportingStatus, validationResults, xGlobalTransactionId: xGlobalTxnId },
        zatcaInvoicesRow: insertedRow ?? null,
      });
    }

    return ok({
      invoice: {
        invoiceId: (invoice as any).id,
        invoiceNumber: (invoice as any).invoice_number,
        orderId: (order as any).id,
        orderNumber: (order as any).order_number,
      },
      icvAllocated: icv,
      pihBefore,
      pihAfter,
      lastPihUpdated,
      signStep: {
        status: signRes.status,
        invoiceHashBase64: invoiceHash,
        signedXmlBytes: Buffer.from(String(signedXmlB64), "base64").byteLength,
        qrPresent: !!qrBase64Str,
      },
      submitStep: {
        status: submitStatus,
        reportingStatus,
        validationResults,
        warningMessages,
        errorMessages,
        xGlobalTransactionId: xGlobalTxnId,
        headers: submitHeaders,
        raw: submitRaw,
      },
      zatcaInvoicesRow: insertedRow ?? null,
      zatcaInvoicesInsertError: insertErr?.message ?? null,
      sideEffects: {
        wroteZatcaInvoices: !!insertedRow,
        advancedPih: lastPihUpdated,
        advancedIcvSequence: true,
        ranQueue: false,
        touchedOtherInvoices: false,
      },
    });
  } catch (e: any) {
    await writeAuditRow({
      source, runId, invoiceId: (invoice as any).id, zatcaInvoiceId: existingStubId,
      attemptId, result: postStarted ? "submission_unknown" : "failed",
      errorSummary: `unhandled: ${e?.message ?? String(e)}`,
      previousHashB64: pihBefore, submittedEndpoint: endpoint,
    });
    return err(500, { error: "unhandled", reason: e?.message ?? String(e) });
  } finally {
    clearInterval(heartbeat);
    await releaseLock(attemptId);
  }
}
