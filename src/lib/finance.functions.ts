import { createApiAction } from "@/lib/api-client";

export const listFinanceAccounts = createApiAction("listFinanceAccounts", "POST");
export const upsertFinanceAccount = createApiAction("upsertFinanceAccount", "POST");
export const listAccountMovements = createApiAction("listAccountMovements", "POST");
export const transferBetweenAccounts = createApiAction("transferBetweenAccounts", "POST");
export const recordCashAdjustment = createApiAction("recordCashAdjustment", "POST");
export const listExpenses = createApiAction("listExpenses", "POST");
export const createExpense = createApiAction("createExpense", "POST");
export const listChartAccounts = createApiAction("listChartAccounts", "POST");
export const upsertChartAccount = createApiAction("upsertChartAccount", "POST");
export const listJournalEntries = createApiAction("listJournalEntries", "POST");
export const createJournalEntry = createApiAction("createJournalEntry", "POST");
export const reverseJournalEntry = createApiAction("reverseJournalEntry", "POST");
export const listSupplierPayments = createApiAction("listSupplierPayments", "POST");
export const createSupplierPayment = createApiAction("createSupplierPayment", "POST");
export const getFinanceSummary = createApiAction("getFinanceSummary", "POST");
