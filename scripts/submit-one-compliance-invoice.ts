/**
 * One-shot: build a fresh local-only Phase-2 invoice, run local validation,
 * and submit ONLY to /simulation/compliance/invoices. Does NOT touch invoices
 * table or any persisted ZATCA rows. Used to verify the XMLDSig raw-base64
 * digest fix.
 */
import { buildPhase2SignedInvoice, validatePhase2FromSignedXml } from "../src/lib/zatca-phase2.server";
import { getDecryptedComplianceCsid, getDecryptedPrivateKeyHex } from "../src/lib/zatca-crypto.server";
import { zatcaEndpoints } from "../src/lib/zatca-endpoints.server";
import { createClient } from "@supabase/supabase-js";

// Override the supabaseAdmin module used by zatca-crypto to use Node env vars.
// It already reads from process.env in the deployed worker; here the server
// client module also reads process.env so the import works without extra setup.

function mask(s: string | undefined | null, keep = 6) {
  if (!s) return "<none>";
  const str = String(s);
  if (str.length <= keep * 2) return "***";
  return `${str.slice(0, keep)}...${str.slice(-keep)} (len=${str.length})`;
}

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
  const endpoint = zatcaEndpoints(env).complianceInvoices;
  console.log(`[env] ${env}`);
  console.log(`[endpoint] ${endpoint}`);

  const csid = await getDecryptedComplianceCsid();
  if (!csid) throw new Error("No compliance CSID. Onboard first.");
  const privateKeyHex = await getDecryptedPrivateKeyHex();
  console.log(`[csid.token] ${mask(csid.token, 8)}`);
  console.log(`[csid.secret] ${mask(csid.secret, 4)}`);
  console.log(`[private_key] ${mask(privateKeyHex, 4)}`);

  const sellerName = (settings as any)?.legal_name_ar || (settings as any)?.brand_name_ar || "Yellow Chicken";
  const vatNumber = (settings as any)?.vat_number || "";
  const vatRate = Number((settings as any)?.vat_rate ?? 0.15);

  // Fresh local-only ICV (use a very high number to avoid colliding with stored sequence).
  const icv = 999000 + Math.floor(Math.random() * 1000);
  const uuid = crypto.randomUUID();
  const iso = new Date().toISOString();
  const pihB64 = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=="; // wes4m default seed PIH

  const built = buildPhase2SignedInvoice({
    kind: "invoice",
    invoiceNumber: `TEST-FIX-${icv}`,
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
    items: [{ nameAr: "Test Item", qty: 1, unitPriceIncVat: 11.5 }],
    csidBinarySecurityToken: csid.token,
    privateKeyHex,
  });

  console.log("\n=== Built ===");
  console.log(`invoiceHash      : ${built.invoiceHashB64}`);
  console.log(`signedPropsDigest: ${built.signedPropertiesDigestB64} (len=${built.signedPropertiesDigestB64.length})`);
  console.log(`certDigest       : ${built.certDigestB64} (len=${built.certDigestB64.length})`);

  // Pull embedded values out of the XML to verify what was embedded.
  const xml = built.signedXml;
  const embeddedSPDigest = xml.match(/URI="#xadesSignedProperties"[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/)?.[1] ?? "";
  const embeddedCertDigest = xml.match(/<xades:CertDigest>[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/)?.[1] ?? "";
  const embeddedRefType = xml.match(/URI="#xadesSignedProperties"\s+Type="([^"]+)"/)?.[1] ?? "";
  const embeddedRefDigestMethod = xml.match(/URI="#xadesSignedProperties"[\s\S]*?<ds:DigestMethod\s+Algorithm="([^"]+)"/)?.[1] ?? "";

  console.log("\n=== Embedded in XML ===");
  console.log(`SignedProperties DigestValue len : ${embeddedSPDigest.length}  value: ${embeddedSPDigest}`);
  console.log(`CertDigest        DigestValue len : ${embeddedCertDigest.length}  value: ${embeddedCertDigest}`);
  console.log(`SignedProperties Reference Type   : ${embeddedRefType}`);
  console.log(`SignedProperties DigestMethod     : ${embeddedRefDigestMethod}`);

  // Local Phase-2 validation
  const report = validatePhase2FromSignedXml({
    signedXml: xml,
    qrPayloadB64: built.qrBase64,
    environment: env,
    endpoint,
    kind: "invoice",
  });
  console.log("\n=== Local Phase-2 Validation ===");
  console.log(`issues: ${report.issues.length}`);
  for (const i of report.issues) console.log(`  - [${i.code}] ${i.message}`);

  if (report.issues.length) {
    console.log("\nABORT: local validation failed. Not submitting to ZATCA.");
    process.exit(1);
  }

  // Submit
  const auth = "Basic " + Buffer.from(`${csid.token}:${csid.secret}`).toString("base64");
  const signedXmlB64 = Buffer.from(xml, "utf8").toString("base64");
  console.log("\n=== Submitting to ZATCA ===");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Version": "V2",
      "Accept-Language": "en",
      "Clearance-Status": "0",
      Authorization: auth,
    },
    body: JSON.stringify({ invoiceHash: built.invoiceHashB64, uuid, invoice: signedXmlB64 }),
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log(`HTTP ${res.status}`);
  console.log("Raw response:");
  console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
