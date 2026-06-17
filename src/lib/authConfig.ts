"use client";

// Real auth via Supabase. Cashiers use synthetic email {username}@pos.local + PIN as password.
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { getSessionUser, resolveAdminLogin } from "@/lib/auth.functions";

export type AppRole = "owner" | "manager" | "finance" | "cashier";

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: AppRole;
};

function cashierEmail(username: string) {
  const login = username.trim().toLowerCase();
  return login.includes("@") ? login : `${login}@pos.local`;
}

async function loadSessionUser(_userId: string, accessToken?: string | null): Promise<SessionUser | null> {
  return apiFetch<SessionUser>(getSessionUser, undefined, { accessToken });
}

export async function signInCashier(username: string, pin: string): Promise<SessionUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cashierEmail(username),
    password: pin,
  });
  if (error || !data.user) {
    throw new Error("Invalid credentials");
  }
  const u = await loadSessionUser(data.user.id, data.session?.access_token);
  if (!u) {
    await supabase.auth.signOut();
    throw new Error("Profile missing");
  }
  if (u.role !== "cashier") {
    await supabase.auth.signOut();
    throw new Error("Not a cashier account");
  }
  await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", u.id);
  return u;
}

export async function signInAdmin(email: string, password: string): Promise<SessionUser> {
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

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  try {
    return await loadSessionUser(data.session.user.id);
  } catch {
    return null;
  }
}
