// ZATCA Phase-2 signing pipeline (server-only).
//
// Aligned with the wes4m/zatca-xml-js reference algorithm and the official
// ZATCA SDK templates so ZATCA's server-side re-hash matches ours.
//
// Pipeline:
//   1. Build a canonical UBL Invoice WITHOUT UBLExtensions, WITHOUT
//      <cac:Signature>, and WITHOUT the QR AdditionalDocumentReference.
//      That exact byte sequence is hashed → invoiceHash (base64).
//   2. Build SignedProperties with the same two-template method used by
//      the ZATCA SDK/reference: a signing template is hashed, then a
//      separate after-signing template is embedded.
//   3. SignatureValue = base64(DER(ECDSA-SHA256-sign(privateKey,
//      invoiceHashBytes))). NOTE: ZATCA signs the *invoice hash bytes*
//      directly, not the SignedInfo bytes.
//   4. Build 9-tag Phase-2 QR using the same signature bytes and
//      timestamp.
//   5. Assemble the final XML: <root> + UBLExtensions block (with the
//      "after-signing" SignedProperties template) + body (which now
//      includes the QR AdditionalDocumentReference and a <cac:Signature>
//      element that the XPath transforms exclude from the hash).

import { createHash } from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { C14nCanonicalization } from "xml-crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { parseZatcaCsidToken, zatcaCertDigestB64 } from "./zatca-x509.server";

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
const XMLENC_SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";
// XAdES SignedProperties Reference Type per ETSI TS 101 903 / ZATCA spec.
const XADES_SIGNED_PROPERTIES_TYPE = "http://uri.etsi.org/01903#SignedProperties";
const SIGNED_PROPERTIES_REFERENCE_METHOD = "xml-c14n11-sha256-base64";

export type ZatcaDocKind = "invoice" | "credit_note" | "debit_note";

export interface Phase2InvoiceItem {
  nameAr: string;
  qty: number;
  unitPriceIncVat: number;
}

export interface BuildPhase2Input {
  kind: ZatcaDocKind;
  invoiceNumber: string;
  issueIso: string;
  uuid: string;
  icv: number;
  previousInvoiceHashB64: string;
  vatRate: number;
  seller: {
    nameAr: string;
    vatNumber: string;
    crNumber?: string | null;
    addressStreet?: string | null;
    addressCity?: string | null;
    addressPostal?: string | null;
    addressBuilding?: string | null;
    addressDistrict?: string | null;
  };
  items: Phase2InvoiceItem[];
  originalInvoiceNumber?: string;
  reason?: string;
  csidBinarySecurityToken: string;
  privateKeyHex: string;
  /**
   * Compliance-only escape hatch. When true AND kind === "credit_note",
   * render the document as UBL <Invoice> root with cbc:InvoiceTypeCode 381
   * instead of the standard <CreditNote> root. Workaround for ZATCA SDK 4.0.0
   * QR XPath bug that fails on <CreditNote> root documents. Must NOT be used
   * for real reporting/clearance — only for the simplified-credit-note
   * compliance test step.
   */
  creditNoteAsInvoiceRoot?: boolean;
}

export interface BuildPhase2Output {
  signedXml: string;
  invoiceHashB64: string;
  xmlForHash: string;
  qrBase64: string;
  qrTagCount: number;
  signatureValueB64: string;
  signedPropertiesDigestB64: string;
  certDigestB64: string;
  signingTimeIso: string;
  totals: {
    lineNetSum: number;
    taxExclusive: number;
    taxInclusive: number;
    vat: number;
    payable: number;
  };
  diagnostics: {
    hashInputMethod: string;
    xadesBlockPresent: boolean;
    certLoaded: boolean;
    privateKeyLoaded: boolean;
    issuerDn: string;
    serialDecimal: string;
  };
}

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const r2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

