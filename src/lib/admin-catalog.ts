"use client";

// Hook for admin catalog management: full list (incl. inactive) + CRUD ops.
import { useCallback, useEffect, useState } from "react";
import { useApiAction } from "@/lib/api-client";
import {
  listCatalog,
  upsertCategory, deleteCategory,
  upsertProduct, deleteProduct,
  upsertAddonGroup, deleteAddonGroup,
  upsertAddon, deleteAddon,
  linkAddonGroup, unlinkAddonGroup,
} from "./catalog.functions";

export type AdminCategory = {
  id: string; name_ar: string; name_en: string; sort_order: number;
  color: string | null; icon: string | null; active: boolean;
};
export type AdminProduct = {
  id: string; category_id: string | null; name_ar: string; name_en: string;
  sku: string | null; price: number; image_url: string | null; tax_rate: number;
  active: boolean; product_type: string;
  calories: number | null; size: string | null;
};
export type AdminAddonGroup = {
  id: string; name_ar: string; name_en: string;
  min_select: number; max_select: number; required: boolean;
};
export type AdminAddon = {
  id: string; group_id: string; name_ar: string; name_en: string;
  price_delta: number; active: boolean;
};
export type AdminLink = { product_id: string; group_id: string; sort_order: number };

export function useAdminCatalog() {
  const fetchAll = useApiAction(listCatalog);
  const _upsertCategory = useApiAction(upsertCategory);
  const _deleteCategory = useApiAction(deleteCategory);
  const _upsertProduct = useApiAction(upsertProduct);
  const _deleteProduct = useApiAction(deleteProduct);
  const _upsertAddonGroup = useApiAction(upsertAddonGroup);
  const _deleteAddonGroup = useApiAction(deleteAddonGroup);
  const _upsertAddon = useApiAction(upsertAddon);
  const _deleteAddon = useApiAction(deleteAddon);
  const _link = useApiAction(linkAddonGroup);
  const _unlink = useApiAction(unlinkAddonGroup);

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [addonGroups, setAddonGroups] = useState<AdminAddonGroup[]>([]);
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [links, setLinks] = useState<AdminLink[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await fetchAll();
      setCategories(r.categories || []);
      setProducts(r.products || []);
      setAddonGroups(r.addonGroups || []);
      setAddons(r.addons || []);
      setLinks(r.productAddonGroups || []);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => { reload(); }, [reload]);

  return {
    loading, reload,
    categories, products, addonGroups, addons, links,
    upsertCategory: async (c: Partial<AdminCategory>) => { await _upsertCategory({ data: c as any }); await reload(); },
    deleteCategory: async (id: string) => { await _deleteCategory({ data: { id } }); await reload(); },
    upsertProduct: async (p: Partial<AdminProduct>) => { await _upsertProduct({ data: p as any }); await reload(); },
    deleteProduct: async (id: string) => { await _deleteProduct({ data: { id } }); await reload(); },
    upsertAddonGroup: async (g: Partial<AdminAddonGroup>) => { await _upsertAddonGroup({ data: g as any }); await reload(); },
    deleteAddonGroup: async (id: string) => { await _deleteAddonGroup({ data: { id } }); await reload(); },
    upsertAddon: async (a: Partial<AdminAddon>) => { await _upsertAddon({ data: a as any }); await reload(); },
    deleteAddon: async (id: string) => { await _deleteAddon({ data: { id } }); await reload(); },
    linkGroup: async (product_id: string, group_id: string, sort_order = 0) => {
      await _link({ data: { product_id, group_id, sort_order } }); await reload();
    },
    unlinkGroup: async (product_id: string, group_id: string) => {
      await _unlink({ data: { product_id, group_id } }); await reload();
    },
  };
}
