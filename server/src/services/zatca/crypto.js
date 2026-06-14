import crypto from "node:crypto";

const ENC_VERSION = "v1";
const OID_SECP256K1 = "1.3.132.0.10";

function encryptionSecret() {
  const secret = process.env.ZATCA_DEVICE_KEY_ENCRYPTION_SECRET || process.env.ZATCA_SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("ZATCA_DEVICE_KEY_ENCRYPTION_SECRET or ZATCA_SECRET_KEY must be set to decrypt ZATCA credentials");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function decryptSecret(ciphertext, ivBase64) {
  if (!ciphertext || !ivBase64) return "";
  const raw = ciphertext.startsWith(`${ENC_VERSION}:`) ? ciphertext.slice(ENC_VERSION.length + 1) : ciphertext;
  const encrypted = Buffer.from(raw, "base64");
  const iv = Buffer.from(ivBase64, "base64");
  const tag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionSecret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `${ENC_VERSION}:${Buffer.concat([encrypted, tag]).toString("base64")}`,
    iv: iv.toString("base64"),
  };
}

function encLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, value) {
  return Buffer.concat([Buffer.from([tag]), encLen(value.length), value]);
}

function seq(...items) {
  return der(0x30, Buffer.concat(items));
}

function int(n) {
  if (n === 0) return der(0x02, Buffer.from([0]));
  const bytes = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x >>= 8;
  }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return der(0x02, Buffer.from(bytes));
}

function oid(oidText) {
  const parts = oidText.split(".").map((p) => Number(p));
  const out = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i += 1) {
    let value = parts[i];
    const stack = [value & 0x7f];
    value >>= 7;
    while (value > 0) {
      stack.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    out.push(...stack);
  }
  return der(0x06, Buffer.from(out));
}

function pem(label, body) {
  const b64 = Buffer.from(body).toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export function secp256k1HexToPem(privateKeyHex) {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex ?? "")) {
    if (String(privateKeyHex ?? "").includes("BEGIN")) return privateKeyHex;
    throw new Error("Expected 32-byte secp256k1 private key hex");
  }

  const ecdh = crypto.createECDH("secp256k1");
  ecdh.setPrivateKey(Buffer.from(privateKeyHex, "hex"));
  const publicKey = ecdh.getPublicKey(null, "uncompressed");
  const ecPrivateKey = seq(
    int(1),
    der(0x04, Buffer.from(privateKeyHex, "hex")),
    der(0xa0, oid(OID_SECP256K1)),
    der(0xa1, der(0x03, Buffer.concat([Buffer.from([0]), publicKey]))),
  );
  return pem("EC PRIVATE KEY", ecPrivateKey);
}

function maybeBase64Der(value) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("BEGIN CERTIFICATE")) return text;
  let decoded = Buffer.from(text, "base64");
  if (decoded[0] !== 0x30) {
    const inner = decoded.toString("utf8").trim();
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(inner)) decoded = Buffer.from(inner, "base64");
  }
  if (decoded[0] !== 0x30) throw new Error("CSID token is not a DER certificate");
  return pem("CERTIFICATE", decoded);
}

export function certificateTokenToPem(tokenOrPem) {
  return maybeBase64Der(tokenOrPem);
}

export function readZatcaCredentials(settings = {}) {
  const privateKeyPlain =
    settings.private_key_pem ||
    settings.device_private_key_pem ||
    settings.private_key ||
    (settings.private_key_encrypted && settings.private_key_iv
      ? decryptSecret(settings.private_key_encrypted, settings.private_key_iv)
      : "");

  const tokenPlain =
    settings.production_csid_token ||
    settings.compliance_csid_token ||
    settings.binary_security_token ||
    (settings.production_csid_token_encrypted && settings.production_csid_iv
      ? decryptSecret(settings.production_csid_token_encrypted, settings.production_csid_iv)
      : "") ||
    (settings.compliance_csid_token_encrypted && settings.compliance_csid_iv
      ? decryptSecret(settings.compliance_csid_token_encrypted, settings.compliance_csid_iv)
      : "");

  const secretPlain =
    settings.production_csid_secret ||
    settings.compliance_csid_secret ||
    settings.secret ||
    (settings.production_csid_secret_encrypted && settings.production_csid_secret_iv
      ? decryptSecret(settings.production_csid_secret_encrypted, settings.production_csid_secret_iv)
      : "") ||
    (settings.compliance_csid_secret_encrypted && settings.compliance_csid_secret_iv
      ? decryptSecret(settings.compliance_csid_secret_encrypted, settings.compliance_csid_secret_iv)
      : "");

  return {
    privateKeyPem: privateKeyPlain ? secp256k1HexToPem(privateKeyPlain) : "",
    certificatePem: tokenPlain ? certificateTokenToPem(tokenPlain) : "",
    binarySecurityToken: tokenPlain,
    secret: secretPlain,
  };
}
