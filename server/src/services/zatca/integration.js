import crypto from "node:crypto";

import { httpError } from "../../lib/http-error.js";
import { buildUblInvoice } from "./xml.js";
import { getCurrentPih, advancePih } from "./pih.js";
import { signWithJavaService, signingServiceConfigured } from "./signing-client.js";
import { chooseEndpoint } from "./endpoints.js";
import { readZatcaCredentials } from "./crypto.js";

function mustData(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function readSettings(supabaseAdmin) {
  return mustData(await supabaseAdmin.from("zatca_settings").select("*").eq("id", true).maybeSingle()) ?? {};
}

async function readDeviceKeys(supabaseAdmin) {
  return mustData(await supabaseAdmin.from("zatca_device_keys").select("*").eq("id", true).maybeSingle()) ?? {};
}

async function nextIcv(settings) {
  if (settings.next_icv || settings.icv) return Number(settings.next_icv ?? settings.icv);
  return Math.floor(Date.now() / 1000);
}

async function loadInvoiceGraph(supabaseAdmin, invoiceId) {
  const invoice = mustData(await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).single());
  const order = mustData(await supabaseAdmin.from("orders").select("*, customers(*)").eq("id", invoice.order_id).single());
  const items = mustData(await supabaseAdmin.from("order_items").select("*").eq("order_id", invoice.order_id));
  return { invoice, order, items };
}

function decodeSignedXml(response, fallbackXml) {
  if (response?.signedXmlBase64) return Buffer.from(response.signedXmlBase64, "base64").toString("utf8");
  if (response?.signedXml) return response.signedXml;
  return fallbackXml;
}

