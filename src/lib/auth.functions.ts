import { createApiAction } from "@/lib/api-client";

export type SessionUserResult = {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: "owner" | "manager" | "finance" | "cashier";
};

export const resolveAdminLogin = createApiAction<
  { login: string },
  { email: string }
>("resolveAdminLogin", "POST");

export const getSessionUser = createApiAction<void, SessionUserResult>("getSessionUser", "GET");
