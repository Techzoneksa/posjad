import { env } from "../../config/env.js";
import { httpError } from "../../lib/http-error.js";

export function signingServiceConfigured() {
  return Boolean(env.zatcaSigningServiceUrl && env.zatcaSigningServiceSecret);
}

export async function signWithJavaService(payload) {
  if (!signingServiceConfigured()) {
    throw httpError(503, "ZATCA signing service is not configured");
  }

  const response = await fetch(`${env.zatcaSigningServiceUrl}/sign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${env.zatcaSigningServiceSecret}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: "non_json_response", message: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw httpError(response.status, body?.message || body?.error || "ZATCA signing service failed", body);
  }

  return body;
}