/** Normalize an ISO datetime to ZATCA's strict "YYYY-MM-DDTHH:MM:SSZ". */
function toZatcaIso(iso: string): string {
  // Accept Date.toISOString() ("2026-05-21T08:30:00.123Z") and strip ms.
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}Z`;
}

interface ComputedLine {
  id: number;
  nameAr: string;
  qty: number;
  unitPriceExVat: number;
  lineNetExVat: number;
  lineVat: number;
  lineTotalIncVat: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeLines(items: Phase2InvoiceItem[], vatRate: number): ComputedLine[] {
  // Round EVERY per-line value to 2dp at compute time. The header totals
  // (LineExtensionAmount, TaxableAmount, TaxAmount) are then sums of the
  // already-rounded per-line values, so BR-S-08 / BR-CO-10 / BR-CO-13 all
  // see byte-identical numbers.
  return items.map((it, i) => {
    const unitEx = round2(it.unitPriceIncVat / (1 + vatRate));
    const lineNet = round2(unitEx * it.qty);
    const lineVat = round2(lineNet * vatRate);
    return {
      id: i + 1,
      nameAr: it.nameAr,
      qty: it.qty,
      unitPriceExVat: unitEx,
      lineNetExVat: lineNet,
      lineVat,
      lineTotalIncVat: round2(lineNet + lineVat),
    };
  });
}

/* ───────── Phase-2 TLV QR (9 tags) ───────── */

function tlv(tag: number, value: Uint8Array): Uint8Array {
  const head = new Uint8Array(2 + value.length);
  head[0] = tag;
  head[1] = value.length;
  head.set(value, 2);
  return head;
}

function concatU8(arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export interface Phase2QrInput {
  sellerName: string;
  vatNumber: string;
  isoTimestamp: string;
  totalWithVat: number;
  vatTotal: number;
  invoiceHashB64: string;
  signatureValueBytes: Uint8Array;
  subjectPublicKeyInfoDer: Uint8Array;
  certSignatureValueBytes: Uint8Array;
}

export function buildPhase2Qr(input: Phase2QrInput): { qrBase64: string; tagCount: number } {
  const enc = new TextEncoder();
  const tags: Uint8Array[] = [];
  tags.push(tlv(1, enc.encode(input.sellerName)));
  tags.push(tlv(2, enc.encode(input.vatNumber)));
  tags.push(tlv(3, enc.encode(input.isoTimestamp)));
  tags.push(tlv(4, enc.encode(input.totalWithVat.toFixed(2))));
  tags.push(tlv(5, enc.encode(input.vatTotal.toFixed(2))));
  tags.push(tlv(6, enc.encode(input.invoiceHashB64)));
  tags.push(tlv(7, input.signatureValueBytes));
  tags.push(tlv(8, input.subjectPublicKeyInfoDer));
  tags.push(tlv(9, input.certSignatureValueBytes));
  return { qrBase64: Buffer.from(concatU8(tags)).toString("base64"), tagCount: tags.length };
}

/* ───────── Canonical XML body builder ───────── */

interface BodyBuild {
  rootOpen: string;
  rootClose: string;
  /** Body WITHOUT <cac:Signature> and WITHOUT QR ADR — what we hash. */
  bodyForHash: string;
  /** Body WITH the <cac:Signature> element, ready to receive QR insertion. */
  bodyWithSignature: string;
}

function buildInvoiceBody(
  input: BuildPhase2Input,
  lines: ComputedLine[],
  totals: { lineNetSum: number; vat: number; taxInclusive: number },
): BodyBuild {
  const isCN = input.kind === "credit_note";
  const isDN = input.kind === "debit_note";
  const typeCode = isCN ? "381" : isDN ? "383" : "388";
  const typeName = "0200000";
  // SDK 4.0.0 QR generator throws on <CreditNote> root XPath lookup. When the
  // compliance-only `creditNoteAsInvoiceRoot` flag is set, render the credit
  // note as <Invoice> root (same shape as debit note) with InvoiceTypeCode 381.
  const cnAsInvoice = isCN && input.creditNoteAsInvoiceRoot === true;
  const useCreditRoot = isCN && !cnAsInvoice;
  const rootTag = useCreditRoot ? "CreditNote" : "Invoice";
  const ns = useCreditRoot
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const issueDate = input.issueIso.slice(0, 10);
  const issueTime = input.issueIso.slice(11, 19);
  const vatPct = (input.vatRate * 100).toFixed(2);
  const addr = input.seller;

  const rootOpen = `<${rootTag} xmlns="${ns}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">`;
  const rootClose = `</${rootTag}>`;

  // BR-KSA-56: credit + debit notes must reference an originating invoice.
  const billingRef = (isCN || isDN) && input.originalInvoiceNumber
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(input.originalInvoiceNumber)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>`
    : "";

  const adr = `<cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>${input.icv}</cbc:UUID></cac:AdditionalDocumentReference><cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(input.previousInvoiceHashB64)}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`;

  // <cac:Signature> required by BR-KSA-29/30 — declares the signature ID
  // and signature method ZATCA expects.
  const cacSignature = `<cac:Signature><cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID><cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod></cac:Signature>`;

  const address = `<cac:PostalAddress><cbc:StreetName>${esc(addr.addressStreet ?? "N/A")}</cbc:StreetName><cbc:BuildingNumber>${esc(addr.addressBuilding ?? "0000")}</cbc:BuildingNumber><cbc:CitySubdivisionName>${esc(addr.addressDistrict ?? "N/A")}</cbc:CitySubdivisionName><cbc:CityName>${esc(addr.addressCity ?? "Riyadh")}</cbc:CityName><cbc:PostalZone>${esc(addr.addressPostal ?? "00000")}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`;

  const supplier = `<cac:AccountingSupplierParty><cac:Party>${addr.crNumber ? `<cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(addr.crNumber)}</cbc:ID></cac:PartyIdentification>` : ""}${address}<cac:PartyTaxScheme><cbc:CompanyID>${esc(input.seller.vatNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.seller.nameAr)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>`;

  const customer = `<cac:AccountingCustomerParty><cac:Party><cac:PostalAddress><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyLegalEntity><cbc:RegistrationName>عميل نقدي</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`;

  const paymentMeans = `<cac:PaymentMeans><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>${(isCN || isDN) ? `<cbc:InstructionNote>${esc(input.reason ?? (isCN ? "Refund" : "Debit adjustment"))}</cbc:InstructionNote>` : ""}</cac:PaymentMeans>`;

  // ZATCA with TaxCurrencyCode requires two document-level tax totals:
  // 1) exactly one BG-22 with VAT breakdown (TaxSubtotal), and
  // 2) exactly one TaxTotal without TaxSubtotal for the tax currency amount.
  const taxTotal =
    `<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${r2(totals.vat)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="SAR">${r2(totals.lineNetSum)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="SAR">${r2(totals.vat)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">S</cbc:ID><cbc:Percent>${vatPct}</cbc:Percent><cac:TaxScheme><cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>` +
    `<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${r2(totals.vat)}</cbc:TaxAmount></cac:TaxTotal>`;

  const lmt = `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="SAR">${r2(totals.lineNetSum)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="SAR">${r2(totals.lineNetSum)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="SAR">${r2(totals.taxInclusive)}</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount><cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount><cbc:PayableAmount currencyID="SAR">${r2(totals.taxInclusive)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`;

  const qtyTag = useCreditRoot ? "CreditedQuantity" : "InvoicedQuantity";
  const linesXml = lines
    .map(
      (l) =>
        `<cac:InvoiceLine><cbc:ID>${l.id}</cbc:ID><cbc:${qtyTag} unitCode="PCE">${l.qty}</cbc:${qtyTag}><cbc:LineExtensionAmount currencyID="SAR">${r2(
          l.lineNetExVat,
        )}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${r2(
          l.lineVat,
        )}</cbc:TaxAmount><cbc:RoundingAmount currencyID="SAR">${r2(
          l.lineTotalIncVat,
        )}</cbc:RoundingAmount></cac:TaxTotal><cac:Item><cbc:Name>${esc(
          l.nameAr,
        )}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${vatPct}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="SAR">${r2(
          l.unitPriceExVat,
        )}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`,
    )
    .join("");
  const linesFinal = useCreditRoot ? linesXml.replace(/cac:InvoiceLine/g, "cac:CreditNoteLine") : linesXml;

  const headerCommon =
    `<cbc:ProfileID>reporting:1.0</cbc:ProfileID>` +
    `<cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>` +
    `<cbc:UUID>${esc(input.uuid)}</cbc:UUID>` +
    `<cbc:IssueDate>${issueDate}</cbc:IssueDate>` +
    `<cbc:IssueTime>${issueTime}</cbc:IssueTime>` +
    (useCreditRoot
      ? `<cbc:CreditNoteTypeCode name="${typeName}">${typeCode}</cbc:CreditNoteTypeCode>`
      : `<cbc:InvoiceTypeCode name="${typeName}">${typeCode}</cbc:InvoiceTypeCode>`) +
    `<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>` +
    // BT-6 (BR-KSA-68): TaxCurrencyCode is mandatory.
    `<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>` +
    billingRef +
    adr;

  const tail = supplier + customer + paymentMeans + taxTotal + lmt + linesFinal;

  // For hashing: header + (NO cac:Signature, NO QR ADR) + tail
  const bodyForHash = headerCommon + tail;
  // For final XML: header + cac:Signature + tail (QR ADR inserted later between PIH ADR and cac:Signature)
  const bodyWithSignature = headerCommon + cacSignature + tail;

  return { rootOpen, rootClose, bodyForHash, bodyWithSignature };
}

/* ───────── XAdES SignedProperties template ───────── */

