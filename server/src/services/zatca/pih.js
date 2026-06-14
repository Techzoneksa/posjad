export const DEFAULT_PIH_BASE64 = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3MzczNTdlNTdiNg==";

export async function getCurrentPih(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("zatca_settings")
    .select("last_pih_b64")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;
  return data?.last_pih_b64 || DEFAULT_PIH_BASE64;
}

export async function advancePih(supabaseAdmin, invoiceHashBase64) {
  const { error } = await supabaseAdmin
    .from("zatca_settings")
    .update({ last_pih_b64: invoiceHashBase64, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) throw error;
}
