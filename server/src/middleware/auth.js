import { createUserSupabase, supabaseAdmin, supabaseAuth } from "../lib/supabase.js";

function bearerFrom(req) {
  const header = req.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
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
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, username, active, last_login").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
    ]);

    if (profile && profile.active === false) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Unauthorized: Account disabled",
      });
    }

    const roleList = (roles ?? []).map((r) => r.role);
    req.authToken = token;
    req.supabase = createUserSupabase(token);
    req.supabaseAdmin = supabaseAdmin;
    req.auth = {
      uid,
      user: data.user,
      profile: profile ?? null,
      roles: roleList,
      isAdmin: roleList.includes("owner") || roleList.includes("manager"),
      isFinance: roleList.includes("finance"),
      isCashier: roleList.includes("cashier"),
    };

    next();
  } catch (error) {
    next(error);
  }
}
