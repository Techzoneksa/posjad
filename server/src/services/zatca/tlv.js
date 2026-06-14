export function tlvEncode(tags) {
  const buffers = tags.map(({ tag, value }) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
    if (bytes.length > 255) {
      throw new Error(`ZATCA TLV tag ${tag} exceeds one-byte length (${bytes.length})`);
    }
    return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
  });

  return Buffer.concat(buffers).toString("base64");
}

export function phase1QrBase64({ sellerName, vatNumber, timestamp, totalWithVat, vatTotal }) {
  return tlvEncode([
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: Number(totalWithVat).toFixed(2) },
    { tag: 5, value: Number(vatTotal).toFixed(2) },
  ]);
}

export function phase2QrBase64({
  sellerName,
  vatNumber,
  timestamp,
  totalWithVat,
  vatTotal,
  invoiceHashBase64,
  signatureValueBase64,
  publicKeyBase64,
  certificateSignatureBase64,
}) {
  return tlvEncode([
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: Number(totalWithVat).toFixed(2) },
    { tag: 5, value: Number(vatTotal).toFixed(2) },
    { tag: 6, value: invoiceHashBase64 },
    { tag: 7, value: Buffer.from(signatureValueBase64 ?? "", "base64") },
    { tag: 8, value: Buffer.from(publicKeyBase64 ?? "", "base64") },
    { tag: 9, value: Buffer.from(certificateSignatureBase64 ?? "", "base64") },
  ]);
}
