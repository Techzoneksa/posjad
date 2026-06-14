import { createApiAction } from "@/lib/api-client";

export const createOrder = createApiAction("createOrder", "POST");
export const updateOrderStatus = createApiAction("updateOrderStatus", "POST");
export const listRecentOrders = createApiAction("listRecentOrders", "POST");
export const getOrder = createApiAction("getOrder", "POST");
export const findCustomerByPhone = createApiAction("findCustomerByPhone", "POST");
export const findOrCreateCustomerByPhone = createApiAction("findOrCreateCustomerByPhone", "POST");
export const listCustomers = createApiAction("listCustomers", "POST");
export const upsertCustomer = createApiAction("upsertCustomer", "POST");
export const createRefund = createApiAction("createRefund", "POST");
export const listRefunds = createApiAction("listRefunds", "POST");
export const holdOrder = createApiAction("holdOrder", "POST");
export const listHeldOrders = createApiAction("listHeldOrders", "POST");
export const resumeHeldOrder = createApiAction("resumeHeldOrder", "POST");
export const discardHeldOrder = createApiAction("discardHeldOrder", "POST");
export const recordCashMovement = createApiAction("recordCashMovement", "POST");
export const listCashMovements = createApiAction("listCashMovements", "POST");
