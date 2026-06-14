// Step 5 — requestProductionCsid. Uses Compliance CSID from Step 3.
import { requestProductionCsid } from "../src/lib/zatca-onboarding.server";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pre-state
  const { data: preDev } = await supabase.from("zatca_device_keys")
    .select("production_csid_token_encrypted, last_pih_b64, compliance_request_id").eq("id", true).maybeSingle();
  const { data: preSet } = await supabase.from("zatca_settings")
    .select("environment, onboarding_status, csid_reference, production_csid_at").eq("id", true).maybeSingle();
  console.log("[pre]", JSON.stringify({
    env: (preSet as any)?.environment,
    onboarding_status: (preSet as any)?.onboarding_status,
    compliance_request_id: (preDev as any)?.compliance_request_id,
    production_csid_present: !!(preDev as any)?.production_csid_token_encrypted,
    last_pih_b64: (preDev as any)?.last_pih_b64,
  }));

  const r = await requestProductionCsid();
  console.log("\n[result]", JSON.stringify(r, null, 2));

  // Post-state
  const { data: postDev } = await supabase.from("zatca_device_keys")
    .select("production_csid_token_encrypted, production_csid_iv, production_csid_secret_encrypted, production_csid_secret_iv, last_pih_b64").eq("id", true).maybeSingle();
  const { data: postSet } = await supabase.from("zatca_settings")
    .select("environment, onboarding_status, csid_reference, production_csid_at, last_error").eq("id", true).maybeSingle();
  const { count: ordersCount } = await supabase.from("orders").select("id", { count: "exact", head: true });
  const { count: invCount } = await supabase.from("invoices").select("id", { count: "exact", head: true });
  const { count: zinvCount } = await supabase.from("zatca_invoices").select("id", { count: "exact", head: true });
  const { data: seq } = await supabase.from("zatca_icv_seq").select("last_value, is_called").limit(1).maybeSingle();

  console.log("\n[post]", JSON.stringify({
    environment: (postSet as any)?.environment,
    onboarding_status: (postSet as any)?.onboarding_status,
    csid_reference: (postSet as any)?.csid_reference,
    production_csid_at: (postSet as any)?.production_csid_at,
    last_error: (postSet as any)?.last_error,
    production_csid_token_present: !!(postDev as any)?.production_csid_token_encrypted,
    production_csid_iv_present: !!(postDev as any)?.production_csid_iv,
    production_csid_secret_present: !!(postDev as any)?.production_csid_secret_encrypted,
    production_csid_secret_iv_present: !!(postDev as any)?.production_csid_secret_iv,
    last_pih_b64: (postDev as any)?.last_pih_b64,
    last_pih_unchanged: (preDev as any)?.last_pih_b64 === (postDev as any)?.last_pih_b64,
    orders: ordersCount, invoices: invCount, zatca_invoices: zinvCount,
    icv_seq: seq,
  }, null, 2));

  if (!r.ok) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
