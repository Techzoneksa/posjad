"use client";

// Admins use Supabase Auth. POS cashiers use a dedicated server-side cookie session.
import { supabase } from "@/integrations/supabase/client";
import { apiFetch, POS_SESSION_STORAGE_KEY } from "@/lib/api-client";
import { getSessionUser, resolveAdminLogin } from "@/lib/auth.functions";

export type AppRole = "owner" | "manager" | "finance" | "cashier";

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: AppRole;
};

async function loadSessionUser(_userId: string, accessToken?: string | null): Promise<SessionUser | null> {
  return apiFetch<SessionUser>(getSessionUser, undefined, { accessToken });
}

export async function signInCashier(username: string, pin: string): Promise<SessionUser> {
  const response = await fetch("/api/rpc/posLogin", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username: username.trim(), pin }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error("Invalid credentials");
  }

  const u = data as SessionUser;
  if (u.role !== "cashier") {
    throw new Error("Not a cashier account");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(POS_SESSION_STORAGE_KEY, "1");
  }
  return u;
}

export async function signInAdmin(email: string, password: string): Promise<SessionUser> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(POS_SESSION_STORAGE_KEY);
  }

  let authEmail = email.trim();
  if (!authEmail.includes("@")) {
    const resolved = await apiFetch(resolveAdminLogin, { data: { login: authEmail } });
    authEmail = resolved.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (error || !data.user) {
    throw new Error("Invalid credentials");
  }
  const u = await loadSessionUser(data.user.id, data.session?.access_token);
  if (!u) {
    await supabase.auth.signOut();
    throw new Error("Profile missing");
  }
  if (u.role === "cashier") {
    await supabase.auth.signOut();
    throw new Error("Use POS login for cashiers");
  }
  await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", u.id);
  return u;
}

export async function signOut(posOnly = false) {
  const hasPosSession =
    typeof window !== "undefined" &&
    window.localStorage.getItem(POS_SESSION_STORAGE_KEY) === "1";

  if (posOnly || hasPosSession) {
    await fetch("/api/rpc/posLogout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(POS_SESSION_STORAGE_KEY);
    }
    return;
  }

  await supabase.auth.signOut();
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const hasPosSession =
    typeof window !== "undefined" &&
    window.localStorage.getItem(POS_SESSION_STORAGE_KEY) === "1";

  if (hasPosSession) {
    try {
      const posUser = await apiFetch<SessionUser>(getSessionUser, undefined, { skipAccessToken: true });
      if (posUser?.role === "cashier") return posUser;
    } catch {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(POS_SESSION_STORAGE_KEY);
      }
    }
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  try {
    return await loadSessionUser(data.session.user.id);
  } catch {
    return null;
  }
}
