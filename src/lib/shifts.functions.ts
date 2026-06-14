import { createApiAction } from "@/lib/api-client";

export const getOpenShift = createApiAction("getOpenShift", "POST");
export const openShift = createApiAction("openShift", "POST");
export const closeShift = createApiAction("closeShift", "POST");
export const getShiftSummary = createApiAction("getShiftSummary", "POST");
export const listShifts = createApiAction("listShifts", "POST");