/* ───────── XAdES SignedProperties templates ─────────
 * ZATCA SDK uses TWO byte-distinct templates (matches wes4m/zatca-xml-js):
 *   - "for signing"     : xmlns:ds redeclared inline on every ds:* child,
 *                          indented at 36 spaces. Its bytes are hashed.
 *   - "after signing"   : no xmlns:ds redeclarations, indented at 32 spaces,
 *                          <ds:DigestMethod ...></ds:DigestMethod> (full close).
 *                          This is the form embedded in the final XML.
 * Both indentation and tag forms are byte-significant. Do not unify them.
 */

function buildSignedPropertiesForSigning(
  signingTimeIso: string,
  certDigestB64: string,
  issuerDn: string,
  serialDecimal: string,
): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signingTimeIso}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigestB64}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${esc(issuerDn)}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serialDecimal}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;
}

function buildSignedPropertiesForEmbedding(
  signingTimeIso: string,
  certDigestB64: string,
  issuerDn: string,
  serialDecimal: string,
): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                <xades:SignedSignatureProperties>
                                    <xades:SigningTime>${signingTimeIso}</xades:SigningTime>
                                    <xades:SigningCertificate>
                                        <xades:Cert>
                                            <xades:CertDigest>
                                                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>
                                                <ds:DigestValue>${certDigestB64}</ds:DigestValue>
                                            </xades:CertDigest>
                                            <xades:IssuerSerial>
                                                <ds:X509IssuerName>${esc(issuerDn)}</ds:X509IssuerName>
                                                <ds:X509SerialNumber>${serialDecimal}</ds:X509SerialNumber>
                                            </xades:IssuerSerial>
                                        </xades:Cert>
                                    </xades:SigningCertificate>
                                </xades:SignedSignatureProperties>
                            </xades:SignedProperties>`;
}

function canonicalizeXmlElement(node: any): string {
  // The declared algorithm is C14N 1.1. For this invoice subtree there are no
  // xml:id/xml:base edge cases, so xml-crypto's canonical XML output is byte
  // equivalent and gives us real DOM-based canonicalization instead of a string template.
  return new C14nCanonicalization().process(node, {});
}

function sha256B64AndHex(xml: string): { b64: string; hex: string } {
  // ZATCA quirky encoding: DigestValue = base64( ASCII hex of SHA-256 bytes ).
  const bytes = Buffer.from(xml, "utf8");
  const digest = createHash("sha256").update(bytes).digest();
  const hex = digest.toString("hex");
  return {
    b64: Buffer.from(hex, "utf8").toString("base64"),
    hex,
  };
}

export interface SignedPropertiesDigestDiagnostics {
  signed_properties_raw_xml: string | null;
  signed_properties_canonical_xml: string | null;
  signed_properties_reference_xml: string | null;
  digest_method: string;
  digest_method_algorithm: string | null;
  canonicalization_method: string;
  digest_raw_sha256_b64: string | null;
  digest_raw_sha256_hex: string | null;
  embedded_digest_value: string | null;
  embedded_digest_hex: string | null;
  embedded_digest_algorithm: "raw_sha256_b64";
  reference_uri: string | null;
  reference_type: string | null;
  signed_properties_id_attribute: string | null;
  namespace_declarations_used: string[];
}

function parseXmlDocument(xml: string): any {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level !== "warning") errors.push(String(msg));
    },
  }).parseFromString(xml, "application/xml");
  if (errors.length) throw new Error(`XML parse failed before SignedProperties C14N: ${errors.join(" | ")}`);
  return doc;
}

function walkElements(node: any, visit: (el: any) => boolean | void): any | null {
  if (node.nodeType === 1 && visit(node)) return node;
  for (let i = 0; i < node.childNodes.length; i++) {
    const found = walkElements(node.childNodes[i], visit);
    if (found) return found;
  }
  return null;
}

function firstDirectChild(parent: any, ns: string, localName: string): any | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n.nodeType === 1 && n.namespaceURI === ns && n.localName === localName) {
      return n;
    }
  }
  return null;
}

function namespaceDeclarationsFromCanonicalXml(canonicalXml: string): string[] {
  const open = canonicalXml.match(/^<xades:SignedProperties\s+([^>]*)>/)?.[1] ?? "";
  return (open.match(/xmlns(?::[\w.-]+)?="[^"]*"/g) ?? []).sort();
}

function descendantText(parent: any, ns: string, localName: string): string | null {
  const found = walkElements(parent, (el) => el.namespaceURI === ns && el.localName === localName);
  return found?.textContent ?? null;
}

function getElementOuterXmlFromSource(xml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`);
  return xml.match(re)?.[0] ?? null;
}

function elementOuterXml(node: any): string {
  return new XMLSerializer().serializeToString(node);
}

