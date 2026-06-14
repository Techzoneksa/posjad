// Sprint F-2 — ZATCA crypto primitives (server-only).
//
// Responsibilities:
//   • Generate ECDSA secp256k1 key pair (ZATCA requirement).
//   • Build a PKCS#10 CSR PEM with ZATCA-required extensions.
//   • Encrypt / decrypt the private key with AES-256-GCM (Web Crypto)
//     using a server-only secret from process.env.ZATCA_DEVICE_KEY_ENCRYPTION_SECRET.
//
// SECURITY: This module is server-only. Never import from any
// file that can reach a client bundle. Private key material is
// never returned to callers — only encrypted blobs are stored,
// and decryption happens transiently inside signing/CSID flows.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ────────────────── Encryption (AES-256-GCM via Web Crypto) ────────────────── */

const ENC_VERSION = "v1";

async function deriveAesKey(): Promise<CryptoKey> {
  const secret = process.env.ZATCA_DEVICE_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ZATCA_DEVICE_KEY_ENCRYPTION_SECRET is missing or too short. Set a strong secret before generating keys.",
    );
  }
  // Derive a deterministic 32-byte AES key from the secret (no salt to keep
  // it reproducible — the secret IS the only KDF input we ever rely on, and
  // it lives only server-side).
  const material = new Uint8Array(createHash("sha256").update(secret).digest());
  return crypto.subtle.importKey(
    "raw",
    material.buffer.slice(material.byteOffset, material.byteOffset + material.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64FromBytes(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}
function bytesFromB64(s: string): Uint8Array {
  const buf = Buffer.from(s, "base64");
  // Copy into a plain ArrayBuffer-backed Uint8Array so it satisfies BufferSource.
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}
function toAb(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

export async function encryptSecret(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveAesKey();
  const ivView = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toAb(ivView) }, key, toAb(enc)),
  );
  return {
    ciphertext: `${ENC_VERSION}:${b64FromBytes(ct)}`,
    iv: b64FromBytes(ivView),
  };
}

export async function decryptSecret(ciphertext: string, ivB64: string): Promise<string> {
  const key = await deriveAesKey();
  const stripped = ciphertext.startsWith(`${ENC_VERSION}:`)
    ? ciphertext.slice(ENC_VERSION.length + 1)
    : ciphertext;
  const ct = bytesFromB64(stripped);
  const iv = bytesFromB64(ivB64);
  const pt = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: toAb(iv) }, key, toAb(ct)),
  );
  return new TextDecoder().decode(pt);
}

/* ────────────────── secp256k1 key pair ────────────────── */

export interface DeviceKeyPair {
  privateKeyHex: string; // raw 32-byte secret scalar, hex
  publicKeyHex: string; // uncompressed SEC1 point (0x04 || X || Y), hex
}

export function generateDeviceKeyPair(): DeviceKeyPair {
  const sk = secp256k1.utils.randomSecretKey();
  const pk = secp256k1.getPublicKey(sk, false); // uncompressed
  return {
    privateKeyHex: Buffer.from(sk).toString("hex"),
    publicKeyHex: Buffer.from(pk).toString("hex"),
  };
}

/* ────────────────── Minimal DER / ASN.1 encoders ──────────────────
 * Small hand-rolled DER encoder, sufficient for:
 *   - SubjectPublicKeyInfo (ecPublicKey + secp256k1)
 *   - PKCS#10 CertificationRequest with ZATCA custom extensions
 *   - ECDSA signature (r,s) -> DER SEQUENCE
 * Pure ESM, no Node-only dependencies.
 */

