import { createHash, X509Certificate } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { C14nCanonicalization } from "xml-crypto";

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
const TARGET = process.argv[2] ?? "84062480";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function b64FromHexSha256(input: string): { hex: string; b64Hex: string; rawB64: string } {
  const h = createHash("sha256").update(Buffer.from(input, "utf8"));
  const digest = h.digest();
  const hex = digest.toString("hex");
  return { hex, b64Hex: Buffer.from(hex, "ascii").toString("base64"), rawB64: digest.toString("base64") };
}

function stripPemOrWhitespace(s: string): string {
  return String(s ?? "")
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
}

function normalizeCsidToDerAndBody(token: string): { der: Buffer; bodyB64: string; pem: string } {
  const stripped = stripPemOrWhitespace(token);
  let der = Buffer.from(stripped, "base64");
  const ascii = der.toString("ascii");
  if (/^[A-Za-z0-9+/=]+$/.test(ascii) && ascii.length > 100) {
    const inner = Buffer.from(ascii, "base64");
    if (inner[0] === 0x30) der = inner;
  }
  if (der[0] !== 0x30) throw new Error("Current CSID token did not decode to DER certificate bytes");
  const bodyB64 = der.toString("base64");
  const pem = `-----BEGIN CERTIFICATE-----\n${bodyB64.match(/.{1,64}/g)?.join("\n") ?? bodyB64}\n-----END CERTIFICATE-----`;
  return { der, bodyB64, pem };
}

interface AsnNode { tag: number; contentStart: number; contentEnd: number; fullStart: number; fullEnd: number }
function readLen(buf: Uint8Array, off: number): { len: number; next: number } {
  const first = buf[off];
  if (first < 0x80) return { len: first, next: off + 1 };
  const n = first & 0x7f;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | buf[off + 1 + i];
  return { len, next: off + 1 + n };
}
function readTlv(buf: Uint8Array, off: number): AsnNode {
  const tag = buf[off];
  const { len, next } = readLen(buf, off + 1);
  return { tag, contentStart: next, contentEnd: next + len, fullStart: off, fullEnd: next + len };
}
function children(buf: Uint8Array, node: AsnNode): AsnNode[] {
  const out: AsnNode[] = [];
  let off = node.contentStart;
  while (off < node.contentEnd) {
    const c = readTlv(buf, off);
    out.push(c);
    off = c.fullEnd;
  }
  return out;
}
function decodeOid(content: Uint8Array): string {
  const out: number[] = [];
  const b0 = content[0];
  out.push(Math.floor(b0 / 40), b0 % 40);
  let v = 0;
  for (let i = 1; i < content.length; i++) {
    v = (v << 7) | (content[i] & 0x7f);
    if ((content[i] & 0x80) === 0) { out.push(v); v = 0; }
  }
  return out.join(".");
}
function decodeAsnString(buf: Uint8Array, node: AsnNode): string {
  const raw = buf.slice(node.contentStart, node.contentEnd);
  if (node.tag === 0x1e) {
    let s = "";
    for (let i = 0; i + 1 < raw.length; i += 2) s += String.fromCharCode((raw[i] << 8) | raw[i + 1]);
    return s;
  }
  return Buffer.from(raw).toString(node.tag === 0x13 || node.tag === 0x16 ? "ascii" : "utf8");
}
function parseIssuerAttrsFromDer(der: Uint8Array) {
  const root = readTlv(der, 0);
  const tbs = children(der, root)[0];
  const tbsKids = children(der, tbs);
  let idx = 0;
  if ((tbsKids[idx].tag & 0xe0) === 0xa0) idx++;
  idx++; // serial
  idx++; // signature algorithm
  const issuer = tbsKids[idx];
  const attrs: { order: number; type: string; oid: string; shortName: string; value: string }[] = [];
  for (const rdn of children(der, issuer)) {
    for (const atv of children(der, rdn)) {
      const atvKids = children(der, atv);
      if (atvKids.length < 2) continue;
      const oid = decodeOid(der.slice(atvKids[0].contentStart, atvKids[0].contentEnd));
      attrs.push({ order: attrs.length, type: oid, oid, shortName: oidShort[oid] ?? oid, value: decodeAsnString(der, atvKids[1]) });
    }
  }
  return attrs;
}