async function saveZatcaInvoice(supabaseAdmin, payload) {
  const { data, error } = await supabaseAdmin
    .from("zatca_invoices")
    .upsert(payload, { onConflict: "invoice_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function bestEffortEnqueue(supabaseAdmin, invoiceId, zatcaInvoiceId) {
  const { error } = await supabaseAdmin
    .from("zatca_invoice_queue")
    .upsert({
      invoice_id: invoiceId,
      zatca_invoice_id: zatcaInvoiceId,
      doc_type: "invoice",
      status: "queued",
      run_after: new Date().toISOString(),
    }, { onConflict: "invoice_id" });

  if (error && !String(error.message ?? "").includes("zatca_invoice_queue")) {
    throw error;
  }
}

async function markQueue(supabaseAdmin, invoiceId, update) {
  const { error } = await supabaseAdmin
    .from("zatca_invoice_queue")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId);

  if (error && !String(error.message ?? "").includes("zatca_invoice_queue")) {
    throw error;
  }
}

export async function generateAndSignInvoice({ supabaseAdmin, invoiceId, force = false }) {
  if (!invoiceId) throw httpError(400, "invoice_id is required");

  const existing = mustData(await supabaseAdmin.from("zatca_invoices").select("*").eq("invoice_id", invoiceId).maybeSingle());
  if ((existing?.status === "sent" || existing?.status === "synced") && !force) return existing;

  const settings = await readSettings(supabaseAdmin);
  const deviceKeys = await readDeviceKeys(supabaseAdmin);
  const { invoice, order, items } = await loadInvoiceGraph(supabaseAdmin, invoiceId);
  const previousInvoiceHashBase64 = await getCurrentPih(supabaseAdmin);
  const icv = await nextIcv(settings);
  const uuid = existing?.zatca_uuid ?? undefined;
  const built = buildUblInvoice({ order, invoice, items, settings, previousInvoiceHashBase64, icv, uuid });
  const credentials = readZatcaCredentials({ ...settings, ...deviceKeys });

  let signResponse = null;
  let signedXml = built.unsignedXml;
  let signedXmlBase64 = Buffer.from(signedXml).toString("base64");
  let finalHash = built.invoiceHashBase64;
  let finalQr = built.qrBase64;
  let status = "generated";
  let validationErrors = null;

  if (signingServiceConfigured()) {
    if (!credentials.privateKeyPem || !credentials.certificatePem) {
      throw httpError(409, "ZATCA private key or CSID certificate is not configured");
    }
    signResponse = await signWithJavaService({
      unsignedXml: built.unsignedXml,
      privateKeyPem: credentials.privateKeyPem,
      certificatePem: credentials.certificatePem,
      pihBase64: previousInvoiceHashBase64,
      icv,
      invoiceUuid: built.uuid,
    });
    signedXml = decodeSignedXml(signResponse, built.unsignedXml);
    signedXmlBase64 = Buffer.from(signedXml).toString("base64");
    finalHash = signResponse.invoiceHashBase64 ?? signResponse.invoiceHashB64 ?? finalHash;
    finalQr = signResponse.qrBase64 ?? finalQr;
    status = "signed";
  } else {
    validationErrors = [{ code: "SIGNING_SERVICE_NOT_CONFIGURED", message: "Generated Phase 1 UBL XML only; XAdES signing skipped." }];
  }

  const row = await saveZatcaInvoice(supabaseAdmin, {
    invoice_id: invoiceId,
    order_id: invoice.order_id,
    status,
    environment: settings.environment ?? "simulation",
    zatca_uuid: built.uuid,
    icv,
    qr_payload: finalQr,
    xml_hash: finalHash,
    signed_xml_b64: signedXmlBase64,
    invoice_hash_b64: finalHash,
    previous_invoice_hash_b64: previousInvoiceHashBase64,
    local_validation_errors: validationErrors,
    updated_at: new Date().toISOString(),
  });

  await bestEffortEnqueue(supabaseAdmin, invoiceId, row.id);

  return {
    ...row,
    unsigned_xml: built.unsignedXml,
    signed_xml: signedXml,
    structural_metrics: built.metrics,
    totals: built.totals,
    signing_diagnostics: signResponse?.diagnostics ?? null,
  };
}

export async function submitInvoiceToZatca({ supabaseAdmin, invoiceId, zatcaInvoiceId, allowGenerate = true }) {
  let row = zatcaInvoiceId
    ? mustData(await supabaseAdmin.from("zatca_invoices").select("*").eq("id", zatcaInvoiceId).single())
    : mustData(await supabaseAdmin.from("zatca_invoices").select("*").eq("invoice_id", invoiceId).maybeSingle());

  if (!row && allowGenerate) {
    row = await generateAndSignInvoice({ supabaseAdmin, invoiceId });
  }

  if (!row) throw httpError(404, "ZATCA invoice row not found");
  if (row.status === "generated") {
    throw httpError(409, "Invoice was generated but not signed. Configure and run the ZATCA Java signing service first.");
  }
  if (!row.signed_xml_b64 || !row.invoice_hash_b64 || !row.zatca_uuid) {
    throw httpError(409, "Invoice must be generated and signed before submission");
  }

  const settings = await readSettings(supabaseAdmin);
  const deviceKeys = await readDeviceKeys(supabaseAdmin);
  const credentials = readZatcaCredentials({ ...settings, ...deviceKeys });
  const graph = await loadInvoiceGraph(supabaseAdmin, row.invoice_id);
  const isB2B = Boolean(graph.order?.customers?.vat_number ?? graph.order?.customer_vat_number);
  const endpoint = chooseEndpoint({ settings, invoiceType: { mode: isB2B ? "clearance" : "reporting" } });
  const token = credentials.binarySecurityToken;
  const secret = credentials.secret;

  if (!token || !secret) {
    throw httpError(409, "ZATCA CSID token/secret are not configured");
  }

  await supabaseAdmin.from("zatca_invoices").update({
    status: "submitting",
    submitted_endpoint: endpoint,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  await markQueue(supabaseAdmin, row.invoice_id, { status: "processing", locked_at: new Date().toISOString() });

  const startedAt = new Date().toISOString();
  let responseText = "";
  let responseJson = {};
  let httpStatus = 0;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "accept-language": "en",
        "accept-version": "V2",
        "clearance-status": isB2B ? "1" : "0",
        authorization: `Basic ${Buffer.from(`${token}:${secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        invoiceHash: row.invoice_hash_b64,
        uuid: row.zatca_uuid,
        invoice: row.signed_xml_b64,
      }),
    });
    httpStatus = response.status;
    responseText = await response.text();
    try { responseJson = responseText ? JSON.parse(responseText) : {}; } catch { responseJson = { raw: responseText }; }
  } catch (error) {
    await supabaseAdmin.from("zatca_invoices").update({
      status: "failed",
      last_error_message: error.message,
      last_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    throw error;
  }

  const accepted = httpStatus >= 200 && httpStatus < 300;
  const responseCode = responseJson.reportingStatus ?? responseJson.clearanceStatus ?? responseJson.status ?? null;
  const update = {
    status: accepted ? "sent" : "failed",
    submitted_at: accepted ? new Date().toISOString() : null,
    zatca_http_status: httpStatus,
    zatca_response_code: responseCode,
    zatca_raw_response: responseJson,
    submitted_endpoint: endpoint,
    last_error_message: accepted ? null : responseText.slice(0, 1000),
    last_error_at: accepted ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabaseAdmin
    .from("zatca_invoices")
    .update(update)
    .eq("id", row.id)
    .select()
    .single();

  if (error) throw error;
  if (accepted) await advancePih(supabaseAdmin, row.invoice_hash_b64);
  await markQueue(supabaseAdmin, row.invoice_id, {
    status: accepted ? "submitted" : "failed",
    last_error: accepted ? null : responseText.slice(0, 500),
    locked_at: null,
    run_after: accepted ? new Date().toISOString() : new Date(Date.now() + 5 * 60_000).toISOString(),
  });

  await supabaseAdmin.from("zatca_auto_run_items").insert({
    invoice_id: row.invoice_id,
    zatca_invoice_id: row.id,
    attempt_id: crypto.randomUUID(),
    source: "manual",
    result: accepted ? "reported" : "failed",
    http_status: httpStatus,
    reporting_status: responseCode,
    zatca_response_code: responseCode,
    validation_status: accepted ? "accepted" : "failed",
    error_summary: accepted ? null : responseText.slice(0, 500),
    icv: row.icv ?? null,
    invoice_hash_b64: row.invoice_hash_b64,
    previous_hash_b64: row.previous_invoice_hash_b64,
    submitted_endpoint: endpoint,
    submission_started_at: startedAt,
    response_received_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  return { ok: accepted, status: httpStatus, response: responseJson, invoice: saved };
}

export async function runQueueOnce({ supabaseAdmin, limit = 10, source = "auto_runner" } = {}) {
  const settings = await readSettings(supabaseAdmin);
  if (!settings.queue_enabled) return { skipped: true, reason: "queue_disabled", processed: 0 };

  const run = mustData(await supabaseAdmin.from("zatca_auto_runs").insert({ status: "running" }).select().single());
  const queueResult = await supabaseAdmin
    .from("zatca_invoice_queue")
    .select("*, zatca_invoices(*)")
    .in("status", ["queued", "failed"])
    .lte("run_after", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  let candidates;
  if (queueResult.error) {
    candidates = mustData(await supabaseAdmin
      .from("zatca_invoices")
      .select("*")
      .in("status", ["generated", "signed", "pending_sync", "failed"])
      .order("created_at", { ascending: true })
      .limit(limit)).map((row) => ({ invoice_id: row.invoice_id, zatca_invoice_id: row.id, zatca_invoices: row }));
  } else {
    candidates = queueResult.data ?? [];
  }

  let reported = 0;
  let failed = 0;
  let unknown = 0;

  for (const candidate of candidates) {
    const zatcaRow = candidate.zatca_invoices ?? candidate;
    try {
      await markQueue(supabaseAdmin, candidate.invoice_id, {
        status: "processing",
        locked_at: new Date().toISOString(),
        attempts: Number(candidate.attempts ?? 0) + 1,
      });
      if (zatcaRow.status === "generated") {
        await generateAndSignInvoice({ supabaseAdmin, invoiceId: candidate.invoice_id, force: true });
      }
      const result = await submitInvoiceToZatca({ supabaseAdmin, invoiceId: candidate.invoice_id, zatcaInvoiceId: candidate.zatca_invoice_id ?? zatcaRow.id, allowGenerate: true });
      if (result.ok) reported += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      if (String(error.message ?? "").toLowerCase().includes("fetch")) unknown += 1;
      await supabaseAdmin.from("zatca_auto_run_items").insert({
        run_id: run.id,
        invoice_id: candidate.invoice_id,
        zatca_invoice_id: candidate.zatca_invoice_id ?? zatcaRow.id,
        attempt_id: crypto.randomUUID(),
        source,
        result: "failed",
        error_summary: String(error.message ?? error).slice(0, 500),
        invoice_hash_b64: zatcaRow.invoice_hash_b64,
        previous_hash_b64: zatcaRow.previous_invoice_hash_b64,
        finished_at: new Date().toISOString(),
      });
      await markQueue(supabaseAdmin, candidate.invoice_id, {
        status: "failed",
        locked_at: null,
        last_error: String(error.message ?? error).slice(0, 500),
        run_after: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    }
  }

  const update = {
    status: "completed",
    ended_at: new Date().toISOString(),
    processed_count: candidates.length,
    reported_count: reported,
    failed_count: failed,
    unknown_count: unknown,
  };
  await supabaseAdmin.from("zatca_auto_runs").update(update).eq("id", run.id);
  return { run_id: run.id, ...update };
}
