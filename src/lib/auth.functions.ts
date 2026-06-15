import { createApiAction } from "@/lib/api-client";

export const resolveAdminLogin = createApiAction<
  { login: string },
  { email: string }
>("resolveAdminLogin", "POST");
