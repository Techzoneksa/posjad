// Sprint F — ZATCA server-side helpers (server-only).
//
// SECURITY: server-only. Never import from client code.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPhase2SignedInvoice, validatePhase2, validatePhase2FromSignedXml } from "./zatca-phase2.server";
import { validateInvoiceLocal } from "./zatca-xml.server";
import { getCurrentPih } from "./zatca-signing.server";
import { getDecryptedComplianceCsid, getDecryptedPrivateKeyHex } from "./zatca-crypto.server";
import { zatcaEndpoints } from "./zatca-endpoints.server";

export async function zatcaLog(opts: {
  level?: "info" | "warn" | "error";
  event: string;
  refType?: string | null;
  refId?: string | null;
  detail?: unknown;
}): Promise<void> {
  try {
    await supabaseAdmin.from("zatca_logs").insert({
      level: opts.level ?? "info",
      event: opts.event,
      reference_type: opts.refType ?? null,
      reference_id: opts.refId ?? null,
      detail: (opts.detail ?? null) as any,
    });
  } catch (e) {
    console.error("[zatca_log] write failed:", e);
  }
}

async function loadCredentialsOrThrow(): Promise<{ csidToken: string; privateKeyHex: string }> {
  const csid = await getDecryptedComplianceCsid();
  if (!csid) throw new Error("Device not onboarded — no compliance CSID available.");
  const privateKeyHex = await getDecryptedPrivateKeyHex();
  return { csidToken: csid.token, privateKeyHex };
}

