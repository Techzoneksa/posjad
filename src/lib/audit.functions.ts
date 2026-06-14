import { createApiAction } from "@/lib/api-client";

export const listAuditLogs = createApiAction("listAuditLogs", "POST");
export const getReadinessSnapshot = createApiAction("getReadinessSnapshot", "POST");
