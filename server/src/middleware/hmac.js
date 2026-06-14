import crypto from "node:crypto";

import { env } from "../config/env.js";

function parseSignature(value) {
  if (!value) return "";
  const raw = value.includes("=") ? value.split("=").pop() : value;
  return raw.trim();
}

export function verifyPublicHmac(req, res, next) {
  const secret = env.publicWebhookSecret;
  if (!secret) {
    return res.status(503).json({
      error: "webhook_secret_not_configured",
      message: "PUBLIC_WEBHOOK_HMAC_SECRET is required for /api/public endpoints",
    });
  }

  const provided = parseSignature(req.get("x-jaad-signature") ?? req.get("x-signature"));
  if (!provided) {
    return res.status(401).json({
      error: "invalid_signature",
      message: "Missing webhook signature",
    });
  }

  const body = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      error: "invalid_signature",
      message: "Webhook signature verification failed",
    });
  }

  next();
}
