"use client";

// Real auth via Supabase. Cashiers use synthetic email {username}@pos.local + PIN as password.
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "finance" | "cashier";

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: AppRole;
};

function cashierEmail(username: string) {
  return `${username.trim().toLowerCase()}@pos.local`;
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username, active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;
  if (!profile.active) {
    await supabase.auth.signOut();
    throw new Error("Account disabled");
  }
  const role = (roleRows?.[0]?.role ?? "cashier") as AppRole;
  const { data: auth } = await supabase.auth.getUser();
  return {
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    email: auth.user?.email ?? null,
    role,
  };
}

export async function signInCashier(username: string, pin: string): Promise<SessionUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cashierEmail(username),
    password: pin,
  });
  if (error || !data.user) throw new Error("Invalid credentials");
  const u = await loadSessionUser(data.user.id);
  if (!u) throw new Error("Profile missing");
  if (u.role !== "cashier") {
    await supabase.auth.signOut();
    throw new Error("Not a cashier account");
  }
  await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", u.id);
  return u;
}

export async function signInAdmin(email: string, password: string): Promise<SessionUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user) throw new Error("Invalid credentials");
  const u = await loadSessionUser(data.user.id);
  if (!u) throw new Error("Profile missing");
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