/* ────────────────── Build + persist ZATCA tracking for an invoice ────────────────── */
export async function generateZatcaForInvoice(invoiceId: string): Promise<void> {
  await zatcaLog({ event: "zatca.local_generate.started", refType: "invoice", refId: invoiceId });
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, order_id, issued_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !invoice) {
    await zatcaLog({ level: "error", event: "generate.invoice_not_found", refType: "invoice", refId: invoiceId, detail: invErr });
    throw new Error(invErr?.message ?? `Invoice not found: ${invoiceId}`);
  }
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total_including_vat, vat_included_amount, net_amount_excluding_vat, discount_amount, created_at")
    .eq("id", (invoice as any).order_id)
    .maybeSingle();
  if (!order) {
    await zatcaLog({ level: "error", event: "generate.order_not_found", refType: "invoice", refId: invoiceId, detail: { order_id: (invoice as any).order_id } });
    throw new Error(`Order not found for invoice ${invoiceId}`);
  }
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("name_snapshot, quantity, unit_price, line_total")
    .eq("order_id", (invoice as any).order_id);
  const { data: settings } = await supabaseAdmin
    .from("restaurant_settings")
    .select("legal_name_ar, brand_name_ar, vat_number, vat_rate, commercial_registration, national_address")
    .eq("id", true)
    .maybeSingle();
  const { data: zSettings } = await supabaseAdmin
    .from("zatca_settings")
    .select("environment, onboarding_status")
    .eq("id", true)
    .maybeSingle();

  const sellerName = (settings as any)?.legal_name_ar || (settings as any)?.brand_name_ar || "JAAD CLOUD";
  const vatNumber = (settings as any)?.vat_number || "";
  const vatRate = Number((settings as any)?.vat_rate ?? 0.15);
  const iso = new Date((invoice as any).issued_at ?? (order as any).created_at ?? Date.now()).toISOString();

  const uuid = crypto.randomUUID();
  const env = (zSettings as any)?.environment ?? "simulation";
  const endpoint = zatcaEndpoints(env === "production" ? "production" : "simulation").complianceInvoices;

  const { data: icvRow } = await supabaseAdmin.rpc("next_zatca_icv");
  const icv = Number(icvRow ?? 0);
  const pihB64 = await getCurrentPih();

  let creds: { csidToken: string; privateKeyHex: string };
  try {
    creds = await loadCredentialsOrThrow();
  } catch (e: any) {
    const { data: failedRow, error: failedErr } = await supabaseAdmin.from("zatca_invoices").upsert({
      invoice_id: (invoice as any).id,
      order_id: (invoice as any).order_id,
      doc_type: "invoice",
      status: "local_validation_failed",
      environment: env,
      zatca_uuid: uuid,
      icv,
      previous_invoice_hash_b64: pihB64,
      local_validation_errors: [{ code: "NO_CREDENTIALS", message: e.message }] as any,
      last_error_message: e.message,
      last_error_at: new Date().toISOString(),
    }, { onConflict: "invoice_id" }).select("id, status").maybeSingle();
    if (failedErr) throw new Error(failedErr.message);
    await zatcaLog({ level: "error", event: "generate.no_credentials", refType: "invoice", refId: invoiceId, detail: { message: e.message } });
    await zatcaLog({ event: "zatca.status.updated", refType: "zatca_invoices", refId: (failedRow as any)?.id ?? invoiceId, detail: { invoice_id: invoiceId, status: "local_validation_failed", reason: "NO_CREDENTIALS" } });
    return;
  }

  const built = buildPhase2SignedInvoice({
    kind: "invoice",
    invoiceNumber: (invoice as any).invoice_number,
    issueIso: iso,
    uuid,
    icv,
    previousInvoiceHashB64: pihB64,
    vatRate,
    seller: {
      nameAr: sellerName,
      vatNumber,
      crNumber: (settings as any)?.commercial_registration,
      addressStreet: (settings as any)?.national_address,
    },
    items: (items ?? []).map((it: any) => ({
      nameAr: it.name_snapshot,
      qty: Number(it.quantity),
      unitPriceIncVat: Number(it.unit_price),
    })),
    csidBinarySecurityToken: creds.csidToken,
    privateKeyHex: creds.privateKeyHex,
  });

  await zatcaLog({
    event: "zatca.xml.generated",
    refType: "invoice",
    refId: invoiceId,
    detail: { invoice_number: (invoice as any).invoice_number, icv, hash: built.invoiceHashB64, xmlBytes: built.signedXml.length },
  });
  await zatcaLog({
    event: "zatca.invoice.signed",
    refType: "invoice",
    refId: invoiceId,
    detail: { signedPropsDigest: built.signedPropertiesDigestB64, certDigest: built.certDigestB64, qrTagCount: built.qrTagCount },
  });
  await zatcaLog({ event: "zatca.local_validation.started", refType: "invoice", refId: invoiceId });

  const localIssues = validateInvoiceLocal({
    xml: built.signedXml,
    invoiceHashB64: built.invoiceHashB64,
    uuid,
    icv,
    pihB64,
    qrPayloadB64: built.qrBase64,
    totals: built.totals,
    kind: "invoice",
    environment: env === "production" ? "production" : "simulation",
    endpoint,
  });
  const phase2 = validatePhase2FromSignedXml({
    signedXml: built.signedXml,
    qrPayloadB64: built.qrBase64,
    environment: env === "production" ? "production" : "simulation",
    endpoint,
    kind: "invoice",
  });
  const allIssues = [...localIssues, ...phase2.issues];
  const status = allIssues.length ? "local_validation_failed" : "validated_blocked";

  await zatcaLog({
    event: allIssues.length ? "zatca.local_validation.failed" : "zatca.local_validation.passed",
    level: allIssues.length ? "warn" : "info",
    refType: "invoice",
    refId: invoiceId,
    detail: { issueCount: allIssues.length, issues: allIssues.slice(0, 10), diagnostics: phase2.diagnostics },
  });
  if (!allIssues.length) {
    await zatcaLog({
      event: "zatca.network.blocked",
      refType: "invoice",
      refId: invoiceId,
      detail: { reason: "ZATCA_NETWORK_SUBMISSION_DISABLED", next_status: "validated_blocked" },
    });
  }

  const { data: savedRow, error: saveErr } = await supabaseAdmin.from("zatca_invoices").upsert(
    {
      invoice_id: (invoice as any).id,
      order_id: (invoice as any).order_id,
      doc_type: "invoice",
      status,
      environment: env,
      qr_payload: built.qrBase64,
      xml_hash: built.invoiceHashB64,
      invoice_hash_b64: built.invoiceHashB64,
      previous_invoice_hash_b64: pihB64,
      icv,
      signed_xml_b64: Buffer.from(built.signedXml).toString("base64"),
      zatca_uuid: uuid,
      local_validation_errors: {
        issues: allIssues,
        diagnostics: phase2.diagnostics,
        network_blocked: allIssues.length === 0,
      } as any,
      last_error_message: allIssues[0]?.message ?? "Network submission is disabled; local validation passed.",
      last_error_at: allIssues.length ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id" },
  ).select("id, status").maybeSingle();
  if (saveErr) throw new Error(saveErr.message);

  await zatcaLog({
    event: "zatca.status.updated",
    refType: "zatca_invoices",
    refId: (savedRow as any)?.id ?? invoiceId,
    detail: { invoice_id: invoiceId, status, issueCount: allIssues.length },
  });

  await zatcaLog({
    event: "invoice.generated",
    refType: "invoice",
    refId: (invoice as any).id,
    detail: {
      invoice_number: (invoice as any).invoice_number,
      env,
      totals: built.totals,
      icv,
      hash: built.invoiceHashB64,
      qrTagCount: built.qrTagCount,
      certDigestB64: built.certDigestB64,
      issuerDn: built.diagnostics.issuerDn,
      serialDecimal: built.diagnostics.serialDecimal,
      signedPropsDigest: built.signedPropertiesDigestB64,
      xadesPresent: built.diagnostics.xadesBlockPresent,
      certLoaded: built.diagnostics.certLoaded,
      privateKeyLoaded: built.diagnostics.privateKeyLoaded,
    },
  });
}

