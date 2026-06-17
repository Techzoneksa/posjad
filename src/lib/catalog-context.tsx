"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useApiAction } from "@/lib/api-client";
import { listCatalog } from "./catalog.functions";

export type BCategory = { id: string; name_ar: string; name_en: string; sort_order: number; color: string | null; icon: string | null; active: boolean };
export type BProduct = { id: string; category_id: string | null; name_ar: string; name_en: string; sku: string | null; price: number; image_url: string | null; tax_rate: number; active: boolean; product_type: string; calories: number | null; size: string | null };
export type BAddonGroup = { id: string; name_ar: string; name_en: string; min_select: number; max_select: number; required: boolean };
export type BAddon = { id: string; group_id: string; name_ar: string; name_en: string; price_delta: number; active: boolean };
export type BLink = { product_id: string; group_id: string; sort_order: number };

type Ctx = {
  loading: boolean;
  error: string | null;
  categories: BCategory[];
  products: BProduct[];
  addonGroups: BAddonGroup[];
  addons: BAddon[];
  productAddonGroups: BLink[];
  groupsForProduct: (productId: string) => BAddonGroup[];
  addonsForGroup: (groupId: string) => BAddon[];
  reload: () => Promise<void>;
};

const CatalogCtx = createContext<Ctx | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const fetchCatalog = useApiAction(listCatalog);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    categories: BCategory[]; products: BProduct[]; addonGroups: BAddonGroup[]; addons: BAddon[]; productAddonGroups: BLink[];
  }>({ categories: [], products: [], addonGroups: [], addons: [], productAddonGroups: [] });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetchCatalog();
      setData({
        categories: (r.categories as BCategory[]).filter(c => c.active),
        products: (r.products as BProduct[]).filter(p => p.active),
        addonGroups: r.addonGroups as BAddonGroup[],
        addons: (r.addons as BAddon[]).filter(a => a.active),
        productAddonGroups: r.productAddonGroups as BLink[],
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load catalog");
    } finally { setLoading(false); }
  }, [fetchCatalog]);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) load();
    return () => { cancelled = true; };
  }, [load]);

  const groupsForProduct = useCallback((productId: string) => {
    const ids = data.productAddonGroups.filter(l => l.product_id === productId).map(l => l.group_id);
    return data.addonGroups.filter(g => ids.includes(g.id));
  }, [data]);

  const addonsForGroup = useCallback((groupId: string) =>
    data.addons.filter(a => a.group_id === groupId), [data]);

  return (
    <CatalogCtx.Provider value={{
      loading, error,
      categories: data.categories, products: data.products,
      addonGroups: data.addonGroups, addons: data.addons,
      productAddonGroups: data.productAddonGroups,
      groupsForProduct, addonsForGroup, reload: load,
    }}>{children}</CatalogCtx.Provider>
  );
}

export function useCatalog() {
  const c = useContext(CatalogCtx);
  if (!c) throw new Error("CatalogProvider missing");
  return c;
}
