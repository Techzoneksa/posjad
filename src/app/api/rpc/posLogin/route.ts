import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createPosSessionCookie, posSessionCookieOptions } from "@/lib/pos-session.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadSupabaseModule() {
  // @ts-expect-error Express server modules are authored in JavaScript and traced into standalone at build time.
  return import("../../../../../server/src/lib/supabase.js");
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body ?? null, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body?.username ?? "").trim().toLowerCase();
    const pin = String(body?.pin ?? "").trim();

    if (!username || !pin) {
      return json({ error: "invalid_credentials", message: "Invalid POS credentials" }, 400);
    }

    const { supabaseAdmin } = await loadSupabaseModule();
    const { data, error } = await supabaseAdmin
      .rpc("verify_cashier_pin", {
        p_username: username,
        p_pin: pin,
      })
      .maybeSingle();

    if (error) {
      console.error("[posLogin] verify_cashier_pin failed", {
        code: error.code,
        message: error.message,
      });
      return json({ error: "invalid_credentials", message: "Invalid POS credentials" }, 400);
    }

    if (!data?.profile_id || !data?.cashier_id) {
      return json({ error: "invalid_credentials", message: "Invalid POS credentials" }, 400);
    }

    const session = createPosSessionCookie({
      cashierId: data.cashier_id,
      profileId: data.profile_id,
      username: data.username ?? username,
      fullName: data.full_name ?? data.username ?? username,
    });

    await supabaseAdmin
      .from("profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", data.profile_id);

    const response = json({
      id: data.profile_id,
      fullName: data.full_name ?? data.username ?? username,
      username: data.username ?? username,
      email: null,
      role: "cashier",
    });
    response.cookies.set({
      ...posSessionCookieOptions(),
      value: session,
    });
    return response;
  } catch (error: any) {
    console.error("[posLogin] failed", {
      message: error?.message ?? "Internal server error",
      code: error?.code,
    });
    return json({ error: "internal_server_error", message: "Internal server error" }, 500);
  }
}