async function deriveAesKey(): Promise<CryptoKey> {
  const secret = requireEnv("ZATCA_DEVICE_KEY_ENCRYPTION_SECRET");
  if (secret.length < 16) throw new Error("ZATCA_DEVICE_KEY_ENCRYPTION_SECRET is too short");
  const material = new Uint8Array(createHash("sha256").update(secret).digest());
  return crypto.subtle.importKey("raw", material.buffer.slice(material.byteOffset, material.byteOffset + material.byteLength) as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
}

function bytesFromB64(s: string): Uint8Array {
  const b = Buffer.from(s, "base64");
  const out = new Uint8Array(b.byteLength);
  out.set(b);
  return out;
}

async function decryptSecret(ciphertext: string, ivB64: string): Promise<string> {
  const key = await deriveAesKey();
  const stripped = ciphertext.startsWith("v1:") ? ciphertext.slice(3) : ciphertext;
  const ct = bytesFromB64(stripped);
  const iv = bytesFromB64(ivB64);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  return new TextDecoder().decode(pt);
}

function parseDoc(xml: string): Document {
  const errors: string[] = [];
  const doc = new DOMParser({ onError: (level, msg) => { if (level !== "warning") errors.push(String(msg)); } }).parseFromString(xml, "application/xml") as unknown as Document;
  if (errors.length) throw new Error(`XML parse failed: ${errors.join(" | ")}`);
  return doc;
}

function walk(node: any, pred: (el: any) => boolean): any | null {
  if (node.nodeType === 1 && pred(node)) return node;
  for (let i = 0; i < node.childNodes.length; i++) {
    const found = walk(node.childNodes[i], pred);
    if (found) return found;
  }
  return null;
}

function direct(parent: any, ns: string, localName: string): any | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n.nodeType === 1 && n.namespaceURI === ns && n.localName === localName) return n;
  }
  return null;
}

function textOf(parent: any, ns: string, localName: string): string | null {
  return walk(parent, (el) => el.namespaceURI === ns && el.localName === localName)?.textContent ?? null;
}

function outerXml(node: any): string {
  return new XMLSerializer().serializeToString(node);
}

function sourceOuterXml(xml: string, tagName: string): string | null {
  return xml.match(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`))?.[0] ?? null;
}

function escXml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function signedPropertiesForSigning(signingTime: string, certHash: string, issuer: string, serial: string): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certHash}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${escXml(issuer)}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serial}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;
}

function signedPropertiesForEmbedding(signingTime: string, certHash: string, issuer: string, serial: string): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                <xades:SignedSignatureProperties>
                                    <xades:SigningTime>${signingTime}</xades:SigningTime>
                                    <xades:SigningCertificate>
                                        <xades:Cert>
                                            <xades:CertDigest>
                                                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>
                                                <ds:DigestValue>${certHash}</ds:DigestValue>
                                            </xades:CertDigest>
                                            <xades:IssuerSerial>
                                                <ds:X509IssuerName>${escXml(issuer)}</ds:X509IssuerName>
                                                <ds:X509SerialNumber>${serial}</ds:X509SerialNumber>
                                            </xades:IssuerSerial>
                                        </xades:Cert>
                                    </xades:SigningCertificate>
                                </xades:SignedSignatureProperties>
                            </xades:SignedProperties>`;
}

function escapeRfc4514Value(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\+/g, "\\+")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/;/g, "\\;")
    .replace(/^ /, "\\ ")
    .replace(/ $/, "\\ ")
    .replace(/^#/, "\\#")
    .replace(/=/g, "\\=");
}

const oidShort: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.6": "C",
  "2.5.4.5": "SERIALNUMBER",
  "0.9.2342.19200300.100.1.25": "DC",
};

function joinAttrs(attrs: ReturnType<typeof parseIssuerAttrsFromDer>, reverse: boolean, escaped: boolean): string {
  const xs = reverse ? [...attrs].reverse() : [...attrs];
  return xs.map((a) => `${a.shortName}=${escaped ? escapeRfc4514Value(a.value) : a.value}`).join(", ");
}

function certHashB64Hex(bodyB64: string): string {
  return Buffer.from(createHash("sha256").update(bodyB64).digest("hex"), "ascii").toString("base64");
}

