// ZATCA UBL 2.1 Simplified Tax Invoice / Credit Note builder (server-only).
//
// Produces a structurally-correct UBL invoice with strict element order
// per ZATCA Phase 2 spec. Handles:
//   • InvoiceTypeCode 388 (invoice) / 381 (credit note), name="0200000"
//     (Simplified) for POS B2C.
//   • AdditionalDocumentReference blocks for ICV (KSA-16), PIH, and QR.
//   • Per-line classified tax category (S, 15%, VAT) + per-line TaxTotal.
//   • TaxTotal with TaxSubtotal (BG-23 breakdown).
//   • LegalMonetaryTotal with all five required amounts.
//
// Hash policy: the invoice hash is computed ONCE over the produced XML and
// is not mutated afterwards. The XAdES signature wrapper is intentionally
// omitted in this revision — adding a fake signature would only mask real
// errors. The next iteration plugs in real XAdES once we land the C14N + 
// cert-embedding pipeline. Until then, ZATCA may reject with a signature
// error; that's expected progress past the prior XSD failures.

import { createHash } from "crypto";

export type ZatcaDocKind = "invoice" | "credit_note";

export interface ZatcaInvoiceItem {
  nameAr: string;
  /** quantity, decimal allowed */
  qty: number;
  /** unit price INCLUDING VAT (POS storefront price) */
  unitPriceIncVat: number;
}

export interface BuildSimplifiedInvoiceInput {
  kind: ZatcaDocKind;
  invoiceNumber: string;
  issueIso: string; // full ISO timestamp
  uuid: string;
  icv: number;
  previousInvoiceHashB64: string; // PIH
  qrPayloadB64: string;
  vatRate: number; // 0.15
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
  items: ZatcaInvoiceItem[];
  /** For credit notes only */
  originalInvoiceNumber?: string;
  /** Free-text reason (credit note) */
  reason?: string;
}

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const r2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

interface ComputedLine {
  id: number;
  nameAr: string;
  qty: number;
  unitPriceExVat: number; // ex-VAT unit price
  lineNetExVat: number; // qty * unitPriceExVat
  lineVat: number;
  lineTotalIncVat: number;
}

export interface BuiltInvoice {
  xml: string;
  invoiceHashB64: string;
  totals: {
    lineNetSum: number;
    taxExclusive: number;
    taxInclusive: number;
    vat: number;
    payable: number;
  };
}

function computeLines(items: ZatcaInvoiceItem[], vatRate: number): ComputedLine[] {
  return items.map((it, i) => {
    const unitEx = it.unitPriceIncVat / (1 + vatRate);
    const lineNet = unitEx * it.qty;
    const lineVat = lineNet * vatRate;
    const lineTotal = lineNet + lineVat;
    return {
      id: i + 1,
      nameAr: it.nameAr,
      qty: it.qty,
      unitPriceExVat: unitEx,
      lineNetExVat: lineNet,
      lineVat,
      lineTotalIncVat: lineTotal,
    };
  });
}

