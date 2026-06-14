import { createHash, X509Certificate } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SB = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

function strip(s: string) { return s.replace(/-----BEGIN [A-Z ]+-----/g, "").replace(/-----END [A-Z ]+-----/g, "").replace(/\s+/g, ""); }
function b64ToU8(s: string) { const b = Buffer.from(s, "base64"); const o = new Uint8Array(b.byteLength); o.set(b); return o; }
async function deriveKey() {
  const m = new Uint8Array(createHash("sha256").update(process.env.ZATCA_DEVICE_KEY_ENCRYPTION_SECRET!).digest());
  return crypto.subtle.importKey("raw", m.buffer.slice(m.byteOffset, m.byteOffset + m.byteLength) as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
}
async function decrypt(ct: string, ivB64: string) {
  const key = await deriveKey();
  const stripped = ct.startsWith("v1:") ? ct.slice(3) : ct;
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToU8(ivB64) }, key, b64ToU8(stripped)));
  return new TextDecoder().decode(pt);
}
function normalize(token: string) {
  let der = Buffer.from(strip(token), "base64");
  const ascii = der.toString("ascii");
  if (/^[A-Za-z0-9+/=]+$/.test(ascii) && ascii.length > 100) { const inner = Buffer.from(ascii, "base64"); if (inner[0] === 0x30) der = inner; }
  return der;
}
function certHashB64Hex(bodyB64: string) { return Buffer.from(createHash("sha256").update(bodyB64).digest("hex"), "ascii").toString("base64"); }
function mask(s: string, keep = 24) { return s.length <= keep ? s : `${s.slice(0, keep)}…(${s.length - keep} chars masked)`; }

async function main() {
  const z = (await SB.from("zatca_invoices").select("signed_xml_b64").eq("id", "84062480-d00a-4404-9a45-9f2311101d0b").maybeSingle()).data!;
  const xml = Buffer.from(z.signed_xml_b64, "base64").toString("utf8");
  const m = xml.match(/<ds:X509Certificate>([\s\S]*?)<\/ds:X509Certificate>/)!;
  const embeddedB64 = m[1].replace(/\s+/g, "");
  const embeddedDer = Buffer.from(embeddedB64, "base64");
  const embeddedX = new X509Certificate(`-----BEGIN CERTIFICATE-----\n${embeddedB64.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`);

  const k = (await SB.from("zatca_device_keys").select("compliance_csid_token_encrypted,compliance_csid_iv").eq("id", true).maybeSingle()).data!;
  const tok = await decrypt(k.compliance_csid_token_encrypted, k.compliance_csid_iv);
  const csidDer = normalize(tok);
  const csidB64 = csidDer.toString("base64");
  const csidX = new X509Certificate(`-----BEGIN CERTIFICATE-----\n${csidB64.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`);

  console.log(JSON.stringify({
    embedded_cert_len: embeddedDer.length,
    csid_cert_len: csidDer.length,
    cert_bytes_equal: embeddedDer.equals(csidDer),
    embedded_sha256_b64hex: certHashB64Hex(embeddedB64),
    csid_sha256_b64hex: certHashB64Hex(csidB64),
    embedded_serial: BigInt("0x" + embeddedX.serialNumber).toString(10),
    csid_serial: BigInt("0x" + csidX.serialNumber).toString(10),
    embedded_issuer: embeddedX.issuer,
    csid_issuer: csidX.issuer,
    embedded_subject: embeddedX.subject,
    csid_subject: csidX.subject,
    embedded_validFrom: embeddedX.validFrom,
    embedded_validTo: embeddedX.validTo,
    csid_validFrom: csidX.validFrom,
    csid_validTo: csidX.validTo,
    embedded_cert_b64_preview: mask(embeddedB64),
    csid_cert_b64_preview: mask(csidB64),
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
