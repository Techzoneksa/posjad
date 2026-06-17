import { NextResponse } from "next/server";
import { clearedPosSessionCookieOptions } from "@/lib/pos-session.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedPosSessionCookieOptions());
  return response;
}
