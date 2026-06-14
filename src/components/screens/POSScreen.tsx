"use client";

import { useMemo, useState } from "react";
import { useApp, type Screen, isAdminRole } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { ORDER_TYPES, type Product } from "@/lib/data";
import { useCatalog } from "@/lib/catalog-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Minus, Plus, X, Trash2, Pause, CreditCard, Receipt, ListOrdered, Undo2, LayoutDashboard, Settings, Tag, ShoppingBag, Phone, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModifierDialog } from "@/components/ModifierDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { CashDrawerDialog } from "@/components/CashDrawerDialog";

export function POSScreen() {
  const app = useApp();
  const { t, lang, name, orderType, setOrderType, cart, fmtMoney, totals, updateQty, removeItem, holdOrder, clearCart, discount, setDiscount, customerPhone, setCustomerPhone, setScreen, user, heldOrders } = app;
  const catalog = useCatalog();
  const [cat, setCat] = useState<string>("");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Ensure a default category is selected once loaded
  const activeCat = cat || catalog.categories[0]?.id || "";

  const toProduct = (p: typeof catalog.products[number]): Product => ({
    id: p.id,
    ar: p.name_ar,
    en: p.name_en,
    price: Number(p.price),
    category: p.category_id || "",
    cal: p.calories ?? undefined,
    size: p.size ?? undefined,
    image_url: p.image_url ?? null,
  });

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? catalog.products.filter(p => p.name_ar.includes(search) || p.name_en.toLowerCase().includes(q))
      : catalog.products.filter(p => p.category_id === activeCat);
    return list.map(toProduct);
  }, [activeCat, search, catalog.products]);

  const onPick = (p: Product) => {
    const groups = catalog.groupsForProduct(p.id);
    if (groups.length > 0) return setActiveProduct(p);
    app.addToCart({ product: p, qty: 1, removals: [], addons: [] });
  };


  const quickActions: Array<{ id: string; icon: any; label: string; badge?: number; screen?: Screen; onClick?: () => void }> = [
    { id: "held", icon: Pause, label: t.heldOrders, badge: heldOrders.length, screen: "held" as Screen },
    { id: "orders", icon: ListOrdered, label: t.recentOrders, screen: "orders" as Screen },
    { id: "refund", icon: Undo2, label: t.refund, screen: "refund" as Screen },
    { id: "drawer", icon: Wallet, label: lang === "ar" ? "الدرج النقدي" : "Cash Drawer", onClick: () => setDrawerOpen(true) },
    ...(isAdminRole(user?.role) ? [{ id: "dash", icon: LayoutDashboard, label: t.dashboard, screen: "dashboard" as Screen }] : []),
    { id: "close", icon: Receipt, label: t.closeShift, screen: "close_shift" as Screen },
    { id: "settings", icon: Settings, label: t.settings, screen: "settings" as Screen },
  ];

  const handlePay = () => {
    setMobileCartOpen(false);
    setPayOpen(true);
  };

  const cartBody = (
    <>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <div className="text-xs text-muted-foreground">{t.cart}</div>
          <div className="text-sm font-bold">#{1006 + 0} • {name(ORDER_TYPES.find(o => o.id === orderType)!)}</div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
          <ShoppingBag className="h-3.5 w-3.5" />
          {cart.length} {cart.length === 1 ? t.item : t.items}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {!cart.length ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShoppingBag className="h-8 w-8 opacity-30" />
            <p>{t.noOrder}</p>
          </div>
        ) : cart.map(it => {
          const addonsP = it.addons.reduce((s, a) => s + (a.price || 0), 0);
          const line = (it.product.price + addonsP) * it.qty;
          return (
            <div key={it.uid} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{name(it.product)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {it.spice && <span className="rounded bg-muted px-1.5">{name(it.spice)}</span>}
                    {it.removals.map(r => <span key={r.id} className="rounded bg-destructive/10 px-1.5 text-destructive">{name(r)}</span>)}
                    {it.addons.map(a => <span key={a.id} className="rounded bg-primary/10 px-1.5 text-primary">+{name(a)}</span>)}
                  </div>
                  {it.note && <div className="mt-1 text-[10px] italic text-muted-foreground">"{it.note}"</div>}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeItem(it.uid)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-full border p-0.5">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => updateQty(it.uid, it.qty - 1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums">{it.qty}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => updateQty(it.uid, it.qty + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <span className="text-sm font-bold tabular-nums">{fmtMoney(line)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t p-3">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
            placeholder={t.customerPhone}
            className="h-10 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <div className="flex rounded-lg border p-0.5 text-[11px]">
            <button onClick={() => setDiscount({ ...discount, type: "fixed" })}
              className={cn("rounded-md px-2 py-1 font-medium", discount.type === "fixed" ? "bg-foreground text-background" : "")}>
              {t.fixed}
            </button>
            <button onClick={() => setDiscount({ ...discount, type: "percent" })}
              className={cn("rounded-md px-2 py-1 font-medium", discount.type === "percent" ? "bg-foreground text-background" : "")}>
              {t.percent}
            </button>
          </div>
          <input type="number" min={0} value={discount.value || ""}
            onChange={e => setDiscount({ ...discount, value: Number(e.target.value) || 0 })}
            placeholder="0"
            className="h-9 w-20 rounded-md border bg-background px-2 text-end text-sm tabular-nums outline-none" />
        </div>

        <dl className="space-y-1 text-xs">
          <Row label={t.subtotal} value={fmtMoney(totals.subtotal)} />
          {totals.discountAmt > 0 && <Row label={t.discount} value={`- ${fmtMoney(totals.discountAmt)}`} accent="text-destructive" />}
          <Row label={lang === "ar" ? "ضريبة القيمة المضافة 15%" : "VAT 15%"} value={fmtMoney(totals.vatPortion)} subtle />
        </dl>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-semibold">{t.total}</span>
          <span className="text-2xl font-bold tabular-nums text-primary">{fmtMoney(totals.total)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" disabled={!cart.length} onClick={holdOrder} className="gap-1 text-xs"><Pause className="h-3.5 w-3.5" />{t.hold}</Button>
          <Button variant="outline" size="sm" disabled={!cart.length} onClick={clearCart} className="gap-1 text-xs text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />{t.cancel}</Button>
          <Button disabled={!cart.length} onClick={handlePay} className="col-span-3 h-12 gap-2 text-base font-semibold">
            <CreditCard className="h-4 w-4" />
            {t.pay} • {fmtMoney(totals.total)}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar title={t.dashboard ? "POS" : ""} right={
        <div className="hidden flex-wrap gap-1 md:flex">
          {quickActions.map(a => (
            <Button key={a.id} variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => a.onClick ? a.onClick() : a.screen && setScreen(a.screen)}>
              <a.icon className="h-3.5 w-3.5" />
              <span>{a.label}</span>
              {a.badge ? <span className="ms-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{a.badge}</span> : null}
            </Button>
          ))}
        </div>
      } />

      <div className="grid flex-1 grid-cols-1 gap-4 p-3 pb-36 md:grid-cols-[1fr_340px] md:p-4 md:pb-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
        {/* LEFT: products */}
        <div className="flex flex-col gap-3">
          {/* Order type */}
          <div className="card-soft flex flex-wrap items-center gap-2 p-2">
            <span className="hidden px-2 text-xs font-medium text-muted-foreground sm:inline">{t.orderType}:</span>
            <div className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-thin sm:flex-initial sm:gap-2">
              {ORDER_TYPES.map(o => (
                <button key={o.id} onClick={() => setOrderType(o.id)}
                  className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4",
                    orderType === o.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}>
                  {name(o)}
                </button>
              ))}
            </div>
            <div className="ms-auto w-full sm:w-64">
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === "ar" ? "ابحث عن صنف..." : "Search items..."} className="h-9" />
            </div>
          </div>

          {/* Categories */}
          <div className="card-soft flex gap-2 overflow-x-auto p-2 scrollbar-thin">
            {catalog.categories.map(c => (
              <button key={c.id} onClick={() => { setCat(c.id); setSearch(""); }}
                className={cn("whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  activeCat === c.id && !search ? "bg-foreground text-background" : "hover:bg-muted")}>
                {name({ ar: c.name_ar, en: c.name_en })}
              </button>
            ))}
          </div>


          {/* Products grid */}
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {products.map(p => (
              <button key={p.id} onClick={() => onPick(p)}
                className="card-soft group relative flex flex-col overflow-hidden text-start transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={name(p)}
                      loading="lazy"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground/40">
                      {name(p).charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-1.5 p-2.5 sm:p-3">
                  <div className="space-y-1">
                    <div className="line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-tight sm:text-sm">{name(p)}</div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {p.size && <span className="rounded bg-muted px-1.5 py-0.5">{p.size}</span>}
                      {p.cal && <span>{p.cal} CAL</span>}
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-base font-bold tabular-nums text-primary sm:text-lg">{p.price}</span>
                    <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "ر.س" : "SAR"}</span>
                  </div>
                </div>
              </button>
            ))}
            {!products.length && (
              <div className="col-span-full flex items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                {catalog.loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {lang === "ar" ? "جاري التحميل..." : "Loading..."}</> : (lang === "ar" ? "لا توجد نتائج" : "No results")}
              </div>

            )}
          </div>
        </div>

        {/* RIGHT: Cart (tablet landscape + desktop) — fixed-height column, pay button always visible */}
        <aside className="card-soft sticky top-20 hidden h-[calc(100vh-6rem)] flex-col self-start overflow-hidden md:flex">
          {cartBody}
        </aside>
      </div>

      {/* Mobile floating cart bar */}
      <div className="fixed inset-x-0 bottom-12 z-30 px-3 md:hidden">
        <button
          onClick={() => setMobileCartOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.99]">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4" />
            {cart.length} {cart.length === 1 ? t.item : t.items}
          </span>
          <span className="flex items-center gap-2 text-sm font-bold tabular-nums">
            {fmtMoney(totals.total)}
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[11px] font-medium">
              {cart.length ? t.pay : t.cart}
            </span>
          </span>
        </button>
      </div>

      {/* Mobile bottom quick actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-1 overflow-x-auto border-t bg-card p-2 scrollbar-thin md:hidden">
        {quickActions.map(a => (
          <Button key={a.id} variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => a.onClick ? a.onClick() : a.screen && setScreen(a.screen)}>
            <a.icon className="h-3.5 w-3.5" />{a.label}
            {a.badge ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{a.badge}</span> : null}
          </Button>
        ))}
      </div>

      {/* Mobile cart sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="flex h-[92vh] flex-col p-0 md:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{t.cart}</SheetTitle>
          </SheetHeader>
          {cartBody}
        </SheetContent>
      </Sheet>

      <ModifierDialog product={activeProduct} onClose={() => setActiveProduct(null)} />
      <PaymentDialog open={payOpen} onClose={() => setPayOpen(false)} />
      <CashDrawerDialog open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function Row({ label, value, subtle, accent }: { label: string; value: string; subtle?: boolean; accent?: string }) {
  return (
    <div className={cn("flex justify-between", subtle && "text-muted-foreground")}>
      <dt>{label}</dt>
      <dd className={cn("tabular-nums font-medium", accent)}>{value}</dd>
    </div>
  );
}
