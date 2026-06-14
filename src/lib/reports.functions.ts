import { createApiAction } from "@/lib/api-client";

export const getDashboardSummary = createApiAction("getDashboardSummary", "POST");
export const getDailySalesReport = createApiAction("getDailySalesReport", "POST");
export const getShiftReport = createApiAction("getShiftReport", "POST");
export const getEndOfDayReport = createApiAction("getEndOfDayReport", "POST");
export const getTopProductsReport = createApiAction("getTopProductsReport", "POST");
export const getSalesByPaymentMethod = createApiAction("getSalesByPaymentMethod", "POST");
export const getSalesByOrderType = createApiAction("getSalesByOrderType", "POST");
export const getSalesByCashier = createApiAction("getSalesByCashier", "POST");
export const getDiscountsReport = createApiAction("getDiscountsReport", "POST");
export const getRefundsReport = createApiAction("getRefundsReport", "POST");
export const listZReports = createApiAction("listZReports", "POST");