function encLen(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x >>= 8;
  }
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
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
function derSequence(...items: Uint8Array[]) {
  return tlv(0x30, concat(...items));
}
function derSet(...items: Uint8Array[]) {
  return tlv(0x31, concat(...items));
}
function derOid(oid: string): Uint8Array {
  // Minimal OID encoder
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
    while (v > 0) {
      stack.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    out.push(...stack);
  }
  return tlv(0x06, new Uint8Array(out));
}
function derUtf8(s: string) {
  return tlv(0x0c, new TextEncoder().encode(s));
}
function derPrintable(s: string) {
  return tlv(0x13, new TextEncoder().encode(s));
}
function derIA5(s: string) {
  return tlv(0x16, new TextEncoder().encode(s));
}
function derNull() {
  return new Uint8Array([0x05, 0x00]);
}
function derInteger(n: number | bigint) {
  let v = typeof n === "bigint" ? n : BigInt(n);
  if (v === 0n) return tlv(0x02, new Uint8Array([0]));
  const bytes: number[] = [];
  while (v > 0n) {
    bytes.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0);
  return tlv(0x02, new Uint8Array(bytes));
}
function derBitString(bytes: Uint8Array, unused = 0) {
  const out = new Uint8Array(bytes.length + 1);
  out[0] = unused;
  out.set(bytes, 1);
  return tlv(0x03, out);
}
function derOctetString(bytes: Uint8Array) {
  return tlv(0x04, bytes);
}

// OIDs
const OID_EC_PUBLIC_KEY = "1.2.840.10045.2.1";
const OID_SECP256K1 = "1.3.132.0.10";
const OID_ECDSA_WITH_SHA256 = "1.2.840.10045.4.3.2";
const OID_CN = "2.5.4.3";
const OID_O = "2.5.4.10";
const OID_OU = "2.5.4.11";
const OID_C = "2.5.4.6";
const OID_EXT_REQ = "1.2.840.113549.1.9.14";
const OID_SAN = "2.5.29.17";
const OID_ZATCA_CUSTOM_OID = "1.3.6.1.4.1.311.20.2"; // MS Certificate Template Name