function printBlock(title: string, value: unknown) {
  console.log(`\n===== ${title} =====`);
  if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: keyRow, error: keyError } = await supabase.from("zatca_device_keys").select("compliance_csid_token_encrypted, compliance_csid_iv").eq("id", true).maybeSingle();
  if (keyError) throw new Error(keyError.message);
  if (!keyRow?.compliance_csid_token_encrypted || !keyRow?.compliance_csid_iv) throw new Error("No current compliance CSID certificate found");
  const token = await decryptSecret(String(keyRow.compliance_csid_token_encrypted), String(keyRow.compliance_csid_iv));
  const cert = normalizeCsidToDerAndBody(token);

  const byId = /^[0-9a-f-]{36}$/i.test(TARGET)
    ? await supabase.from("zatca_invoices").select("*").eq("id", TARGET).limit(1)
    : /^[0-9a-f]{8}$/i.test(TARGET)
      ? await supabase.from("zatca_invoices").select("*").gte("id", `${TARGET}-0000-0000-0000-000000000000`).lte("id", `${TARGET}-ffff-ffff-ffff-ffffffffffff`).limit(1)
      : { data: [], error: null } as any;
  let row: any = byId.data?.[0] ?? null;
  let linkedInvoiceNumber: string | null = null;
  if (!row) {
    const inv = await supabase.from("invoices").select("id, invoice_number").eq("invoice_number", TARGET).limit(1);
    if (inv.error) throw new Error(inv.error.message);
    const invoice = inv.data?.[0] as any;
    if (invoice?.id) {
      linkedInvoiceNumber = invoice.invoice_number;
      const z = await supabase.from("zatca_invoices").select("*").eq("invoice_id", invoice.id).limit(1);
      if (z.error) throw new Error(z.error.message);
      row = z.data?.[0] ?? null;
    }
  }
  if (byId.error && !row) throw new Error(byId.error.message);
  if (!row?.signed_xml_b64) throw new Error(`No signed XML found for invoice selector ${TARGET}`);
  const signedXml = Buffer.from(String(row.signed_xml_b64), "base64").toString("utf8");

  const doc = parseDoc(signedXml);
  const sp = walk(doc, (el) => el.namespaceURI === XADES_NS && el.localName === "SignedProperties");
  const ref = walk(doc, (el) => el.namespaceURI === DS_NS && el.localName === "Reference" && el.getAttribute("URI") === "#xadesSignedProperties");
  if (!sp) throw new Error("Embedded xades:SignedProperties not found");
  if (!ref) throw new Error("ds:Reference URI=#xadesSignedProperties not found");

  const signingTime = textOf(sp, XADES_NS, "SigningTime") ?? "";
  const issuerXml = textOf(sp, DS_NS, "X509IssuerName") ?? "";
  const serialXml = textOf(sp, DS_NS, "X509SerialNumber") ?? "";
  const certDigestNode = walk(sp, (el) => el.namespaceURI === XADES_NS && el.localName === "CertDigest");
  const certDigestXml = certDigestNode ? direct(certDigestNode, DS_NS, "DigestValue")?.textContent ?? "" : "";
  const digestValue = direct(ref, DS_NS, "DigestValue")?.textContent ?? "";
  const digestMethod = direct(ref, DS_NS, "DigestMethod")?.getAttribute("Algorithm") ?? "";
  const referenceXml = outerXml(ref);
  const embeddedSpXml = sourceOuterXml(signedXml, "xades:SignedProperties") ?? outerXml(sp);
  const canonicalSpXml = new C14nCanonicalization().process(sp, {});
  const currentTemplate = signedPropertiesForSigning(signingTime, certDigestXml, issuerXml, serialXml);
  const currentDigest = b64FromHexSha256(currentTemplate);
  const rawDigest = b64FromHexSha256(embeddedSpXml);
  const canonicalDigest = b64FromHexSha256(canonicalSpXml);

  const x509 = new X509Certificate(cert.pem);
  const attrs = parseIssuerAttrsFromDer(cert.der);
  const openSslIssuerLines = x509.issuer.split(/\n+/).filter(Boolean);
  const referenceIssuer = openSslIssuerLines.reverse().join(", ");
  const referenceSerial = BigInt(`0x${x509.serialNumber}`).toString(10);
  const referenceCertHash = certHashB64Hex(cert.bodyB64);
  const referenceSpSigning = signedPropertiesForSigning(signingTime, referenceCertHash, referenceIssuer, referenceSerial);
  const referenceSpEmbedded = signedPropertiesForEmbedding(signingTime, referenceCertHash, referenceIssuer, referenceSerial);
  const referenceDigest = b64FromHexSha256(referenceSpSigning);

  const variants = [
    { label: "A_CN_ONLY", issuer: attrs.find((a) => a.shortName === "CN") ? `CN=${escapeRfc4514Value(attrs.find((a) => a.shortName === "CN")!.value)}` : "" },
    { label: "B_NO_REVERSE_UNESCAPED", issuer: joinAttrs(attrs, false, false) },
    { label: "C_REVERSE_UNESCAPED", issuer: joinAttrs(attrs, true, false) },
    { label: "D_REVERSE_RFC4514_ESCAPED", issuer: joinAttrs(attrs, true, true) },
    { label: "E_FULL_CHAIN_OPENSSL_REFERENCE", issuer: referenceIssuer },
  ].map((v) => {
    const spForVariant = signedPropertiesForSigning(signingTime, referenceCertHash, v.issuer, referenceSerial);
    const d = b64FromHexSha256(spForVariant);
    return { ...v, digest_base64_hex_sha256: d.b64Hex, matches_embedded_digest: d.b64Hex === digestValue, matches_reference_digest: d.b64Hex === referenceDigest.b64Hex };
  });

  printBlock("Invoice selector", { target: TARGET, zatca_invoice_id: row.id, linked_invoice_number: linkedInvoiceNumber, status: row.status });
  printBlock("X509IssuerName used in XML", issuerXml);
  printBlock("X509SerialNumber used in XML", serialXml);
  printBlock("Certificate issuer from ASN.1 DER", attrs);
  printBlock("Certificate issuer using OpenSSL RFC2253/RFC4514 style", referenceIssuer);
  printBlock("Current embedded SignedProperties XML", embeddedSpXml);
  printBlock("Current canonicalized SignedProperties XML", canonicalSpXml);
  printBlock("Current embedded DigestValue", digestValue);
  printBlock("Recomputed digest using current method", currentDigest.b64Hex);
  printBlock("Recomputed digest using raw sha256 base64", currentDigest.rawB64);
  printBlock("Recomputed digest using base64(hex(sha256))", currentDigest.b64Hex);
  printBlock("Embedded XML raw sha256/base64 and base64(hex)", { raw_sha256_b64: rawDigest.rawB64, base64_hex_sha256: rawDigest.b64Hex });
  printBlock("Canonical XML raw sha256/base64 and base64(hex)", { raw_sha256_b64: canonicalDigest.rawB64, base64_hex_sha256: canonicalDigest.b64Hex });
  printBlock("Reference URI", ref.getAttribute("URI"));
  printBlock("Reference Type", ref.getAttribute("Type"));
  printBlock("DigestMethod", digestMethod);
  printBlock("SignedProperties Id", sp.getAttribute("Id"));
  printBlock("Reference block", referenceXml);
  printBlock("Issuer variants", variants);
  printBlock("Golden reference comparison", {
    reference_source: "wes4m/zatca-xml-js templates + Node X509Certificate issuer.split('\\n').reverse().join(', ')",
    reference_issuer: referenceIssuer,
    reference_serial: referenceSerial,
    reference_cert_digest: referenceCertHash,
    xml_matches_reference_embedded_signed_properties: embeddedSpXml === referenceSpEmbedded,
    digest_matches_reference: digestValue === referenceDigest.b64Hex,
    current_xml_issuer_matches_reference: issuerXml === referenceIssuer,
    current_xml_serial_matches_reference: serialXml === referenceSerial,
    current_xml_cert_digest_matches_reference: certDigestXml === referenceCertHash,
    reference_digest: referenceDigest.b64Hex,
    current_embedded_digest: digestValue,
  });

  if (embeddedSpXml !== referenceSpEmbedded || digestValue !== referenceDigest.b64Hex) {
    console.error("\nGOLDEN_REFERENCE_TEST_FAILED: SignedProperties XML and DigestValue must match the reference output byte-for-byte.");
    process.exitCode = 1;
  } else {
    console.log("\nGOLDEN_REFERENCE_TEST_PASSED: SignedProperties XML and DigestValue match the reference output.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
