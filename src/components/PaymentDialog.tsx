"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/data";
import { Banknote, CreditCard, Smartphone, Wallet, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = {
  cash: Banknote, mada: CreditCard, apple_pay: Smartphone, visa: Wallet, mixed: Coins,
};

export function PaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, name, totals, completeOrder, fmtMoney } = useApp();
  const [selected, setSelected] = useState<string>("cash");
  const [cashGiven, setCashGiven] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const change = selected === "cash" && cashGiven ? Math.max(0, Number(cashGiven) - totals.total) : 0;


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">{t.pay}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl bg-muted/60 p-4 text-center">
            <div className="text-xs text-muted-foreground">{t.total}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{fmtMoney(totals.total)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{t.vatIncluded}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => {
              const Icon = ICONS[m.id];
              const on = selected === m.id;
              return (
                <button key={m.id} onClick={() => setSelected(m.id)}
                  className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition",
                    on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                  {Icon && <Icon className="h-5 w-5" />}
                  <span className="text-xs">{name(m)}</span>
                </button>
              );
            })}
          </div>

          {selected === "cash" && (
            <div className="space-y-2 rounded-xl border p-3">
              <label className="text-xs font-medium">{lang === "ar" ? "المبلغ المستلم" : "Amount received"}</label>
              <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-lg font-semibold tabular-nums outline-none focus:border-primary" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{lang === "ar" ? "الباقي" : "Change"}</span>
                <span className="font-semibold tabular-nums">{fmtMoney(change)}</span>
              </div>
            </div>
          )}

          <Button disabled={busy} onClick={async () => {
            if (busy) return;
            setBusy(true);
            const r = await completeOrder(selected);
            setBusy(false);
            if (r) onClose();
          }} className="h-12 w-full text-base font-semibold">
            {busy ? "..." : t.checkout}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
