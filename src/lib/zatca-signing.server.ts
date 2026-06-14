// ZATCA invoice hashing & PIH chain (server-only).
//
// Hash policy (post-rewrite): the invoice hash is computed by the XML
// builder over the FINAL XML that is sent. This module no longer mutates
// XML after hashing (the old cbc:Note injection broke the hash).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";
import { loadDeviceKeysRow } from "./zatca-crypto.server";

// ZATCA's well-known initial PIH — base64 of SHA-256("0").
const INITIAL_PIH_B64 = createHash("sha256").update("0").digest("base64");

export async function getCurrentPih(): Promise<string> {
  const row = await loadDeviceKeysRow();
  if (row?.last_pih_b64) return row.last_pih_b64 as string;
  return INITIAL_PIH_B64;
}

export async function advancePih(newHashB64: string): Promise<void> {
  await supabaseAdmin
    .from("zatca_device_keys")
    .update({ last_pih_b64: newHashB64 })
    .eq("id", true);
}
