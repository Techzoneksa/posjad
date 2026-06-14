import { createApiAction } from "@/lib/api-client";

export const listCatalog = createApiAction("listCatalog", "POST");
export const upsertCategory = createApiAction("upsertCategory", "POST");
export const deleteCategory = createApiAction("deleteCategory", "POST");
export const upsertProduct = createApiAction("upsertProduct", "POST");
export const deleteProduct = createApiAction("deleteProduct", "POST");
export const upsertAddonGroup = createApiAction("upsertAddonGroup", "POST");
export const deleteAddonGroup = createApiAction("deleteAddonGroup", "POST");
export const upsertAddon = createApiAction("upsertAddon", "POST");
export const deleteAddon = createApiAction("deleteAddon", "POST");
export const linkAddonGroup = createApiAction("linkAddonGroup", "POST");
export const unlinkAddonGroup = createApiAction("unlinkAddonGroup", "POST");
