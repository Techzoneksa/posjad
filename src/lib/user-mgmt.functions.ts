import { createApiAction } from "@/lib/api-client";

export type AppRole = "owner" | "manager" | "finance" | "cashier";

export type UserDTO = {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: AppRole;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

export const listUsers = createApiAction("listUsers", "POST");
export const createUser = createApiAction("createUser", "POST");
export const updateUser = createApiAction("updateUser", "POST");
export const resetCredentials = createApiAction("resetCredentials", "POST");
export const setUserActive = createApiAction("setUserActive", "POST");
export const deleteUser = createApiAction("deleteUser", "POST");
