// ZATCA — Minimal X.509 parser (server-only).
//
// Extracts the pieces ZATCA needs from the binarySecurityToken returned
// by the compliance CSID call:
//   - certDerBytes        : raw DER bytes of the whole certificate
//   - certPemBodyBase64   : base64 of certDerBytes (the body that goes
//                           inside <ds:X509Certificate> AND that is
//                           SHA-256/hex/base64-encoded to form CertDigest)
//   - subjectPublicKeyInfoDer : DER of SubjectPublicKeyInfo (for QR tag 8)
//   - signatureValueBytes : raw signatureValue bytes (for QR tag 9)
//   - issuerDnString      : RFC 2253-ish string for X509IssuerName
//   - serialNumberDecimal : decimal string of CertificateSerialNumber
//
// No external dep — we hand-roll a tiny ASN.1 DER walker.

import { createHash } from "crypto";

interface AsnNode {
  tag: number;
  contentStart: number; // start of the content (after length)
  contentEnd: number;   // exclusive
  fullStart: number;    // start of the tag byte
  fullEnd: number;      // exclusive — end of TLV
}

function readByte(buf: Uint8Array, off: number, context: string): number {
  const value = buf[off];
  if (value == null) throw new Error(`${context}: unexpected end of DER at offset ${off}`);
  return value;
}

function readLen(buf: Uint8Array, off: number): { len: number; next: number } {
  const first = readByte(buf, off, "DER length");
  if (first < 0x80) return { len: first, next: off + 1 };
  const n = first & 0x7f;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | readByte(buf, off + 1 + i, "DER length");
  return { len, next: off + 1 + n };
}

