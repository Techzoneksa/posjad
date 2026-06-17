import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type PosSessionPayload = {
  cashierId: string;
  profileId: string;
  username: string;
  fullName: string;
  exp: number;
};

const COOKIE_NAME = "pos_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function sessionSecret() {
  const secret =
    process.env.POS_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing POS_SESSION_SECRET or compatible signing secret");
  return secret;
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string) {
  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createPosSessionCookie(payload: Omit<PosSessionPayload, "exp">) {
  const body: PosSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = b64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function readPosSession(request: NextRequest): PosSessionPayload | null {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PosSessionPayload;
    if (!parsed?.profileId || !parsed?.cashierId || !parsed?.username) return null;
    if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function posSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearedPosSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
