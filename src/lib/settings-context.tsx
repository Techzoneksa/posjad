"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useApiAction } from "@/lib/api-client";
import { getRestaurantSettings } from "./settings.functions";
import { supabase } from "@/integrations/supabase/client";

export type RestaurantSettings = {
  id: boolean;
  legal_name_ar: string;
  legal_name_en: string;
  brand_name_ar: string;
  brand_name_en: string;
  branch_ar: string;
  branch_en: string;
  vat_number: string;
  commercial_registration: string;
  national_address: string;
  vat_rate: number;
  prices_include_vat: boolean;
  receipt_width: "58mm" | "80mm";
  printer_type: "USB" | "Bluetooth" | "Network";
  print_method: "browser" | "driver";
  print_copies: number;
  logo_url: string | null;
  footer_note_ar: string;
  footer_note_en: string;
  updated_at: string;
};

const DEFAULT_SETTINGS: RestaurantSettings = {
  id: true,
  legal_name_ar: "نظام محاسبي متكامل",
  legal_name_en: "JAAD Trading Est.",
  brand_name_ar: "JAAD",
  brand_name_en: "JAAD",
  branch_ar: "الفرع الرئيسي",
  branch_en: "Main Branch",
  vat_number: "",
  commercial_registration: "",
  national_address: "",
  vat_rate: 0.15,
  prices_include_vat: true,
  receipt_width: "80mm",
  printer_type: "USB",
  print_method: "browser",
  print_copies: 2,
  logo_url: null,
  footer_note_ar: "شكرًا لزيارتكم",
  footer_note_en: "Thank you for your visit",
  updated_at: new Date().toISOString(),
};

type Ctx = {
  settings: RestaurantSettings;
  loading: boolean;
  reload: () => Promise<void>;
  applyLocal: (patch: Partial<RestaurantSettings>) => void;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const fetchSettings = useApiAction(getRestaurantSettings);
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = (await fetchSettings()) as RestaurantSettings;
      if (r) setSettings({ ...DEFAULT_SETTINGS, ...r });
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, [fetchSettings]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session?.user) load();
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) load();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [load]);

  return (
    <SettingsCtx.Provider value={{
      settings, loading, reload: load,
      applyLocal: (p) => setSettings((s) => ({ ...s, ...p })),
    }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("SettingsProvider missing");
  return c;
}
