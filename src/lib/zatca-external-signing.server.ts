// External ZATCA SDK signing adapter (server-only).
//
// Routes invoice signing through the self-hosted Java service that wraps the
// official ZATCA Java SDK (com.gazt.einvoicing.signing.service.impl.SigningServiceImpl).
//
// SECURITY CONTRACT — DO NOT WEAKEN:
//   • The request body carries the ZATCA device private key in PEM form.
//   • This module REFUSES to call any URL that is not https://.
//     ZATCA_SIGNING_SERVICE_URL must be flipped to https://... before this
//     adapter can be used.
//   • Bearer token = ZATCA_SIGNING_SERVICE_SECRET (env-only, never client-side).
//
// SCOPE: This module is wired into ONE off-the-books compliance test only.
// It is not invoked by the normal invoice queue. Do not import it from the
// existing signing pipeline.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { parseZatcaCsidToken } from "./zatca-x509.server";

/* ───────── DER helpers (just enough for SEC1 EC PRIVATE KEY) ───────── */

function encLen(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) { bytes.unshift(x & 0xff); x >>= 8; }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
function tlv(tag: number, value: Uint8Array): Uint8Array {
  const lenBytes = encLen(value.length);
  const out = new Uint8Array(1 + lenBytes.length + value.length);
  out[0] = tag;
  out.set(lenBytes, 1);
  out.set(value, 1 + lenBytes.length);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function derSequence(...items: Uint8Array[]) { return tlv(0x30, concat(...items)); }
function derInteger(n: number) {
  if (n === 0) return tlv(0x02, new Uint8Array([0]));
  const bytes: number[] = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0);
  return tlv(0x02, new Uint8Array(bytes));
}
function derOctetString(bytes: Uint8Array) { return tlv(0x04, bytes); }
function derBitString(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.length + 1);
  out[0] = 0; // unused bits
  out.set(bytes, 1);
  return tlv(0x03, out);
}
function derOid(oid: string): Uint8Array {
  const parts = oid.split(".").map((n) => parseInt(n, 10));
  const firstPart = parts[0];
  const secondPart = parts[1];
  if (parts.length < 2 || firstPart == null || secondPart == null || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid OID: ${oid}`);
  }
  const first = 40 * firstPart + secondPart;
  const out: number[] = [first];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v == null) throw new Error(`Invalid OID: ${oid}`);
    const stack: number[] = [v & 0x7f];
    v >>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>= 7; }
    out.push(...stack);
  }
  return tlv(0x06, new Uint8Array(out));
}
const OID_SECP256K1 = "1.3.132.0.10";

/* ───────── PEM packaging ───────── */

function pem(label: string, der: Uint8Array): string {
  const b64 = Buffer.from(der).toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/**
 * Encode a 32-byte secp256k1 private key (hex) as a SEC1
 * `EC PRIVATE KEY` PEM. Includes the public key BIT STRING so the
 * Java service's BouncyCastle PEMParser resolves it as a PEMKeyPair.
 *
 *   ECPrivateKey ::= SEQUENCE {
 *     version       INTEGER (1),
 *     privateKey    OCTET STRING (32 bytes),
 *     parameters [0] EXPLICIT OBJECT IDENTIFIER OPTIONAL,
 *     publicKey  [1] EXPLICIT BIT STRING OPTIONAL
 *   }
 */
export function hexSkToSec1Pem(privateKeyHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error("hexSkToSec1Pem: expected 32-byte hex secp256k1 private key");
  }
  const skBytes = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  // Validate against curve order and derive uncompressed pubkey.
  const pubUncompressed = secp256k1.getPublicKey(skBytes, false); // 0x04 || X || Y
  const paramsExplicit = tlv(0xa0, derOid(OID_SECP256K1));
  const pubExplicit = tlv(0xa1, derBitString(pubUncompressed));
  const ecPrivateKey = derSequence(
    derInteger(1),
    derOctetString(skBytes),
    paramsExplicit,
    pubExplicit,
  );
  return pem("EC PRIVATE KEY", ecPrivateKey);
}

/**
 * Re-package the ZATCA binarySecurityToken into a clean `CERTIFICATE`
 * PEM that BouncyCastle can parse. The stored token is base64 of base64
 * of DER (ZATCA's double-encoding quirk); parseZatcaCsidToken normalizes
 * to a single base64 PEM body.
 */
export function csidTokenToCertPem(binarySecurityToken: string): string {
  const parsed = parseZatcaCsidToken(binarySecurityToken);
  return pem("CERTIFICATE", parsed.certDerBytes);
}

/* ───────── HTTPS / config guards ───────── */

export interface ExternalSigningConfig {
  url: string;     // https://host[:port]
  secret: string;  // bearer token
}

export function loadExternalSigningConfigOrThrow(): ExternalSigningConfig {
  const url = (process.env.ZATCA_SIGNING_SERVICE_URL ?? "").trim();
  const secret = (process.env.ZATCA_SIGNING_SERVICE_SECRET ?? "").trim();
  if (!url) throw new Error("ZATCA_SIGNING_SERVICE_URL is not set.");
  if (!secret) throw new Error("ZATCA_SIGNING_SERVICE_SECRET is not set.");
  if (!url.startsWith("https://")) {
    throw new Error(
      "ZATCA_SIGNING_SERVICE_URL must use https:// (request body carries the ZATCA private key PEM). " +
      "Place Caddy/Cloudflare Tunnel/nginx with TLS in front of the signing service and update the secret.",
    );
  }
  return { url: url.replace(/\/+$/, ""), secret };
}

/* ───────── /sign call ───────── */

export interface ExternalSignRequest {
  unsignedXml: string;
  privateKeyPem: string;
  certificatePem: string;
  pihBase64: string;
  icv: number;
  invoiceUuid: string;
}

export interface ExternalSignResponse {
  signedXmlBase64: string;
  invoiceHashBase64: string;
  qrBase64: string;
  signedPropertiesDigestB64?: string;
  certDigestB64?: string;
  signatureValueB64?: string;
  diagnostics?: Record<string, unknown>;
}

export async function signWithExternalService(
  cfg: ExternalSigningConfig,
  req: ExternalSignRequest,
): Promise<{ status: number; body: ExternalSignResponse | { error: string; message?: string } }> {
  const res = await fetch(`${cfg.url}/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.secret}`,
    },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { error: "non_json_response", message: text.slice(0, 500) }; }
  return { status: res.status, body };
}