export function buildSimplifiedInvoice(input: BuildSimplifiedInvoiceInput): BuiltInvoice {
  const isCN = input.kind === "credit_note";
  const typeCode = isCN ? "381" : "388";
  const typeName = "0200000"; // Simplified (B2C)
  const lines = computeLines(input.items, input.vatRate);

  const lineNetSum = lines.reduce((s, l) => s + l.lineNetExVat, 0);
  const vat = lines.reduce((s, l) => s + l.lineVat, 0);
  const taxInclusive = lineNetSum + vat;

  const issueDate = input.issueIso.slice(0, 10);
  const issueTime = input.issueIso.slice(11, 19);

  const vatPct = (input.vatRate * 100).toFixed(2);

  const addr = input.seller;
  const addressXml = `
      <cac:PostalAddress>
        <cbc:StreetName>${esc(addr.addressStreet ?? "N/A")}</cbc:StreetName>
        <cbc:BuildingNumber>${esc(addr.addressBuilding ?? "0000")}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${esc(addr.addressDistrict ?? "N/A")}</cbc:CitySubdivisionName>
        <cbc:CityName>${esc(addr.addressCity ?? "Riyadh")}</cbc:CityName>
        <cbc:PostalZone>${esc(addr.addressPostal ?? "00000")}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>`;

  const supplierXml = `
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${addr.crNumber ? `<cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(addr.crNumber)}</cbc:ID></cac:PartyIdentification>` : ""}
      ${addressXml}
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(input.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(input.seller.nameAr)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;

  // ZATCA simplified B2C: AccountingCustomerParty is OPTIONAL per business
  // rules, but the UBL 2.1 XSD declares it as required (minOccurs=1).
  // ZATCA's XSD validator enforces the schema, so we must include at least
  // an empty Party block to satisfy element ordering / XSD.
  const customerXml = `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>عميل نقدي</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;

  const paymentMeansCode = isCN ? "10" : "10"; // 10 = cash. POS cash flow.
  const paymentMeansXml = `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${paymentMeansCode}</cbc:PaymentMeansCode>
    ${isCN ? `<cbc:InstructionNote>${esc(input.reason ?? "Refund")}</cbc:InstructionNote>` : ""}
  </cac:PaymentMeans>`;


  const billingRefXml = isCN && input.originalInvoiceNumber
    ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(input.originalInvoiceNumber)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`
    : "";

  const additionalDocRefXml = `
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${input.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(input.previousInvoiceHashB64)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(input.qrPayloadB64)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`;

  const taxTotalXml = `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${r2(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${r2(lineNetSum)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${r2(vat)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
        <cbc:Percent>${vatPct}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;

  const legalMonetaryTotalXml = `
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${r2(lineNetSum)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${r2(lineNetSum)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${r2(taxInclusive)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="SAR">${r2(taxInclusive)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;

  const linesXml = lines
    .map(
      (l) => `
  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${l.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${r2(l.lineNetExVat)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${r2(l.lineVat)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${r2(l.lineTotalIncVat)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(l.nameAr)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${vatPct}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${r2(l.unitPriceExVat)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("");

  const rootTag = isCN ? "CreditNote" : "Invoice";
  const ns = isCN
    ? `xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"`
    : `xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`;
  const qtyTag = isCN ? "CreditedQuantity" : "InvoicedQuantity";

  // For credit notes, swap the invoiced quantity element tag in line items.
  const linesXmlFinal = isCN ? linesXml.replace(/InvoicedQuantity/g, qtyTag) : linesXml;

  // Strict ZATCA element order:
  //   ProfileID → ID → UUID → IssueDate → IssueTime → InvoiceTypeCode
  //   → DocumentCurrencyCode → TaxCurrencyCode → BillingReference (CN)
  //   → AdditionalDocumentReference x3 → AccountingSupplierParty
  //   → AccountingCustomerParty → PaymentMeans → TaxTotal
  //   → LegalMonetaryTotal → InvoiceLine[]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} ${ns}
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(input.uuid)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  ${isCN ? `<cbc:CreditNoteTypeCode name="${typeName}">${typeCode}</cbc:CreditNoteTypeCode>` : `<cbc:InvoiceTypeCode name="${typeName}">${typeCode}</cbc:InvoiceTypeCode>`}
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${billingRefXml}${additionalDocRefXml}${supplierXml}${customerXml}${paymentMeansXml}${taxTotalXml}${legalMonetaryTotalXml}${linesXmlFinal}
</${rootTag}>`;


  // Canonicalization for hashing per ZATCA simplified-invoice rule:
  //   - exclude the XML declaration (ZATCA C14N excludes it)
  //   - normalize line endings to \n
  //   - collapse purely-structural whitespace between tags
  //   - trim surrounding whitespace
  // The submitted XML bytes (signed_xml_b64) MUST be the same bytes we hash,
  // so ZATCA's recomputed hash matches ours.
  const noDecl = xml.replace(/^\s*<\?xml[^?]*\?>\s*/, "");
  const canonical = noDecl.replace(/\r\n/g, "\n").replace(/>\s+</g, "><").trim();
  const invoiceHashB64 = createHash("sha256").update(canonical).digest("base64");

  return {
    xml: canonical,
    invoiceHashB64,
    totals: {
      lineNetSum: +r2(lineNetSum),
      taxExclusive: +r2(lineNetSum),
      taxInclusive: +r2(taxInclusive),
      vat: +r2(vat),
      payable: +r2(taxInclusive),
    },
  };
}

/* ────────────────── Local validation (run before any submission) ────────────────── */

export interface LocalValidationIssue {
  code: string;
  message: string;
}

export interface LocalValidationInput {
  xml: string;
  invoiceHashB64: string;
  uuid: string;
  icv: number;
  pihB64: string;
  qrPayloadB64: string;
  totals: BuiltInvoice["totals"];
  kind: ZatcaDocKind;
  /** must be "simulation" or "production" matching the endpoint */
  environment: "simulation" | "production";
  endpoint: string;
}

export function validateInvoiceLocal(input: LocalValidationInput): LocalValidationIssue[] {
  const errs: LocalValidationIssue[] = [];

  // Phase-2 signed XML structural checks. The invoice hash is NOT
  // re-derived from input.xml here — under the ZATCA recipe the hash
  // is computed on the pre-signature canonical form, not on the final
  // signed XML, and the builder is the authority on that value.
  if (!input.xml.includes("<ext:UBLExtensions")) errs.push({ code: "MISSING_UBLEXT", message: "UBLExtensions block is missing." });
  if (!input.xml.includes("<ds:Signature")) errs.push({ code: "MISSING_DS_SIGNATURE", message: "ds:Signature block is missing." });
  if (!input.xml.includes("<xades:SignedProperties")) errs.push({ code: "MISSING_XADES", message: "XAdES SignedProperties missing." });
  if (!input.xml.includes("<ds:X509Certificate>")) errs.push({ code: "MISSING_CERT", message: "Signing certificate not embedded." });
  if (!input.xml.includes("<cbc:ID>QR</cbc:ID>")) errs.push({ code: "MISSING_QR_ADR", message: "QR AdditionalDocumentReference missing." });

  if (!input.uuid || input.uuid.length < 10) errs.push({ code: "MISSING_UUID", message: "Invoice UUID missing or invalid." });
  if (!input.icv || input.icv < 1) errs.push({ code: "MISSING_ICV", message: "ICV must be >= 1." });
  if (!input.pihB64) errs.push({ code: "MISSING_PIH", message: "Previous invoice hash (PIH) missing." });
  if (!input.qrPayloadB64) errs.push({ code: "MISSING_QR", message: "QR payload missing." });
  if (!input.invoiceHashB64) errs.push({ code: "MISSING_HASH", message: "Invoice hash missing." });

  if (input.kind === "invoice" && !/<cbc:InvoiceTypeCode name="0200000">388<\/cbc:InvoiceTypeCode>/.test(input.xml)) {
    errs.push({ code: "INVOICE_TYPE", message: 'Invoice type must be Simplified (0200000 / 388).' });
  }
  if (input.kind === "credit_note" && !/<cbc:CreditNoteTypeCode name="0200000">381<\/cbc:CreditNoteTypeCode>/.test(input.xml)) {
    errs.push({ code: "INVOICE_TYPE", message: 'Credit note type must be Simplified (0200000 / 381).' });
  }

  const taxCurrencyCode = input.xml.match(/<cbc:TaxCurrencyCode>([^<]+)<\/cbc:TaxCurrencyCode>/)?.[1] ?? null;
  const beforeLegalTotal = input.xml.split("<cac:LegalMonetaryTotal>")[0] ?? input.xml;
  const documentTaxTotals = beforeLegalTotal.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g) ?? [];
  const documentTaxTotalsWithSubtotals = documentTaxTotals.filter((b) => b.includes("<cac:TaxSubtotal>")).length;
  const documentTaxTotalsWithoutSubtotals = documentTaxTotals.length - documentTaxTotalsWithSubtotals;
  if (!taxCurrencyCode) errs.push({ code: "MISSING_TAX_CURRENCY", message: "TaxCurrencyCode is mandatory for ZATCA simplified invoices." });
  if (taxCurrencyCode && (documentTaxTotalsWithSubtotals !== 1 || documentTaxTotalsWithoutSubtotals !== 1)) {
    errs.push({
      code: "TAX_TOTAL_STRUCTURE",
      message: `When TaxCurrencyCode exists, document TaxTotal must include exactly one subtotal breakdown and exactly one tax-currency total without subtotal (count=${documentTaxTotals.length}, with_subtotal=${documentTaxTotalsWithSubtotals}, without_subtotal=${documentTaxTotalsWithoutSubtotals}).`,
    });
  }
  if (!/<cac:LegalMonetaryTotal>/.test(input.xml)) errs.push({ code: "MISSING_TOTALS", message: "LegalMonetaryTotal missing." });
  if (!/<cac:ClassifiedTaxCategory>/.test(input.xml)) errs.push({ code: "MISSING_LINE_TAX_CATEGORY", message: "Per-line ClassifiedTaxCategory missing." });

  const isSimEndpoint = input.endpoint.includes("/simulation/");
  const isProdEndpoint = input.endpoint.includes("/core/") || input.endpoint.includes("/production/");
  if (input.environment === "simulation" && !isSimEndpoint) {
    errs.push({ code: "ENV_MISMATCH", message: `Simulation env must use simulation endpoint (got ${input.endpoint}).` });
  }
  if (input.environment === "production" && !isProdEndpoint) {
    errs.push({ code: "ENV_MISMATCH", message: `Production env must use production endpoint (got ${input.endpoint}).` });
  }

  return errs;
}