function computeSignedPropertiesDigestFromXml(signedXml: string): SignedPropertiesDigestDiagnostics {
  const doc = parseXmlDocument(signedXml);
  const signedProperties = walkElements(
    doc,
    (el) => el.namespaceURI === XADES_NS && el.localName === "SignedProperties",
  );
  if (!signedProperties) {
    return {
      signed_properties_raw_xml: null,
      signed_properties_canonical_xml: null,
      signed_properties_reference_xml: null,
      digest_method: `${SIGNED_PROPERTIES_REFERENCE_METHOD} + ${XMLENC_SHA256}`,
      digest_method_algorithm: null,
      canonicalization_method: SIGNED_PROPERTIES_REFERENCE_METHOD,
      digest_raw_sha256_b64: null,
      digest_raw_sha256_hex: null,
      embedded_digest_value: null,
      embedded_digest_hex: null,
      embedded_digest_algorithm: "raw_sha256_b64",
      reference_uri: null,
      reference_type: null,
      signed_properties_id_attribute: null,
      namespace_declarations_used: [],
    };
  }

  const reference = walkElements(
    doc,
    (el) => el.namespaceURI === DS_NS && el.localName === "Reference" && el.getAttribute("URI") === "#xadesSignedProperties",
  );
  const digestMethod = reference ? firstDirectChild(reference, DS_NS, "DigestMethod") : null;
  const digestValue = reference ? firstDirectChild(reference, DS_NS, "DigestValue") : null;

  // ZATCA SDK hashes the RAW "signing template" bytes (xmlns:ds re-declared
  // inline on every ds:* child), NOT a C14N of the embedded node. Reconstruct
  // that exact template from the parsed fields to mirror ZATCA's expectation.
  const signingTime = descendantText(signedProperties, XADES_NS, "SigningTime") ?? "";
  const certDigestVal = descendantText(signedProperties, XADES_NS, "CertDigest") ?? "";
  const issuerName = descendantText(signedProperties, DS_NS, "X509IssuerName") ?? "";
  const serial = descendantText(signedProperties, DS_NS, "X509SerialNumber") ?? "";
  // CertDigest text aggregates DigestMethod + DigestValue text; we need only DigestValue.
  const certDigestNode = walkElements(signedProperties, (el) => el.namespaceURI === XADES_NS && el.localName === "CertDigest");
  const certDigestB64Only = certDigestNode ? (firstDirectChild(certDigestNode, DS_NS, "DigestValue")?.textContent ?? certDigestVal) : certDigestVal;
  const signingTemplate = buildSignedPropertiesForSigning(signingTime, certDigestB64Only, issuerName.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"), serial);
  const digest = sha256B64AndHex(signingTemplate);
  const embeddedDigest = digestValue?.textContent ?? null;

  return {
    signed_properties_raw_xml:
      elementOuterXml(signedProperties) ?? getElementOuterXmlFromSource(signedXml, "xades:SignedProperties"),
    signed_properties_canonical_xml: signingTemplate,
    signed_properties_reference_xml: reference ? elementOuterXml(reference) : null,
    digest_method: `raw-signing-template-sha256-base64 + ${XMLENC_SHA256}`,
    digest_method_algorithm: digestMethod?.getAttribute("Algorithm") ?? null,
    canonicalization_method: "raw-signing-template-sha256-base64",
    digest_raw_sha256_b64: digest.b64,
    digest_raw_sha256_hex: digest.hex,
    embedded_digest_value: embeddedDigest,
    embedded_digest_hex: embeddedDigest ? Buffer.from(embeddedDigest, "base64").toString("hex") : null,
    embedded_digest_algorithm: "raw_sha256_b64",
    reference_uri: reference?.getAttribute("URI") ?? null,
    reference_type: reference?.getAttribute("Type") ?? null,
    signed_properties_id_attribute: signedProperties.getAttribute("Id"),
    namespace_declarations_used: ['xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"'],
  };
}

export function getSignedPropertiesDebugProof(signedXml: string) {
  const proof = computeSignedPropertiesDigestFromXml(signedXml);
  return {
    reference_uri: proof.reference_uri,
    reference_type: proof.reference_type,
    digest_method: proof.digest_method,
    digest_method_algorithm: proof.digest_method_algorithm,
    digest_value: proof.embedded_digest_value,
    signed_properties_id: proof.signed_properties_id_attribute,
    canonicalization_method: proof.canonicalization_method,
    canonical_xml: proof.signed_properties_canonical_xml,
    calculated_digest: proof.digest_raw_sha256_b64,
    calculated_digest_hex: proof.digest_raw_sha256_hex,
    embedded_digest: proof.embedded_digest_value,
    embedded_digest_hex: proof.embedded_digest_hex,
    reference_xml: proof.signed_properties_reference_xml,
    signed_properties_raw_xml: proof.signed_properties_raw_xml,
    namespace_declarations_used: proof.namespace_declarations_used,
    reference_type_is_correct: proof.reference_type === XADES_SIGNED_PROPERTIES_TYPE,
    digests_equal: !!proof.embedded_digest_value && proof.embedded_digest_value === proof.digest_raw_sha256_b64,
  };
}

/* ───────── UBLExtensions block ───────── */

function buildSignedInfoBlock(invoiceHashB64: string, signedPropertiesHashB64: string): string {
  return `<ds:SignedInfo>
                            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                            <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                            <ds:Reference Id="invoiceSignedData" URI="">
                                <ds:Transforms>
                                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                </ds:Transforms>
                                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                <ds:DigestValue>${invoiceHashB64}</ds:DigestValue>
                            </ds:Reference>
                            <ds:Reference URI="#xadesSignedProperties" Type="${XADES_SIGNED_PROPERTIES_TYPE}">
                                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                <ds:DigestValue>${signedPropertiesHashB64}</ds:DigestValue>
                            </ds:Reference>
                        </ds:SignedInfo>`;
}

function buildUblExtensionsBlock(args: {
  invoiceHashB64: string;
  signedPropertiesHashB64: string;
  signatureValueB64: string;
  certPemBodyBase64: string;
  signedPropertiesEmbedded: string;
}): string {
  return `<ext:UBLExtensions>
    <ext:UBLExtension>
        <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
        <ext:ExtensionContent>
            <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                <sac:SignatureInformation>
                    <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                    <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                    <ds:Signature Id="signature" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                        ${buildSignedInfoBlock(args.invoiceHashB64, args.signedPropertiesHashB64)}
                        <ds:SignatureValue>${args.signatureValueB64}</ds:SignatureValue>
                        <ds:KeyInfo>
                            <ds:X509Data>
                                <ds:X509Certificate>${args.certPemBodyBase64}</ds:X509Certificate>
                            </ds:X509Data>
                        </ds:KeyInfo>
                        <ds:Object>
                            <xades:QualifyingProperties Target="signature" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
                                ${args.signedPropertiesEmbedded}
                            </xades:QualifyingProperties>
                        </ds:Object>
                    </ds:Signature>
                </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>
        </ext:ExtensionContent>
    </ext:UBLExtension>
</ext:UBLExtensions>`;
}

function signedPropertiesIndentationFix(signedInvoiceXml: string): string {
  const objectStart = "<ds:Object>";
  const objectEnd = "</ds:Object>";
  if (!signedInvoiceXml.includes(objectStart) || !signedInvoiceXml.includes(objectEnd)) return signedInvoiceXml;
  const objectBody = signedInvoiceXml.split(objectStart)[1]?.split(objectEnd)[0];
  if (!objectBody) return signedInvoiceXml;
  const originalLines = objectBody.split("\n");
  const fixedLines = originalLines.map((line) => (line.startsWith("    ") ? line.slice(4) : line));
  // Preserve the closing </ds:Object> indentation exactly like the reference implementation.
  const originalInner = originalLines.slice(0, -1).join("\n");
  const fixedInner = fixedLines.slice(0, -1).join("\n");
  return originalInner ? signedInvoiceXml.replace(originalInner, fixedInner) : signedInvoiceXml;
}

/* ───────── ECDSA helpers ───────── */

/**
 * XMLDSig signing primitive: SignatureValue signs canonicalized ds:SignedInfo.
 */
function ecdsaSignUtf8(
  privateKeyHex: string,
  payload: string,
): { derBytes: Uint8Array; b64: string } {
  const sk = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const digest = sha256(Uint8Array.from(Buffer.from(payload, "utf8")));
  const sig: any = secp256k1.sign(digest, sk, { prehash: false });
  const compact: Uint8Array =
    sig instanceof Uint8Array
      ? sig
      : sig.toBytes?.("compact") ?? sig.toCompactRawBytes?.();
  const r = BigInt("0x" + Buffer.from(compact.slice(0, 32)).toString("hex"));
  const s = BigInt("0x" + Buffer.from(compact.slice(32, 64)).toString("hex"));
  const derInt = (n: bigint) => {
    const bytes: number[] = [];
    let v = n;
    if (v === 0n) bytes.push(0);
    else
      while (v > 0n) {
        bytes.unshift(Number(v & 0xffn));
        v >>= 8n;
      }
    if (bytes[0] & 0x80) bytes.unshift(0);
    return new Uint8Array([0x02, bytes.length, ...bytes]);
  };
  const rd = derInt(r);
  const sd = derInt(s);
  const seq = new Uint8Array([0x30, rd.length + sd.length, ...rd, ...sd]);
  return { derBytes: seq, b64: Buffer.from(seq).toString("base64") };
}

function ecdsaSignBytesSha256(
  privateKeyHex: string,
  payload: Uint8Array,
): { derBytes: Uint8Array; b64: string } {
  const sk = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const digest = sha256(payload);
  const sig: any = secp256k1.sign(digest, sk, { prehash: false });
  const compact: Uint8Array =
    sig instanceof Uint8Array
      ? sig
      : sig.toBytes?.("compact") ?? sig.toCompactRawBytes?.();
  const r = BigInt("0x" + Buffer.from(compact.slice(0, 32)).toString("hex"));
  const s = BigInt("0x" + Buffer.from(compact.slice(32, 64)).toString("hex"));
  const derInt = (n: bigint) => {
    const bytes: number[] = [];
    let v = n;
    if (v === 0n) bytes.push(0);
    else
      while (v > 0n) {
        bytes.unshift(Number(v & 0xffn));
        v >>= 8n;
      }
    if (bytes[0] & 0x80) bytes.unshift(0);
    return new Uint8Array([0x02, bytes.length, ...bytes]);
  };
  const rd = derInt(r);
  const sd = derInt(s);
  const seq = new Uint8Array([0x30, rd.length + sd.length, ...rd, ...sd]);
  return { derBytes: seq, b64: Buffer.from(seq).toString("base64") };
}

function canonicalSignedInfoXml(invoiceHashB64: string, signedPropertiesHashB64: string): string {
  const doc = parseXmlDocument(`<ds:Signature xmlns:ds="${DS_NS}">${buildSignedInfoBlock(invoiceHashB64, signedPropertiesHashB64)}</ds:Signature>`);
  const signedInfo = walkElements(doc, (el) => el.namespaceURI === DS_NS && el.localName === "SignedInfo");
  if (!signedInfo) throw new Error("Unable to canonicalize ds:SignedInfo.");
  return canonicalizeXmlElement(signedInfo);
}

/* ───────── Main entrypoint ───────── */

export function buildPhase2SignedInvoice(input: BuildPhase2Input): BuildPhase2Output {
  // 0) Normalize timestamps to ZATCA strict ISO. Re-write issueIso so
  //    that IssueDate / IssueTime / SigningTime / QR Tag 3 are all
  //    derived from the SAME canonical timestamp.
  const signingTimeIso = toZatcaIso(input.issueIso);
  const normalizedInput: BuildPhase2Input = { ...input, issueIso: signingTimeIso };

  const lines = computeLines(normalizedInput.items, normalizedInput.vatRate);
  // Header totals = sums of per-line ROUNDED values (BR-S-08, BR-CO-10, BR-CO-13).
  const lineNetSum = round2(lines.reduce((s, l) => s + l.lineNetExVat, 0));
  const vat = round2(lines.reduce((s, l) => s + l.lineVat, 0));
  const taxInclusive = round2(lineNetSum + vat);

  // 1) Build body with and without cac:Signature.
  const { rootOpen, rootClose, bodyForHash, bodyWithSignature } = buildInvoiceBody(
    normalizedInput,
    lines,
    { lineNetSum, vat, taxInclusive },
  );

  // 2) Invoice hash = SHA-256 of the no-UBLExt/no-Sig/no-QR canonical XML.
  const xmlForHash = rootOpen + bodyForHash + rootClose;
  const invoiceHashB64 = createHash("sha256").update(xmlForHash).digest("base64");

  // 3) Parse cert + compute cert digest.
  const cert = parseZatcaCsidToken(normalizedInput.csidBinarySecurityToken);
  const certDigestB64 = zatcaCertDigestB64(cert.certPemBodyBase64);

  // 4) Build TWO SignedProperties forms (ZATCA SDK convention):
  //    - "signing" template: with xmlns:ds redeclared inline on every ds:* child.
  //      Its RAW UTF-8 bytes (with the SDK's exact indentation) are hashed.
  //      This is what ZATCA's reference Java SDK does — no C14N involved.
  //    - "embedded" template: ds:* children inherit xmlns:ds from the parent
  //      ds:Signature scope (no inline redeclaration). This is what's embedded
  //      in the final XML.
  const spForSigning = buildSignedPropertiesForSigning(
    signingTimeIso,
    certDigestB64,
    cert.issuerDnString,
    cert.serialNumberDecimal,
  );
  const spEmbedded = buildSignedPropertiesForEmbedding(
    signingTimeIso,
    certDigestB64,
    cert.issuerDnString,
    cert.serialNumberDecimal,
  );

  // 5) SignedProperties digest = SHA-256(base64) over the RAW signing-template bytes.
  const { b64: signedPropertiesHashB64 } = sha256B64AndHex(spForSigning);

  // 6) ZATCA cryptographic stamp signs the invoice hash bytes, matching the
  // official SDK / wes4m reference implementation.
  const sig = ecdsaSignBytesSha256(normalizedInput.privateKeyHex, Buffer.from(invoiceHashB64, "base64"));

  // 7) Build the Phase-2 QR. ZATCA's SDK/reference encodes tag 7 as the
  //    UTF-8 bytes of the base64 SignatureValue string embedded in XML.
  const qrSignatureBytes = Uint8Array.from(Buffer.from(sig.b64, "utf8"));
  const qr = buildPhase2Qr({
    sellerName: normalizedInput.seller.nameAr,
    vatNumber: normalizedInput.seller.vatNumber,
    isoTimestamp: signingTimeIso,
    totalWithVat: taxInclusive,
    vatTotal: vat,
    invoiceHashB64,
    signatureValueBytes: qrSignatureBytes,
    subjectPublicKeyInfoDer: cert.subjectPublicKeyInfoDer,
    certSignatureValueBytes: cert.signatureValueBytes,
  });

  // 8) Insert QR ADR right after the PIH ADR in the with-signature body.
  const qrAdr = `<cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(qr.qrBase64)}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`;
  const sigMarker = `<cac:Signature>`;
  const sigIdx = bodyWithSignature.indexOf(sigMarker);
  const bodyWithQr =
    sigIdx >= 0
      ? bodyWithSignature.slice(0, sigIdx) + qrAdr + bodyWithSignature.slice(sigIdx)
      : bodyWithSignature + qrAdr;

  // 9) UBLExtensions block — includes SignedInfo with both digests,
  //    SignatureValue, certificate, and the after-signing SignedProperties
  //    block corresponding to the signing-template digest above.
  const ublExt = buildUblExtensionsBlock({
    invoiceHashB64,
    signedPropertiesHashB64,
    signatureValueB64: sig.b64,
    certPemBodyBase64: cert.certPemBodyBase64,
    signedPropertiesEmbedded: spEmbedded,
  });

  // 10) Final XML: <root>UBLExtensions + body</root>
  const signedXml = rootOpen + ublExt + bodyWithQr + rootClose;

  return {
    signedXml,
    invoiceHashB64,
    xmlForHash,
    qrBase64: qr.qrBase64,
    qrTagCount: qr.tagCount,
    signatureValueB64: sig.b64,
    signedPropertiesDigestB64: signedPropertiesHashB64,
    certDigestB64,
    signingTimeIso,
    totals: {
      lineNetSum: +r2(lineNetSum),
      taxExclusive: +r2(lineNetSum),
      taxInclusive: +r2(taxInclusive),
      vat: +r2(vat),
      payable: +r2(taxInclusive),
    },
    diagnostics: {
      hashInputMethod: "ZATCA-transform(no-UBLExt,no-Signature,no-QR-ADR) + manual-canonical",
      xadesBlockPresent: true,
      certLoaded: true,
      privateKeyLoaded: true,
      issuerDn: cert.issuerDnString,
      serialDecimal: cert.serialNumberDecimal,
    },
  };
}

/* ───────── Unsigned-XML builder (for external SDK signing) ─────────
 *
 * Produces the canonical UBL invoice XML BEFORE signing. Contains:
 *   • <cac:Signature> element (BR-KSA-29/30)
 *   • PIH + ICV AdditionalDocumentReference
 *   • NO UBLExtensions block
 *   • NO QR AdditionalDocumentReference
 *
 * This is the exact shape the official ZATCA Java SDK's
 *   com.gazt.einvoicing.signing.service.impl.SigningServiceImpl.signDocument(...)
 * accepts. The SDK injects UBLExtensions and the QR ADR itself.
 *
 * Does NOT require a private key — only the invoice payload + PIH.
 * csidBinarySecurityToken and privateKeyHex on BuildPhase2Input are ignored.
 */
export function buildPhase2UnsignedInvoice(
  input: Omit<BuildPhase2Input, "csidBinarySecurityToken" | "privateKeyHex" | "issueIso"> & {
    issueIso?: string;
    /** Preferred input: a single Date used verbatim (floored to whole seconds, UTC) for IssueDate/IssueTime. */
    issueDateTime?: Date;
  },
): { unsignedXml: string; signingTimeIso: string; icv: number; uuid: string; pihB64: string; issueDateTime: Date } {
  // KSA-25 fix: ONE single timestamp value drives IssueDate, IssueTime, and any
  // downstream signing/QR timestamp derived from invoice issue time.
  // Never call new Date() in multiple places in this path.
  const rawDate = input.issueDateTime
    ? input.issueDateTime
    : input.issueIso
      ? new Date(input.issueIso)
      : new Date();
  // Floor to whole seconds (strip milliseconds) so IssueDate/IssueTime/QR Tag 3
  // and any caller-derived invoiceNumber all share the exact same second.
  const issueDateTime = new Date(Math.floor(rawDate.getTime() / 1000) * 1000);
  const signingTimeIso = toZatcaIso(issueDateTime.toISOString());

  const normalized = { ...input, issueIso: signingTimeIso } as BuildPhase2Input;
  const lines = computeLines(normalized.items, normalized.vatRate);
  const lineNetSum = round2(lines.reduce((s, l) => s + l.lineNetExVat, 0));
  const vat = round2(lines.reduce((s, l) => s + l.lineVat, 0));
  const taxInclusive = round2(lineNetSum + vat);
  const { rootOpen, rootClose, bodyWithSignature } = buildInvoiceBody(
    normalized,
    lines,
    { lineNetSum, vat, taxInclusive },
  );
  const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?>` + rootOpen + bodyWithSignature + rootClose;
  return {
    unsignedXml,
    signingTimeIso,
    icv: normalized.icv,
    uuid: normalized.uuid,
    pihB64: normalized.previousInvoiceHashB64,
    issueDateTime,
  };
}

/* ───────── Local validation gate ───────── */

export interface Phase2ValidationIssue { code: string; message: string; }

export function validatePhase2(
  signedXml: string,
  output: BuildPhase2Output,
  opts: {
    environment: "simulation" | "production";
    endpoint: string;
    kind: ZatcaDocKind;
    qrPayloadB64: string;
  },
): Phase2ValidationIssue[] {
  const report = validatePhase2FromSignedXml({
    signedXml,
    qrPayloadB64: opts.qrPayloadB64,
    environment: opts.environment,
    endpoint: opts.endpoint,
    kind: opts.kind,
  });
  // Cross-check internal hash invariant.
  const recompute = createHash("sha256").update(output.xmlForHash).digest("base64");
  if (recompute !== output.invoiceHashB64) {
    report.issues.push({ code: "HASH_MISMATCH", message: "Invoice hash does not match canonical xmlForHash." });
  }
  return report.issues;
}

/* ───────── Final-XML diagnostic validator (proof-by-bytes) ───────── */

export interface Phase2Diagnostics {
  local_validation_passed: boolean;
  validation_source: "final_signed_xml/final_qr";
  xml_signature_value_b64: string | null;
  qr_tag7_signature_b64: string | null;
  xml_signature_value_hex: string | null;
  qr_tag7_signature_hex: string | null;
  are_signature_bytes_equal: boolean;
  signed_properties_canonical_b64: string | null;
  signed_properties_raw_b64: string | null;
  signed_properties_reference_xml: string | null;
  signed_properties_reference_b64: string | null;
  signed_properties_digest_method: string | null;
  signed_properties_digest_method_algorithm: string | null;
  signed_properties_canonicalization_method: string | null;
  signed_properties_digest_expected_b64: string | null;
  signed_properties_digest_actual_b64: string | null;
  signed_properties_digest_actual_hex: string | null;
  signed_properties_digest_expected_hex: string | null;
  signed_properties_reference_uri: string | null;
  signed_properties_reference_type: string | null;
  signed_properties_id_attribute: string | null;
  signed_properties_namespace_declarations_used: string[];
  are_signed_properties_digests_equal: boolean;
  xml_issue_date: string | null;
  xml_issue_time: string | null;
  expected_qr_timestamp: string | null;
  actual_qr_tag3: string | null;
  are_timestamps_equal: boolean;
  qr_tag_count: number;
  tax_currency_code: string | null;
  document_tax_total_count: number;
  document_tax_total_with_subtotal_count: number;
  tax_total_structure_ok: boolean;
}

export interface Phase2ValidationReport {
  issues: Phase2ValidationIssue[];
  diagnostics: Phase2Diagnostics;
}

function extractFirst(re: RegExp, s: string): string | null {
  const m = s.match(re);
  return m ? m[1] : null;
}

function walkQrTlv(qrB64: string): { tags: Map<number, Buffer>; count: number } {
  const buf = Buffer.from(qrB64, "base64");
  const tags = new Map<number, Buffer>();
  let i = 0;
  let count = 0;
  while (i + 2 <= buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    if (i + 2 + len > buf.length) break;
    tags.set(tag, Buffer.from(buf.subarray(i + 2, i + 2 + len)));
    count++;
    i += 2 + len;
  }
  return { tags, count };
}

/**
 * Re-derive every signature/digest/timestamp from the FINAL signed XML
 * and the FINAL QR string. Compares them byte-for-byte and returns both
 * the issue list and a numeric diagnostic block (base64-encoded) so the
 * UI / logs can prove equality before any submission to ZATCA.
 */
export function validatePhase2FromSignedXml(opts: {
  signedXml: string;
  qrPayloadB64: string;
  environment: "simulation" | "production";
  endpoint: string;
  kind: ZatcaDocKind;
}): Phase2ValidationReport {
  const issues: Phase2ValidationIssue[] = [];
  const { signedXml, qrPayloadB64 } = opts;

  // ── Structural presence
  if (!signedXml.includes("<ext:UBLExtensions")) issues.push({ code: "MISSING_UBLEXT", message: "UBLExtensions block missing." });
  if (!signedXml.includes("<ds:Signature")) issues.push({ code: "MISSING_DS_SIGNATURE", message: "ds:Signature block missing." });
  if (!signedXml.includes("<xades:SignedProperties")) issues.push({ code: "MISSING_XADES", message: "XAdES SignedProperties missing." });
  if (!signedXml.includes("<ds:X509Certificate>")) issues.push({ code: "MISSING_CERT", message: "Signing certificate not embedded." });
  if (!signedXml.includes("<cbc:ID>QR</cbc:ID>")) issues.push({ code: "MISSING_QR_ADR", message: "QR AdditionalDocumentReference missing." });

  // Type
  if (opts.kind === "invoice" && !/<cbc:InvoiceTypeCode name="0200000">388<\/cbc:InvoiceTypeCode>/.test(signedXml)) {
    issues.push({ code: "INVOICE_TYPE", message: "Invoice type must be Simplified (0200000 / 388)." });
  }
  if (opts.kind === "credit_note" && !/<cbc:CreditNoteTypeCode name="0200000">381<\/cbc:CreditNoteTypeCode>/.test(signedXml)) {
    issues.push({ code: "INVOICE_TYPE", message: "Credit note type must be Simplified (0200000 / 381)." });
  }
  if (opts.kind === "debit_note" && !/<cbc:InvoiceTypeCode name="0200000">383<\/cbc:InvoiceTypeCode>/.test(signedXml)) {
    issues.push({ code: "INVOICE_TYPE", message: "Debit note type must be Simplified (0200000 / 383)." });
  }

  // ── Pull canonical fragments from the FINAL XML
  const xmlSignatureValueB64 = extractFirst(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/, signedXml);
  const xmlIssueDate = extractFirst(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/, signedXml);
  const xmlIssueTime = extractFirst(/<cbc:IssueTime>([^<]+)<\/cbc:IssueTime>/, signedXml);

  // SignedProperties digest re-derived from the final XML values by
  // reconstructing the SDK signing template, then compared with the
  // DigestValue beside the #xadesSignedProperties reference.
  const spDigestExpectedB64 = extractFirst(
    /<ds:Reference[^>]*URI="#xadesSignedProperties"[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/,
    signedXml,
  );
  let spDigestActualB64: string | null = null;
  let spCanonicalB64: string | null = null;
  let spRawB64: string | null = null;
  let spReferenceXml: string | null = null;
  let spReferenceB64: string | null = null;
  let spDigestMethod: string | null = null;
  let spDigestMethodAlgorithm: string | null = null;
  let spCanonicalizationMethod: string | null = null;
  let spDigestActualHex: string | null = null;
  let spDigestExpectedHex: string | null = null;
  let spReferenceUri: string | null = null;
  let spReferenceType: string | null = null;
  let spIdAttribute: string | null = null;
  let spNamespacesUsed: string[] = [];
  try {
    const spDigestDiag = computeSignedPropertiesDigestFromXml(signedXml);
    spRawB64 = spDigestDiag.signed_properties_raw_xml
      ? Buffer.from(spDigestDiag.signed_properties_raw_xml, "utf8").toString("base64")
      : null;
    spReferenceXml = spDigestDiag.signed_properties_reference_xml;
    spReferenceB64 = spDigestDiag.signed_properties_reference_xml
      ? Buffer.from(spDigestDiag.signed_properties_reference_xml, "utf8").toString("base64")
      : null;
    spCanonicalB64 = spDigestDiag.signed_properties_canonical_xml
      ? Buffer.from(spDigestDiag.signed_properties_canonical_xml, "utf8").toString("base64")
      : null;
    spDigestMethod = spDigestDiag.digest_method;
    spDigestMethodAlgorithm = spDigestDiag.digest_method_algorithm;
    spDigestActualB64 = spDigestDiag.digest_raw_sha256_b64;
    spCanonicalizationMethod = spDigestDiag.canonicalization_method;
    spDigestActualHex = spDigestDiag.digest_raw_sha256_hex;
    spDigestExpectedHex = spDigestDiag.embedded_digest_hex;
    spReferenceUri = spDigestDiag.reference_uri;
    spReferenceType = spDigestDiag.reference_type;
    spIdAttribute = spDigestDiag.signed_properties_id_attribute;
    spNamespacesUsed = spDigestDiag.namespace_declarations_used;
  } catch (e: any) {
    issues.push({ code: "SP_DIGEST_REBUILD_FAILED", message: e?.message ?? "Unable to rebuild SignedProperties signing template from final XML." });
  }

  // ── QR breakdown (final string only)
  const { tags: qrTags, count: qrTagCount } = walkQrTlv(qrPayloadB64);
  const tag3 = qrTags.get(3);
  const tag7 = qrTags.get(7);
  const qrTag3 = tag3 ? tag3.toString("utf8") : null;
  const qrTag7B64 = tag7 ? tag7.toString("base64") : null;
  const xmlSigBytes = xmlSignatureValueB64 ? Buffer.from(xmlSignatureValueB64, "utf8") : null;
  const qrTag7Hex = tag7 ? tag7.toString("hex") : null;
  const xmlSigHex = xmlSigBytes ? xmlSigBytes.toString("hex") : null;
  const areSignatureBytesEqual = !!xmlSigBytes && !!tag7 && tag7.equals(xmlSigBytes);
  const areSignedPropertiesDigestsEqual = !!spDigestExpectedB64 && !!spDigestActualB64 && spDigestExpectedB64 === spDigestActualB64;
  const expectedTimestamp = xmlIssueDate && xmlIssueTime ? `${xmlIssueDate}T${xmlIssueTime.endsWith("Z") ? xmlIssueTime : `${xmlIssueTime}Z`}` : null;
  const areTimestampsEqual = !!expectedTimestamp && !!qrTag3 && qrTag3 === expectedTimestamp;

  const taxCurrencyCode = extractFirst(/<cbc:TaxCurrencyCode>([^<]+)<\/cbc:TaxCurrencyCode>/, signedXml);
  const beforeLegalTotal = signedXml.split("<cac:LegalMonetaryTotal>")[0] ?? signedXml;
  const documentTaxTotalBlocks = beforeLegalTotal.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g) ?? [];
  const documentTaxTotalWithSubtotalCount = documentTaxTotalBlocks.filter((b) => b.includes("<cac:TaxSubtotal>")).length;
  const documentTaxTotalWithoutSubtotalCount = documentTaxTotalBlocks.length - documentTaxTotalWithSubtotalCount;
  const taxTotalStructureOk = !taxCurrencyCode || (documentTaxTotalWithSubtotalCount === 1 && documentTaxTotalWithoutSubtotalCount === 1);

  // ── Cross-checks
  if (qrTagCount !== 9) issues.push({ code: "QR_TAGS", message: `QR must have 9 tags (got ${qrTagCount}).` });

  // 1. QR Tag 7 ↔ ds:SignatureValue (byte-equal UTF-8 base64 string, matching ZATCA SDK).
  if (xmlSignatureValueB64 && tag7) {
    if (!areSignatureBytesEqual) {
      issues.push({
        code: "QR_SIG_MISMATCH",
        message: `QR Tag 7 != ds:SignatureValue. xml_sig_b64=${xmlSignatureValueB64.slice(0, 40)}… qr_tag7_b64=${qrTag7B64?.slice(0, 40)}…`,
      });
    }
  } else {
    if (!xmlSignatureValueB64) issues.push({ code: "MISSING_SIG_VALUE", message: "ds:SignatureValue not found in final XML." });
    if (!tag7) issues.push({ code: "MISSING_QR_TAG7", message: "QR Tag 7 not present in final QR." });
  }

  // 2. SignedProperties digest: expected (inside SignedInfo) == actual recomputed.
  if (spReferenceUri !== "#xadesSignedProperties") {
    issues.push({ code: "SIGNED_PROPS_REFERENCE_URI", message: `SignedProperties Reference URI must be #xadesSignedProperties (got ${spReferenceUri ?? "missing"}).` });
  }
  if (spReferenceType !== XADES_SIGNED_PROPERTIES_TYPE) {
    issues.push({ code: "SIGNED_PROPS_REFERENCE_TYPE", message: `SignedProperties Reference Type must be ${XADES_SIGNED_PROPERTIES_TYPE} (got ${spReferenceType ?? "missing"}).` });
  }
  if (spDigestMethodAlgorithm !== XMLENC_SHA256) {
    issues.push({ code: "SIGNED_PROPS_DIGEST_METHOD", message: `SignedProperties DigestMethod must be ${XMLENC_SHA256} (got ${spDigestMethodAlgorithm ?? "missing"}).` });
  }
  if (spIdAttribute !== "xadesSignedProperties") {
    issues.push({ code: "SIGNED_PROPS_ID", message: `SignedProperties Id must be xadesSignedProperties (got ${spIdAttribute ?? "missing"}).` });
  }
  if (spDigestExpectedB64 && spDigestActualB64) {
    if (spDigestExpectedB64 !== spDigestActualB64) {
      issues.push({
        code: "SIGNED_PROPS_DIGEST_DRIFT",
        message: `SignedProperties digest mismatch. expected=${spDigestExpectedB64.slice(0, 40)}… actual=${spDigestActualB64.slice(0, 40)}…`,
      });
    }
  } else {
    if (!spDigestExpectedB64) issues.push({ code: "MISSING_SP_DIGEST_REF", message: "DigestValue for #xadesSignedProperties not found." });
    if (!spDigestActualB64) issues.push({ code: "MISSING_SP_BLOCK", message: "xades:SignedProperties element not found in final XML." });
  }

  // 3. QR Tag 3 timestamp == IssueDate+'T'+IssueTime+'Z'
  let expectedQrTs: string | null = null;
  if (xmlIssueDate && xmlIssueTime) {
    expectedQrTs = expectedTimestamp;
    if (qrTag3 && qrTag3 !== expectedQrTs) {
      issues.push({
        code: "QR_TIMESTAMP_MISMATCH",
        message: `QR Tag 3 (${qrTag3}) != IssueDate/Time (${expectedQrTs}).`,
      });
    }
  }

  // Environment ↔ endpoint sanity.
  if (!taxTotalStructureOk) {
    issues.push({
      code: "TAX_TOTAL_STRUCTURE",
      message: `When TaxCurrencyCode exists, document-level TaxTotal must include exactly one subtotal breakdown and exactly one tax-currency total without subtotal (count=${documentTaxTotalBlocks.length}, with_subtotal=${documentTaxTotalWithSubtotalCount}, without_subtotal=${documentTaxTotalWithoutSubtotalCount}).`,
    });
  }

  const isSim = opts.endpoint.includes("/simulation/");
  if (opts.environment === "simulation" && !isSim) {
    issues.push({ code: "ENV_MISMATCH", message: `Simulation env must use simulation endpoint (got ${opts.endpoint}).` });
  }

  return {
    issues,
    diagnostics: {
      local_validation_passed: issues.length === 0,
      validation_source: "final_signed_xml/final_qr",
      xml_signature_value_b64: xmlSignatureValueB64,
      qr_tag7_signature_b64: qrTag7B64,
      xml_signature_value_hex: xmlSigHex,
      qr_tag7_signature_hex: qrTag7Hex,
      are_signature_bytes_equal: areSignatureBytesEqual,
      signed_properties_canonical_b64: spCanonicalB64,
      signed_properties_raw_b64: spRawB64,
      signed_properties_reference_xml: spReferenceXml,
      signed_properties_reference_b64: spReferenceB64,
      signed_properties_digest_method: spDigestMethod,
      signed_properties_digest_method_algorithm: spDigestMethodAlgorithm,
      signed_properties_canonicalization_method: spCanonicalizationMethod,
      signed_properties_digest_expected_b64: spDigestExpectedB64,
      signed_properties_digest_actual_b64: spDigestActualB64,
      signed_properties_digest_actual_hex: spDigestActualHex,
      signed_properties_digest_expected_hex: spDigestExpectedHex,
      signed_properties_reference_uri: spReferenceUri,
      signed_properties_reference_type: spReferenceType,
      signed_properties_id_attribute: spIdAttribute,
      signed_properties_namespace_declarations_used: spNamespacesUsed,
      are_signed_properties_digests_equal: areSignedPropertiesDigestsEqual,
      xml_issue_date: xmlIssueDate,
      xml_issue_time: xmlIssueTime,
      expected_qr_timestamp: expectedQrTs,
      actual_qr_tag3: qrTag3,
      are_timestamps_equal: areTimestampsEqual,
      qr_tag_count: qrTagCount,
      tax_currency_code: taxCurrencyCode,
      document_tax_total_count: documentTaxTotalBlocks.length,
      document_tax_total_with_subtotal_count: documentTaxTotalWithSubtotalCount,
      tax_total_structure_ok: taxTotalStructureOk,
    },
  };
}
