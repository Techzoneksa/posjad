import { createUserSupabase, supabaseAdmin, supabaseAuth } from "../lib/supabase.js";

const APP_ROLES = new Set(["owner", "manager", "finance", "cashier"]);
const SUPER_ADMIN_ALIASES = new Set(["super_admin"]);

function bearerFrom(req) {
  const header = req.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function collectRoleClaims(user) {
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

function normalizeAppRole(role) {
  if (SUPER_ADMIN_ALIASES.has(role)) return "owner";
  if (APP_ROLES.has(role)) return role;
  return null;
}

async function ensureProfile(uid, user, profile) {
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

export async function requireSupabaseAuth(req, res, next) {
  try {
    const token = bearerFrom(req);
    if (!token) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Unauthorized: No authorization header provided",
      });
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Unauthorized: Invalid bearer token",
      });
    }

    const uid = data.user.id;
    const roleClaims = collectRoleClaims(data.user);
    const isSuperAdmin = roleClaims.some((role) => SUPER_ADMIN_ALIASES.has(role));
    const claimedAppRole = roleClaims.map(normalizeAppRole).find(Boolean);
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, username, active, last_login").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const normalizedProfile = await ensureProfile(uid, data.user, profile);

    if (normalizedProfile && normalizedProfile.active === false) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Unauthorized: Account disabled",
      });
    }

    const roleList = (roles ?? []).map((r) => r.role);
    if (claimedAppRole && (isSuperAdmin || roleList.length === 0) && !roleList.includes(claimedAppRole)) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: claimedAppRole }, { onConflict: "user_id,role" });
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

    next();
  } catch (error) {
    next(error);
  }
}
