"use client";

import type { ReactNode } from "react";
import { CatalogProvider } from "@/lib/catalog-context";
import { SettingsProvider } from "@/lib/settings-context";
import { Phase3Provider } from "@/lib/phase3Store";
import { Phase5Provider } from "@/lib/phase5Store";
import { Phase6Provider } from "@/lib/phase6Store";

type ProviderMode = "root" | "pos" | "admin";

export default function AppDataProviders({
  children,
  mode = "root",
}: {
  children: ReactNode;
  mode?: ProviderMode;
}) {
  if (mode === "pos") {
    return (
      <SettingsProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
      <CatalogProvider>
        <Phase3Provider>
          <Phase5Provider>
            <Phase6Provider>{children}</Phase6Provider>
          </Phase5Provider>
        </Phase3Provider>
      </CatalogProvider>
    </SettingsProvider>
  );
}