/* ────────────────── Credit-note generation for a refund ────────────────── */
export async function generateZatcaForRefund(refundId: string): Promise<void> {
  const { data: refund } = await supabaseAdmin
    .from("refunds")
    .select("id, order_id, amount, invoice_number, refunded_at, reason")
    .eq("id", refundId)
    .maybeSingle();
  if (!refund) return;
  const { data: originalInv } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, issued_at")
    .eq("order_id", (refund as any).order_id)
    .maybeSingle();
  if (!originalInv) return;
  const { data: settings } = await supabaseAdmin
    .from("restaurant_settings")
    .select("legal_name_ar, brand_name_ar, vat_number, vat_rate, commercial_registration, national_address")
    .eq("id", true)
    .maybeSingle();
  const { data: zSettings } = await supabaseAdmin
    .from("zatca_settings")
    .select("environment")
    .eq("id", true)
    .maybeSingle();

  const sellerName = (settings as any)?.legal_name_ar || (settings as any)?.brand_name_ar || "JAAD CLOUD";
  const vatNumber = (settings as any)?.vat_number || "";
  const vatRate = Number((settings as any)?.vat_rate ?? 0.15);
  const amount = Number((refund as any).amount);
  const iso = new Date((refund as any).refunded_at ?? Date.now()).toISOString();

  const uuid = crypto.randomUUID();
  const env = (zSettings as any)?.environment ?? "simulation";
  const { data: icvRow } = await supabaseAdmin.rpc("next_zatca_icv");
  const icv = Number(icvRow ?? 0);
  const pihB64 = await getCurrentPih();

  let creds: { csidToken: string; privateKeyHex: string };
  try {
    creds = await loadCredentialsOrThrow();
  } catch (e: any) {
    await zatcaLog({ level: "error", event: "generate.cn.no_credentials", refType: "refund", refId: refundId, detail: { message: e.message } });
    return;
  }

  const built = buildPhase2SignedInvoice({
    kind: "credit_note",
    invoiceNumber: `CN-${(originalInv as any).invoice_number}`,
    issueIso: iso,
    uuid,
    icv,
    previousInvoiceHashB64: pihB64,
    vatRate,
    seller: {
      nameAr: sellerName,
      vatNumber,
      crNumber: (settings as any)?.commercial_registration,
      addressStreet: (settings as any)?.national_address,
    },
    items: [{ nameAr: "Refund / إرجاع", qty: 1, unitPriceIncVat: amount }],
    originalInvoiceNumber: (originalInv as any).invoice_number,
    reason: (refund as any)?.reason ?? "Refund",
    csidBinarySecurityToken: creds.csidToken,
    privateKeyHex: creds.privateKeyHex,
  });

  await supabaseAdmin.from("zatca_credit_notes").upsert(
    {
      refund_id: (refund as any).id,
      original_invoice_id: (originalInv as any).id,
      order_id: (refund as any).order_id,
      amount,
      vat_amount: built.totals.vat,
      status: "pending_sync",
      environment: env,
      qr_payload: built.qrBase64,
      xml_hash: built.invoiceHashB64,
      invoice_hash_b64: built.invoiceHashB64,
      previous_invoice_hash_b64: pihB64,
      icv,
      signed_xml_b64: Buffer.from(built.signedXml).toString("base64"),
      zatca_uuid: uuid,
      local_validation_errors: null,
    },
    { onConflict: "refund_id" },
  );
  await zatcaLog({
    event: "credit_note.generated",
    refType: "refund",
    refId: (refund as any).id,
    detail: {
      amount,
      totals: built.totals,
      env,
      original: (originalInv as any).invoice_number,
      icv,
      hash: built.invoiceHashB64,
      qrTagCount: built.qrTagCount,
    },
  });
}

/** Re-export used by older imports. */
export { validatePhase2 };
