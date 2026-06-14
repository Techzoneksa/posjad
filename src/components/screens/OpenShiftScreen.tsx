"use client";

import { useApp } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function OpenShiftScreen() {
  const { openShift, t, lang } = useApp();
  const [cash, setCash] = useState("500");
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await openShift(Number(cash) || 0);
    } catch (e: any) {
      console.error("[OpenShift] failed:", e);
      toast.error(e?.message || (lang === "ar" ? "تعذر فتح الوردية" : "Failed to open shift"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={t.openShift} />
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="card-soft p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Banknote className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold">{t.openShift}</h2>
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "أدخل الرصيد الافتتاحي للوردية" : "Enter opening cash balance for the shift"}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t.openingCash}</label>
              <div className="relative">
                <Input
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleStart(); }}
                  type="number"
                  className="h-14 ps-3 pe-16 text-2xl font-semibold tabular-nums"
                  disabled={busy}
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
                  {lang === "ar" ? "ر.س" : "SAR"}
                </span>
              </div>
            </div>
            <Button
              onClick={handleStart}
              disabled={busy}
              className="h-12 w-full text-base font-semibold gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.start}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
