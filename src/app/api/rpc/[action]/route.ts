import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ROLES = new Set(["owner", "manager", "finance", "cashier"]);
const SUPER_ADMIN_ALIASES = new Set(["super_admin"]);

type RpcRequest = {
  method: string;
  params: { action: string };
  query: Record<string, string>;
  body?: unknown;
  get(name: string): string | null;
  [key: string]: unknown;
};

type RouteContext = {
  params: Promise<{ action: string }>;
};

function json(body: unknown, status = 200) {
  return Response.json(body ?? null, { status });
}

function bearerFrom(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function collectRoleClaims(user: any) {
  const claims = [
    user?.app_metadata?.role,
    user?.app_metadata?.app_role,
    user?.user_metadata?.role,
    user?.user_metadata?.app_role,
    user?.role,
  ];
  if (Array.isArray(user?.app_metadata?.roles)) claims.push(...user.app_metadata.roles);
  if (Array.isArray(user?.user_metadata?.roles)) claims.push(...user.user_metadata.roles);
  return claims
    .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
    .filter(Boolean);
}

function normalizeAppRole(role: string) {
  if (SUPER_ADMIN_ALIASES.has(role)) return "owner";
  if (APP_ROLES.has(role)) return role;
  return null;
}

async function loadSupabaseModule() {
  // @ts-expect-error Express server modules are authored in JavaScript and traced into standalone at build time.
  return import("../../../../../server/src/lib/supabase.js");
}

async function loadActionRegistry() {
  // @ts-expect-error Express server modules are authored in JavaScript and traced into standalone at build time.
  return import("../../../../../server/src/controllers/actions/registry.js");
}

async function ensureProfile(uid: string, user: any, profile: any, supabaseAdmin: any) {
  if (profile) return profile;

  const emailPrefix = user.email?.split("@")[0] || `user_${uid.slice(0, 8)}`;
  let username = user.user_metadata?.username || user.app_metadata?.username || emailPrefix;
  const fullName = user.user_metadata?.full_name || user.app_metadata?.full_name || username;

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", uid)
    .maybeSingle();
  if (existing) username = `${username}_${uid.slice(0, 6)}`;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: uid,
      full_name: fullName,
      username,
      active: true,
    })
    .select("id, full_name, username, active, last_login")
    .single();
  if (error) throw error;
  return data;
}

function profileFromAuthUser(uid: string, user: any) {
  const emailPrefix = user.email?.split("@")[0] || `user_${uid.slice(0, 8)}`;
  const username = user.user_metadata?.username || user.app_metadata?.username || emailPrefix;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.app_metadata?.full_name ||
    user.app_metadata?.name ||
    username;

  return {
    id: uid,
    full_name: fullName,
    username,
    active: true,
    last_login: null,
  };
}

async function authenticate(request: NextRequest, req: RpcRequest) {
  const { createUserSupabase, supabaseAdmin, supabaseAuth } = await loadSupabaseModule();
  const token = bearerFrom(request);
  if (!token) {
    return json({
      error: "unauthorized",
      message: "Unauthorized: No authorization header provided",
    }, 401);
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    return json({
      error: "unauthorized",
      message: "Unauthorized: Invalid bearer token",
    }, 401);
  }

  const uid = data.user.id;
  const roleClaims = collectRoleClaims(data.user);
  const isSuperAdmin = roleClaims.some((role) => SUPER_ADMIN_ALIASES.has(role));
  const claimedAppRole = roleClaims.map(normalizeAppRole).find(Boolean);
  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, username, active, last_login").eq("id", uid).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
  ]);

  if (profileError) {
    console.error("[rpc/auth] profiles lookup failed", {
      uid,
      code: profileError.code,
      message: profileError.message,
    });
  }
  if (rolesError) {
    console.error("[rpc/auth] user_roles lookup failed", {
      uid,
      code: rolesError.code,
      message: rolesError.message,
    });
  }

  let normalizedProfile = profile;
  if (!normalizedProfile && !profileError) {
    try {
      normalizedProfile = await ensureProfile(uid, data.user, profile, supabaseAdmin);
    } catch {
      normalizedProfile = null;
    }
  }
  normalizedProfile ??= profileFromAuthUser(uid, data.user);

  if (normalizedProfile?.active === false) {
    return json({
      error: "unauthorized",
      message: "Unauthorized: Account disabled",
    }, 401);
  }

  const roleList = rolesError ? [] : (roles ?? []).map((r: { role: string }) => r.role);
  if (!claimedAppRole && roleList.length === 0 && data.user.email?.toLowerCase().endsWith("@pos.local")) {
    roleList.push("cashier");
  }
  if (claimedAppRole && (isSuperAdmin || roleList.length === 0) && !roleList.includes(claimedAppRole)) {
    const { error: upsertRoleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: claimedAppRole }, { onConflict: "user_id,role" });
    if (upsertRoleError) {
      console.error("[rpc/auth] user_roles upsert failed", {
        uid,
        role: claimedAppRole,
        code: upsertRoleError.code,
        message: upsertRoleError.message,
      });
    }
    roleList.push(claimedAppRole);
  }

  req.authToken = token;
  req.supabase = isSuperAdmin ? supabaseAdmin : createUserSupabase(token);
  req.supabaseAdmin = supabaseAdmin;
  req.auth = {
    uid,
    user: data.user,
    profile: normalizedProfile ?? null,
    roles: roleList,
    isSuperAdmin,
    isAdmin: roleList.includes("owner") || roleList.includes("manager"),
    isFinance: roleList.includes("finance"),
    isCashier: roleList.includes("cashier"),
  };
  return null;
}

async function inputFromRequest(request: NextRequest) {
  if (request.method === "GET") {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }

  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function handleRpc(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const action = params?.action;
    const { actionRegistry } = await loadActionRegistry();
    const entry = actionRegistry[action];
    if (!entry) return json({ error: "not_found", message: `Unknown RPC action: ${action}` }, 404);

    const req: RpcRequest = {
      method: request.method,
      params: { action },
      query: Object.fromEntries(new URL(request.url).searchParams.entries()),
      body: await inputFromRequest(request),
      get(name: string) {
        return request.headers.get(name);
      },
    };

    if (entry.auth !== false) {
      const authResponse = await authenticate(request, req);
      if (authResponse) return authResponse;
    }

    const input = request.method === "GET" ? req.query : req.body ?? {};
    const result = await entry.handler(input, req);
    return json(result ?? null);
  } catch (error: any) {
    console.error("[rpc] action failed", {
      path: new URL(request.url).pathname,
      method: request.method,
      status: Number(error?.status) || 500,
      message: error?.message ?? "Internal server error",
      code: error?.code,
    });
    const status = Number(error?.status) || 500;
    return json({
      error: status >= 500 ? "internal_server_error" : "request_failed",
      message: error?.message ?? "Internal server error",
    }, status);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleRpc(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRpc(request, context);
}