function readTlv(buf: Uint8Array, off: number): AsnNode {
  const tag = readByte(buf, off, "DER tag");
  const { len, next } = readLen(buf, off + 1);
  return {
    tag,
    contentStart: next,
    contentEnd: next + len,
    fullStart: off,
    fullEnd: next + len,
  };
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

const OID_CN = "2.5.4.3";
const OID_O = "2.5.4.10";
const OID_OU = "2.5.4.11";
const OID_C = "2.5.4.6";
const OID_NAMES: Record<string, string> = {
  [OID_CN]: "CN",
  [OID_O]: "O",
  [OID_OU]: "OU",
  [OID_C]: "C",
  "0.9.2342.19200300.100.1.25": "DC",
  "2.5.4.5": "SERIALNUMBER",
};

function escapeRfc4514Value(value: string): string {
  return value
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

function decodeOid(content: Uint8Array): string {
  const out: number[] = [];
  const b0 = readByte(content, 0, "OID");
  out.push(Math.floor(b0 / 40), b0 % 40);
  let v = 0;
  for (let i = 1; i < content.length; i++) {
    const b = readByte(content, i, "OID");
    v = (v << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      out.push(v);
      v = 0;
    }
  }
  return out.join(".");
}

function decString(buf: Uint8Array, node: AsnNode): string {
  return Buffer.from(buf.slice(node.contentStart, node.contentEnd)).toString("utf8");
}

function bytesOf(buf: Uint8Array, node: AsnNode): Uint8Array {
  return buf.slice(node.contentStart, node.contentEnd);
}

function fullBytes(buf: Uint8Array, node: AsnNode): Uint8Array {
  return buf.slice(node.fullStart, node.fullEnd);
}

function parseDn(buf: Uint8Array, dnNode: AsnNode): string {
  // RDNSequence ::= SEQUENCE OF RelativeDistinguishedName
  const parts: string[] = [];
  for (const rdn of children(buf, dnNode)) {
    // SET OF AttributeTypeAndValue
    for (const atv of children(buf, rdn)) {
      const atvKids = children(buf, atv);
      if (atvKids.length < 2) continue;
      const oidNode = atvKids[0];
      const valueNode = atvKids[1];
      if (!oidNode || !valueNode) continue;
      const oid = decodeOid(bytesOf(buf, oidNode));
      const name = OID_NAMES[oid] ?? oid;
      const val = decString(buf, valueNode);
      parts.push(`${name}=${escapeRfc4514Value(val)}`);
    }
  }
  // ZATCA expects reverse (RFC4514) order: least-specific RDN first
  // ("C=SA, O=..., OU=..., CN=...") to match SDK X509IssuerName.
  return parts.reverse().join(", ");
}

function serialToDecimal(bytes: Uint8Array): string {
  // Big-endian unsigned integer to decimal string.
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v.toString(10);
}

export interface ParsedCert {
  certDerBytes: Uint8Array;
  certPemBodyBase64: string;
  subjectPublicKeyInfoDer: Uint8Array;
  signatureValueBytes: Uint8Array;
  issuerDnString: string;
  subjectDnString: string;
  serialNumberDecimal: string;
  notBeforeIso: string | null;
  notAfterIso: string | null;
}

function decodeAsn1Time(buf: Uint8Array, node: AsnNode): string | null {
  const raw = Buffer.from(buf.slice(node.contentStart, node.contentEnd)).toString("ascii");
  try {
    if (node.tag === 0x17) {
      // UTCTime: YYMMDDHHMMSSZ
      const yy = parseInt(raw.slice(0, 2), 10);
      const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
      const iso = `${yyyy}-${raw.slice(2, 4)}-${raw.slice(4, 6)}T${raw.slice(6, 8)}:${raw.slice(8, 10)}:${raw.slice(10, 12)}Z`;
      return new Date(iso).toISOString();
    }
    if (node.tag === 0x18) {
      // GeneralizedTime: YYYYMMDDHHMMSSZ
      const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}Z`;
      return new Date(iso).toISOString();
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Accepts the value stored as `binarySecurityToken` from ZATCA. ZATCA
 * returns this base64-encoded (sometimes wrapped in `-----BEGIN CERT-----`,
 * sometimes a single-line base64 of the PEM body, sometimes base64 of
 * base64 of the DER). We normalize:
 *   1. strip PEM armor + whitespace
 *   2. base64-decode
 *   3. if the result looks like ASCII base64 again (because ZATCA double-encodes
 *      the binarySecurityToken), decode again
 *   4. the resulting bytes are the DER of an X.509 Certificate
 */
export function parseZatcaCsidToken(token: string): ParsedCert {
  const stripped = token
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");

  let der = Buffer.from(stripped, "base64");

  // Heuristic: ZATCA's binarySecurityToken is base64( base64(DER) ).
  // After one decode, the bytes are still ASCII base64 of the PEM body.
  const asAscii = der.toString("ascii");
  if (/^[A-Za-z0-9+/=]+$/.test(asAscii) && asAscii.length > 100) {
    try {
      const inner = Buffer.from(asAscii, "base64");
      if ((inner[0] ?? 0) === 0x30) der = inner; // SEQUENCE → likely real DER
    } catch {
      /* keep der */
    }
  }

  const buf = new Uint8Array(der);
  if ((buf[0] ?? 0) !== 0x30) {
    throw new Error("CSID token is not a DER X.509 certificate (first byte != 0x30)");
  }

  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  const root = readTlv(buf, 0);
  const rootKids = children(buf, root);
  if (rootKids.length < 3) {
    throw new Error("Malformed X.509: expected 3 top-level fields");
  }
  const tbs = rootKids[0];
  const sigValueNode = rootKids[2];
  if (!tbs || !sigValueNode) {
    throw new Error("Malformed X.509: missing tbsCertificate or signatureValue");
  }

  // signatureValue is a BIT STRING; first byte = unused bits, rest = data.
  const sigBitstring = bytesOf(buf, sigValueNode);
  const signatureValueBytes = sigBitstring.slice(1);

  // TBSCertificate fields (with default version EXPLICIT [0]):
  //   [0] version (optional, EXPLICIT)
  //   serialNumber INTEGER
  //   signature  AlgorithmIdentifier
  //   issuer     Name
  //   validity   SEQUENCE
  //   subject    Name
  //   subjectPublicKeyInfo SubjectPublicKeyInfo
  //   ...
  const tbsKids = children(buf, tbs);
  let idx = 0;
  const maybeVersion = tbsKids[idx];
  if (maybeVersion && (maybeVersion.tag & 0xe0) === 0xa0) idx++; // skip explicit version [0]
  const serial = tbsKids[idx++];
  const signatureAlg = tbsKids[idx++];
  const issuer = tbsKids[idx++];
  const validity = tbsKids[idx++];
  const subject = tbsKids[idx++];
  const spki = tbsKids[idx++];
  if (!serial || !signatureAlg || !issuer || !validity || !subject || !spki) {
    throw new Error("Malformed X.509: missing required TBSCertificate fields");
  }

  const validityKids = children(buf, validity);
  const notBefore = validityKids[0];
  const notAfter = validityKids[1];
  const notBeforeIso = notBefore ? decodeAsn1Time(buf, notBefore) : null;
  const notAfterIso = notAfter ? decodeAsn1Time(buf, notAfter) : null;

  const certPemBodyBase64 = Buffer.from(buf).toString("base64");

  return {
    certDerBytes: buf,
    certPemBodyBase64,
    subjectPublicKeyInfoDer: fullBytes(buf, spki),
    signatureValueBytes,
    issuerDnString: parseDn(buf, issuer),
    subjectDnString: parseDn(buf, subject),
    serialNumberDecimal: serialToDecimal(bytesOf(buf, serial)),
    notBeforeIso,
    notAfterIso,
  };
}

/** SHA-256 of the certificate base64 body, hex-encoded, then base64 — per ZATCA quirk. */
export function zatcaCertDigestB64(certPemBodyBase64: string): string {
  const hashHex = createHash("sha256").update(certPemBodyBase64).digest("hex");
  return Buffer.from(hashHex, "ascii").toString("base64");
}
