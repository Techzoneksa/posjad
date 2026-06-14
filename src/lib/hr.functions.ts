import { createApiAction } from "@/lib/api-client";

export const listEmployees = createApiAction("listEmployees", "POST");
export const upsertEmployee = createApiAction("upsertEmployee", "POST");
export const setEmployeeStatus = createApiAction("setEmployeeStatus", "POST");
export const listEmployeeAdjustments = createApiAction("listEmployeeAdjustments", "POST");
export const createEmployeeAdjustment = createApiAction("createEmployeeAdjustment", "POST");
export const deleteEmployeeAdjustment = createApiAction("deleteEmployeeAdjustment", "POST");
export const previewPayroll = createApiAction("previewPayroll", "POST");
export const generatePayroll = createApiAction("generatePayroll", "POST");
export const listSalaryRecords = createApiAction("listSalaryRecords", "POST");
export const paySalaryRecord = createApiAction("paySalaryRecord", "POST");
