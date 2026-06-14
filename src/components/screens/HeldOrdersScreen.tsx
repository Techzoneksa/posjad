"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { ORDER_TYPES } from "@/lib/data";
import { ArrowLeft, Play, Trash2, Clock, Loader2 } from "lucide-react";

export function HeldOrdersScreen() {
  const { heldOrders, heldLoading, refreshHeld, resumeHeld, deleteHeld, setScreen, t, lang, name, fmtMoney } = useApp();
  useEffect(() => { refreshHeld(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="min-h-screen bg-background">
      <TopBar title={t.heldOrders} right={<Button variant="ghost" size="sm" onClick={() => setScreen("pos")} className="gap-1"><ArrowLeft className="h-4 w-4" />POS</Button>} />
      <div className="mx-auto max-w-5xl p-4">
        {heldLoading && !heldOrders.length ? (
          <div className="card-soft flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : !heldOrders.length ? (
          <div className="card-soft py-16 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد طلبات معلقة" : "No held orders"}
          </div>

        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {heldOrders.map(h => {
              const sub = h.items.reduce((s, i) => s + (i.product.price + i.addons.reduce((a, x) => a + (x.price || 0), 0)) * i.qty, 0);
              const ot = ORDER_TYPES.find(o => o.id === h.orderType)!;
              return (
                <div key={h.id} className="card-soft p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{h.number}</div>
                    <span className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-semibold">{name(ot)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{new Date(h.time).toLocaleTimeString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{h.items.length} {h.items.length === 1 ? t.item : t.items}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-primary">{fmtMoney(sub)}</div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1 gap-1" onClick={() => resumeHeld(h.id)}><Play className="h-3.5 w-3.5" />{t.resume}</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteHeld(h.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