function pem(label: string, der: Uint8Array): string {
  const b64 = Buffer.from(der).toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/* ────────────────── PKCS#10 CSR ────────────────── */

export interface CsrInput {
  commonName: string;
  serialNumber: string; // "1-VAT|2-DEVICE|3-SN"
  organizationUnit: string;
  organizationName: string;
  country: string; // "SA"
  vatNumber: string;
  invoiceType: string; // "0100" simplified, "1000" standard, "1100" both
  locationAddress: string;
  businessCategory: string; // e.g. "Restaurant"
  environment: "simulation" | "production";
  publicKeyHex: string;
  privateKeyHex: string;
}

export function buildCsrPem(input: CsrInput): string {
  // SubjectPublicKeyInfo for EC secp256k1
  const algId = derSequence(derOid(OID_EC_PUBLIC_KEY), derOid(OID_SECP256K1));
  const pubBytes = Uint8Array.from(Buffer.from(input.publicKeyHex, "hex"));
  const spki = derSequence(algId, derBitString(pubBytes));

  // Subject DN: keep this aligned with ZATCA/OpenSSL CSR examples.
  // The VAT number is carried in SAN UID below; adding extra Subject RDNs
  // has caused Invalid-CSR responses in simulation.
  const dn = derSequence(
    derSet(derSequence(derOid(OID_CN), derUtf8(input.commonName))),
    derSet(derSequence(derOid(OID_O), derUtf8(input.organizationName))),
    derSet(derSequence(derOid(OID_OU), derUtf8(input.organizationUnit))),
    derSet(derSequence(derOid(OID_C), derPrintable(input.country))),
  );

  // ZATCA SAN: directoryName with raw values (no "SN:"/"UID:" prefixes).
  // OIDs per ZATCA spec:
  //   2.5.4.4  SN/surname    -> EGS unit serial JSON-ish "1-...|2-...|3-..."
  //   0.9.2342.19200300.100.1.1 UID -> VAT number
  //   2.5.4.12 title         -> invoice type ("0100" | "1000" | "1100")
  //   2.5.4.26 registeredAddress -> location address
  //   2.5.4.15 businessCategory  -> business category (e.g. "Restaurant")
  const sanInner = derSequence(
    tlv(
      0xa4, // [4] directoryName
      derSequence(
        derSet(derSequence(derOid("2.5.4.4"), derUtf8(input.serialNumber))),
        derSet(derSequence(derOid("0.9.2342.19200300.100.1.1"), derUtf8(input.vatNumber))),
        derSet(derSequence(derOid("2.5.4.12"), derUtf8(input.invoiceType))),
        derSet(derSequence(derOid("2.5.4.26"), derUtf8(input.locationAddress))),
        derSet(derSequence(derOid("2.5.4.15"), derUtf8(input.businessCategory))),
      ),
    ),
  );
  const sanExt = derSequence(derOid(OID_SAN), derOctetString(sanInner));

  // ZATCA template name per environment (Microsoft Certificate Template Name ext).
  const templateName =
    input.environment === "production" ? "ZATCA-Code-Signing" : "PREZATCA-Code-Signing";
  const templateExt = derSequence(
    derOid(OID_ZATCA_CUSTOM_OID),
    derOctetString(derPrintable(templateName)),
  );
  // Request only the extensions ZATCA expects from the CSR. ZATCA will issue
  // the final certificate profile (keyUsage/basicConstraints/etc.) itself.
  const extensions = derSequence(templateExt, sanExt);
  const extReqAttr = derSequence(
    derOid(OID_EXT_REQ),
    derSet(extensions),
  );
  const attributes = tlv(0xa0, extReqAttr); // [0] IMPLICIT attributes

  const cri = derSequence(
    derInteger(0), // version
    dn,
    spki,
    attributes,
  );

  // Sign CRI with ECDSA-SHA256 over secp256k1
  const sk = Uint8Array.from(Buffer.from(input.privateKeyHex, "hex"));
  const digest = sha256(cri);
  // noble/curves v2 prehashes by default — pass { prehash: false } since we
  // already computed the SHA-256 digest ourselves.
  const sig = secp256k1.sign(digest, sk, { prehash: false });
  const sigBytes = sig instanceof Uint8Array ? sig : (sig as any).toBytes?.("compact") ?? (sig as any).toCompactRawBytes?.();
  // r/s big-endian, fixed 32-byte. Encode as ECDSA-Sig-Value DER SEQUENCE.
  const r = BigInt("0x" + Buffer.from(sigBytes.slice(0, 32)).toString("hex"));
  const s = BigInt("0x" + Buffer.from(sigBytes.slice(32, 64)).toString("hex"));
  const sigDer = derSequence(derInteger(r), derInteger(s));

  const sigAlg = derSequence(derOid(OID_ECDSA_WITH_SHA256));
  const csrDer = derSequence(cri, sigAlg, derBitString(sigDer));
  return pem("CERTIFICATE REQUEST", csrDer);
}

/* ────────────────── ECDSA sign helper for invoice hashes ────────────────── */
export function ecdsaSignSha256(privateKeyHex: string, data: Uint8Array): { sigDer: Uint8Array; sigB64: string } {
  const sk = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const digest = sha256(data);
  const sig = secp256k1.sign(digest, sk, { prehash: false });
  const sigBytes = sig instanceof Uint8Array ? sig : (sig as any).toBytes?.("compact") ?? (sig as any).toCompactRawBytes?.();
  const r = BigInt("0x" + Buffer.from(sigBytes.slice(0, 32)).toString("hex"));
  const s = BigInt("0x" + Buffer.from(sigBytes.slice(32, 64)).toString("hex"));
  const sigDer = derSequence(derInteger(r), derInteger(s));
  return { sigDer, sigB64: Buffer.from(sigDer).toString("base64") };
}

/* ────────────────── Load / store device key helpers ────────────────── */

export async function loadDeviceKeysRow() {
  const { data } = await supabaseAdmin
    .from("zatca_device_keys")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return data as any;
}

export async function getDecryptedPrivateKeyHex(): Promise<string> {
  const row = await loadDeviceKeysRow();
  if (!row?.private_key_encrypted || !row?.private_key_iv) {
    throw new Error("No device private key found. Run prepareDeviceCsr first.");
  }
  return decryptSecret(row.private_key_encrypted, row.private_key_iv);
}

export async function getDecryptedComplianceCsid(): Promise<{ token: string; secret: string } | null> {
  const row = await loadDeviceKeysRow();
  if (!row?.compliance_csid_token_encrypted) return null;
  const token = await decryptSecret(row.compliance_csid_token_encrypted, row.compliance_csid_iv);
  const secret = await decryptSecret(row.compliance_csid_secret_encrypted, row.compliance_csid_secret_iv);
  return { token, secret };
}
