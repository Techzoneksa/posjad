import crypto from "node:crypto";

import { phase1QrBase64 } from "./tlv.js";

const VAT_RATE = 0.15;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value) {
  return (Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function zatcaTimestamp(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}Z`;
}

export function sha256Base64(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("base64");
}

function invoiceTypeFor(order) {
  const customerVat = order?.customers?.vat_number ?? order?.customer_vat_number ?? null;
  return customerVat ? { code: "388", name: "0100000", mode: "clearance" } : { code: "388", name: "0200000", mode: "reporting" };
}

function normalizeItems(items = []) {
  return items.map((item, index) => {
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const totalInc = Number(item.total_price ?? item.total_including_vat ?? item.line_total ?? 0);
    const unitInc = qty ? totalInc / qty : Number(item.unit_price ?? item.unitPriceIncVat ?? 0);
    const unitEx = unitInc / (1 + VAT_RATE);
    const lineEx = unitEx * qty;
    const vat = lineEx * VAT_RATE;
    return {
      id: index + 1,
      name: item.name_ar ?? item.product_name ?? item.name ?? `Item ${index + 1}`,
      qty,
      unitEx,
      lineEx,
      vat,
      totalInc: lineEx + vat,
    };
  });
}

function buildPartyXml(settings, order) {
  const sellerName = settings?.seller_name_ar ?? settings?.restaurant_name_ar ?? settings?.name_ar ?? "JAAD CLOUD";
  const vatNumber = settings?.vat_number ?? settings?.tax_number ?? "300000000000003";
  const street = settings?.address_street ?? settings?.street ?? "King Fahd Road";
  const building = settings?.address_building ?? settings?.building_number ?? "0000";
  const district = settings?.address_district ?? settings?.district ?? "Al Olaya";
  const city = settings?.address_city ?? settings?.city ?? "Riyadh";
  const postal = settings?.address_postal ?? settings?.postal_code ?? "00000";
  const cr = settings?.cr_number ?? settings?.commercial_registration ?? "0000000000";

  const customerName = order?.customers?.name ?? order?.customer_name ?? "Walk-in Customer";
  const customerVat = order?.customers?.vat_number ?? order?.customer_vat_number ?? "";

  return {
    sellerName,
    vatNumber,
    supplierXml: `
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(cr)}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(street)}</cbc:StreetName>
        <cbc:BuildingNumber>${esc(building)}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${esc(district)}</cbc:CitySubdivisionName>
        <cbc:CityName>${esc(city)}</cbc:CityName>
        <cbc:PostalZone>${esc(postal)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`,
    customerXml: `
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${customerVat ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(customerVat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(customerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`,
  };
}

function buildLinesXml(items) {
  return items.map((item) => `
  <cac:InvoiceLine>
    <cbc:ID>${item.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${money(item.qty)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${money(item.lineEx)}</cbc:LineExtensionAmount>
    <cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${money(item.vat)}</cbc:TaxAmount></cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(item.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="SAR">${money(item.unitEx)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`).join("");
}

export function buildUblInvoice({ order, invoice, items, settings, previousInvoiceHashBase64, icv, uuid }) {
  const normalizedItems = normalizeItems(items);
  const totals = normalizedItems.reduce(
    (acc, item) => ({
      lineExtension: acc.lineExtension + item.lineEx,
      vat: acc.vat + item.vat,
      payable: acc.payable + item.totalInc,
    }),
    { lineExtension: 0, vat: 0, payable: 0 },
  );
  const issueAt = zatcaTimestamp(invoice?.created_at ?? order?.created_at ?? new Date());
  const [issueDate, issueTime] = issueAt.replace("Z", "").split("T");
  const type = invoiceTypeFor(order);
  const { sellerName, vatNumber, supplierXml, customerXml } = buildPartyXml(settings, order);
  const invoiceNumber = invoice?.invoice_number ?? order?.order_number ?? `INV-${Date.now()}`;
  const zatcaUuid = uuid ?? crypto.randomUUID();
  const qrPhase1 = phase1QrBase64({
    sellerName,
    vatNumber,
    timestamp: issueAt,
    totalWithVat: totals.payable,
    vatTotal: totals.vat,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(zatcaUuid)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}Z</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${type.name}">${type.code}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${Number(icv ?? 1)}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(previousInvoiceHashBase64 ?? "")}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrPhase1}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>
  </cac:AdditionalDocumentReference>
${supplierXml}
${customerXml}
  <cac:PaymentMeans><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode></cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${money(totals.vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${money(totals.lineExtension)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${money(totals.vat)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${money(totals.lineExtension)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${money(totals.lineExtension)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${money(totals.payable)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="SAR">${money(totals.payable)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${buildLinesXml(normalizedItems)}
</Invoice>`;

  return {
    unsignedXml: xml,
    invoiceHashBase64: sha256Base64(xml),
    qrBase64: qrPhase1,
    uuid: zatcaUuid,
    issueAt,
    type,
    totals: {
      lineExtension: Number(money(totals.lineExtension)),
      vat: Number(money(totals.vat)),
      payable: Number(money(totals.payable)),
    },
    metrics: {
      lines: normalizedItems.length,
      xmlBytes: Buffer.byteLength(xml, "utf8"),
      qrTags: 5,
    },
  };
}
