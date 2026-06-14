import { createApiAction } from "@/lib/api-client";

export const getAutoRunnerStatus = createApiAction("getAutoRunnerStatus", "GET");
export const setQueueEnabled = createApiAction("setQueueEnabled", "POST");
export const startAutoRun = createApiAction("startAutoRun", "POST");
export const stopAutoRun = createApiAction("stopAutoRun", "POST");
export const advanceOneInvoice = createApiAction("advanceOneInvoice", "POST");
