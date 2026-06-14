"use client";

import { useMemo, useState, useEffect } from "react";
import { useApp, type CartItem } from "@/lib/store";
import { useCatalog, type BAddon, type BAddonGroup } from "@/lib/catalog-context";
import { type Product } from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type SelMap = Record<string, string[]>; // group_id -> addon ids

export function ModifierDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t, name, lang, addToCart, fmtMoney } = useApp();
  const catalog = useCatalog();
  const [sel, setSel] = useState<SelMap>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const groups = useMemo<BAddonGroup[]>(
    () => (product ? catalog.groupsForProduct(product.id) : []),
    [product, catalog],
  );
  const addonsByGroup = useMemo(() => {
    const m: Record<string, BAddon[]> = {};
    for (const g of groups) m[g.id] = catalog.addonsForGroup(g.id);
    return m;
  }, [groups, catalog]);

  // Pre-select first option for required single-select groups
  useEffect(() => {
    if (!product) return;
    const init: SelMap = {};
    for (const g of groups) {
      if (g.required && g.min_select >= 1 && addonsByGroup[g.id]?.[0]) {
        init[g.id] = [addonsByGroup[g.id]?.[0]?.id ?? ""];
      } else init[g.id] = [];
    }
    setSel(init); setQty(1); setNote("");
  }, [product, groups, addonsByGroup]);

  if (!product) return null;

  const toggle = (g: BAddonGroup, addonId: string) => {
    setSel(prev => {
      const cur = prev[g.id] || [];
      const on = cur.includes(addonId);
      let next: string[];
      if (g.max_select === 1) next = on ? [] : [addonId];
      else if (on) next = cur.filter(x => x !== addonId);
      else if (cur.length >= g.max_select) next = cur;
      else next = [...cur, addonId];
      return { ...prev, [g.id]: next };
    });
  };

  const allSelectedAddons: BAddon[] = groups.flatMap(g =>
    (sel[g.id] || []).map(id => addonsByGroup[g.id].find(a => a.id === id)!).filter(Boolean)
  );

  const isRemovalGroup = (g: BAddonGroup) => /إزالة|Removal/i.test(g.name_en + g.name_ar);
  const isSpiceGroup = (g: BAddonGroup) => g.required && g.max_select === 1;

  const addonsPrice = allSelectedAddons.reduce((s, a) => s + Number(a.price_delta || 0), 0);
  const lineTotal = (product.price + addonsPrice) * qty;

  const canSubmit = groups.every(g => (sel[g.id]?.length || 0) >= g.min_select);

  const submit = () => {
    if (!canSubmit) return;
    const spice = groups.find(isSpiceGroup);
    const spiceSel = spice ? addonsByGroup[spice.id].find(a => a.id === (sel[spice.id]?.[0])) : undefined;
    const removals = groups.filter(isRemovalGroup).flatMap(g =>
      (sel[g.id] || []).map(id => {
        const a = addonsByGroup[g.id].find(x => x.id === id)!;
        return { id: a.id, ar: a.name_ar, en: a.name_en };
      })
    );
    const addons = groups.filter(g => !isSpiceGroup(g) && !isRemovalGroup(g)).flatMap(g =>
      (sel[g.id] || []).map(id => {
        const a = addonsByGroup[g.id].find(x => x.id === id)!;
        return { id: a.id, ar: a.name_ar, en: a.name_en, price: Number(a.price_delta) };
      })
    );
    const item: Omit<CartItem, "uid"> = {
      product, qty,
      spice: spiceSel ? { id: spiceSel.id, ar: spiceSel.name_ar, en: spiceSel.name_en } : undefined,
      removals, addons,
      note: note.trim() || undefined,
    };
    addToCart(item);
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-start text-lg">{name(product)}</DialogTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{fmtMoney(product.price)}</span>
            {product.cal && <span>• {product.cal} CAL</span>}
            {product.size && <span>• {product.size}</span>}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {groups.map(g => {
            const addons = addonsByGroup[g.id] || [];
            if (!addons.length) return null;
            const spice = isSpiceGroup(g);
            const removal = isRemovalGroup(g);
            return (
              <section key={g.id}>
                <h4 className="mb-2 text-sm font-semibold">
                  {name({ ar: g.name_ar, en: g.name_en })}
                  {g.required && <span className="text-destructive"> *</span>}
                  {g.max_select > 1 && <span className="ms-1 text-[10px] font-normal text-muted-foreground">(max {g.max_select})</span>}
                </h4>
                <div className={cn("gap-2", spice ? "grid grid-cols-2" : removal ? "flex flex-wrap" : "grid grid-cols-1 sm:grid-cols-2")}>
                  {addons.map(a => {
                    const on = (sel[g.id] || []).includes(a.id);
                    const baseCls = spice
                      ? cn("h-12 rounded-lg border text-sm font-medium transition", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")
                      : removal
                      ? cn("rounded-full border px-3 py-1.5 text-xs transition", on ? "border-destructive/40 bg-destructive/10 text-destructive" : "hover:bg-muted")
                      : cn("flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted");
                    return (
                      <button key={a.id} type="button" onClick={() => toggle(g, a.id)} className={baseCls}>
                        <span>{name({ ar: a.name_ar, en: a.name_en })}</span>
                        {!spice && !removal && Number(a.price_delta) > 0 && (
                          <span className="text-[11px] opacity-80">+{Number(a.price_delta).toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <h4 className="mb-2 text-sm font-semibold">{t.addNote}</h4>
            <Input value={note} onChange={e => setNote(e.target.value)}
              placeholder={lang === "ar" ? "ملاحظة خاصة للصنف..." : "Special note for this item..."} />
          </section>
        </div>

        <DialogFooter className="flex !flex-row items-center !justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2 rounded-full border p-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQty(q => q + 1)}><Plus className="h-4 w-4" /></Button>
          </div>
          <Button onClick={submit} disabled={!canSubmit} className="h-11 flex-1 bg-accent text-accent-foreground text-base font-semibold hover:bg-accent/90">
            {t.addToCart} • {fmtMoney(lineTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
