import { createApiAction } from "@/lib/api-client";

export const bootstrapStatus = createApiAction("bootstrapStatus", "POST");
export const bootstrapOwner = createApiAction("bootstrapOwner", "POST");
