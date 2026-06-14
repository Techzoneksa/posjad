"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp, type CompletedOrder, type CartItem } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ORDER_TYPES, PAYMENT_METHODS, VAT_RATE } from "@/lib/data";
import type { Product } from "@/lib/data";
import { ArrowLeft, Search, Printer, Undo2, Loader2, RefreshCw } from "lucide-react";
import { useApiAction } from "@/lib/api-client";
import { listRecentOrders, getOrder } from "@/lib/pos.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  order_number: string;
  invoice_number: string | null;
  order_type: string;
  status: string;
  subtotal_before_discount: number;
  discount_amount: number;
  total_including_vat: number;
  vat_included_amount: number;
  net_amount_excluding_vat: number;
  created_at: string;
  cashier_name: string;
  payment_method: string | null;
  customer_phone: string | null;
};

function statusBadge(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    new:                 { ar: "جديد",      en: "New",       cls: "bg-warning/20 text-warning" },
    preparing:           { ar: "قيد التجهيز", en: "Preparing", cls: "bg-warning/20 text-warning" },
    ready:               { ar: "جاهز",      en: "Ready",     cls: "bg-success/20 text-success" },
    completed:           { ar: "مكتمل",     en: "Completed", cls: "bg-success/20 text-success" },
    refunded:            { ar: "مسترجع",    en: "Refunded",  cls: "bg-destructive/15 text-destructive" },
    partially_refunded:  { ar: "استرجاع جزئي", en: "Partial refund", cls: "bg-destructive/10 text-destructive" },
    cancelled:           { ar: "ملغي",      en: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] || { ar: status, en: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", m.cls)}>{lang === "ar" ? m.ar : m.en}</span>;
}

export function RecentOrdersScreen() {
  const { setScreen, t, lang, fmtMoney, name, setLastOrder, setRefundOrderId } = useApp();
  const [q, setQ] = useState("");
  const [todayOnly, setTodayOnly] = useState(true);
  const [shiftOnly, setShiftOnly] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const listFn = useApiAction(listRecentOrders);
  const getFn = useApiAction(getOrder);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await listFn({ data: { q: q.trim() || undefined, today: todayOnly, shiftOnly, limit: 100, offset: 0 } });
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر تحميل الطلبات" : "Failed to load orders"));
    } finally {
      setLoading(false);
    }
  }, [listFn, q, todayOnly, shiftOnly, lang]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnly, shiftOnly]);

  const reprint = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const d: any = await getFn({ data: { order_id: orderId } });
      const o = d.order;
      const items: CartItem[] = (d.items || []).map((it: any) => {
        const product: Product = {
          id: it.product_id || it.id,
          ar: it.name_snapshot,
          en: it.name_snapshot,
          price: Number(it.unit_price),
          category: "",
        };
        const addons = (it.addons || []).map((a: any) => ({
          id: a.addon_id || a.id,
          ar: a.name_snapshot,
          en: a.name_snapshot,
          price: Number(a.price_delta_snapshot) || 0,
        }));
        return {
          uid: it.id,
          product,
          qty: it.quantity,
          removals: [],
          addons,
          note: it.notes || undefined,
        } as CartItem;
      });
      const pays = (d.payments || []).filter((p: any) => Number(p.amount) > 0);
      const payment = pays.length > 1 ? "mixed" : (pays[0]?.method || "cash");
      const order: CompletedOrder = {
        id: o.id,
        number: o.order_number,
        invoice: d.invoice?.invoice_number || "",
        time: new Date(o.created_at).getTime(),
        orderType: o.order_type,
        items,
        subtotal: Number(o.subtotal_before_discount),
        discount: Number(o.discount_amount),
        total: Number(o.total_including_vat),
        payment,
        cashier: d.cashier_name || "—",
        customerPhone: d.customer?.phone || undefined,
        refunded: o.status === "refunded" || o.status === "partially_refunded",
      };
      setLastOrder(order);
      setScreen("invoice");
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر فتح الفاتورة" : "Failed to open invoice"));
    } finally {
      setBusyId(null);
    }
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleString(
    lang === "ar" ? "ar-SA-u-ca-gregory" : "en-US",
    { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        title={t.recentOrders}
        right={<Button variant="ghost" size="sm" onClick={() => setScreen("pos")} className="gap-1"><ArrowLeft className="h-4 w-4" />POS</Button>}
      />
      <div className="mx-auto max-w-7xl space-y-3 p-4">
        <div className="card-soft flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              placeholder={`${t.search} ${t.orderNo} / ${t.invoiceNo}`}
              className="ps-9"
            />
          </div>
          <Button variant={todayOnly ? "default" : "outline"} size="sm" onClick={() => setTodayOnly(v => !v)}>{t.today}</Button>
          <Button variant={shiftOnly ? "default" : "outline"} size="sm" onClick={() => setShiftOnly(v => !v)}>
            {lang === "ar" ? "الوردية الحالية" : "Current shift"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{t.orderNo}</th>
                <th className="px-3 py-2 text-start">{t.invoiceNo}</th>
                <th className="px-3 py-2 text-start">{t.time}</th>
                <th className="px-3 py-2 text-start">{t.cashier}</th>
                <th className="px-3 py-2 text-start">{t.orderType}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الدفع" : "Payment"}</th>
                <th className="px-3 py-2 text-end">{t.discount}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "ض.م" : "VAT"}</th>
                <th className="px-3 py-2 text-end">{t.total}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} className="px-3 py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td></tr>
              )}
              {!loading && rows.map(o => {
                const ot = ORDER_TYPES.find(x => x.id === o.order_type);
                const pm = o.payment_method ? PAYMENT_METHODS.find(p => p.id === o.payment_method) : null;
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-semibold">{o.order_number}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.invoice_number || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtTime(o.created_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.cashier_name || "—"}</td>
                    <td className="px-3 py-2">{ot ? name(ot) : o.order_type}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pm ? name(pm) : (o.payment_method === "mixed" ? (lang === "ar" ? "مختلط" : "Mixed") : "—")}
                      {o.customer_phone && <div className="text-[10px] opacity-70">{o.customer_phone}</div>}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{Number(o.discount_amount) > 0 ? fmtMoney(Number(o.discount_amount)) : "—"}</td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{fmtMoney(Number(o.vat_included_amount))}</td>
                    <td className="px-3 py-2 text-end font-bold tabular-nums">{fmtMoney(Number(o.total_including_vat))}</td>
                    <td className="px-3 py-2">{statusBadge(o.status, lang)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => reprint(o.id)} title={t.reprint}>
                          {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                        </Button>
                        {o.status !== "refunded" && o.status !== "cancelled" && (
                          <Button size="sm" variant="ghost" onClick={() => { setRefundOrderId(o.id); setScreen("refund"); }} className="text-destructive" title={t.refund}>
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {lang === "ar" ? "لا توجد طلبات" : "No orders found"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {VAT_RATE ? `${lang === "ar" ? "الأسعار شاملة الضريبة" : "Prices include VAT"} ${(VAT_RATE * 100).toFixed(0)}%` : ""}
        </div>
      </div>
    </div>
  );
}
