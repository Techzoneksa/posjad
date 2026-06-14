import { createApiAction } from "@/lib/api-client";

export const previewInvoiceForZatca = createApiAction("previewInvoiceForZatca", "POST");
export const submitInvoiceToZatcaManual = createApiAction("submitInvoiceToZatcaManual", "POST");
export const resolveInvoiceForZatca = createApiAction("resolveInvoiceForZatca", "POST");
