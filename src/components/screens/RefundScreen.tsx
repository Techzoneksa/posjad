"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { ORDER_TYPES } from "@/lib/data";
import { ArrowLeft, Loader2, Minus, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiAction } from "@/lib/api-client";
import {
  getOrder as getOrderFn,
  createRefund as createRefundFn,
  listRecentOrders as listRecentOrdersFn,
} from "@/lib/pos.functions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type OrderRow = {
  id: string;
  order_number: string;
  invoice_number: string | null;
  total_including_vat: number;
  status: string;
  created_at: string;
};

type LoadedItem = {
  id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  already_refunded_quantity: number;
  remaining_refundable_quantity: number;
  addons: { name_snapshot: string; price_delta_snapshot: number }[];
};

export function RefundScreen() {
  const { setScreen, t, lang, name, fmtMoney, refundOrderId, setRefundOrderId } = useApp();
  const getOrder = useApiAction(getOrderFn);
  const createRefund = useApiAction(createRefundFn);
  const listRecent = useApiAction(listRecentOrdersFn);

  const [list, setList] = useState<OrderRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<LoadedItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const rows: any = await listRecent({ data: { today: true, limit: 50 } });
      const filtered = (rows || []).filter(
        (r: any) => r.status !== "refunded" && r.status !== "cancelled",
      );
      setList(filtered);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load orders");
    } finally {
      setListLoading(false);
    }
  }, [listRecent]);

  const loadOrder = useCallback(
    async (id: string) => {
      setLoading(true);
      setOrder(null);
      setItems([]);
      setInvoiceNumber(null);
      setPicked({});
      try {
        const res: any = await getOrder({ data: { order_id: id } });
        setOrder(res.order);
        setItems(
          (res.items || []).map((it: any) => ({
            id: it.id,
            name_snapshot: it.name_snapshot,
            unit_price: Number(it.unit_price),
            quantity: it.quantity,
            line_total: Number(it.line_total),
            already_refunded_quantity: Number(it.already_refunded_quantity || 0),
            remaining_refundable_quantity: Math.max(
              0,
              Number(it.remaining_refundable_quantity ?? it.quantity),
            ),
            addons: it.addons || [],
          })),
        );
        setInvoiceNumber(res.invoice?.invoice_number ?? null);
        setPayments(
          (res.payments || []).map((p: any) => ({ method: p.method, amount: Number(p.amount) })),
        );
      } catch (e: any) {
        toast.error(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    },
    [getOrder],
  );

  useEffect(() => {
    if (refundOrderId) {
      loadOrder(refundOrderId);
    } else {
      loadList();
    }
  }, [refundOrderId, loadOrder, loadList]);

  const pickedQty = (id: string) => picked[id] ?? 0;
  const incPicked = (it: LoadedItem) =>
    setPicked((p) => ({
      ...p,
      [it.id]: Math.min(it.remaining_refundable_quantity, (p[it.id] ?? 0) + 1),
    }));
  const decPicked = (it: LoadedItem) =>
    setPicked((p) => ({ ...p, [it.id]: Math.max(0, (p[it.id] ?? 0) - 1) }));

  const anyPicked = Object.values(picked).some((v) => v > 0);
  const partialTotal = useMemo(() => {
    let s = 0;
    for (const it of items) s += it.unit_price * (picked[it.id] ?? 0);
    return Math.round(s * 100) / 100;
  }, [items, picked]);

  const remainingTotal = useMemo(() => {
    let s = 0;
    for (const it of items) s += it.unit_price * it.remaining_refundable_quantity;
    return Math.round(s * 100) / 100;
  }, [items]);

  const isRefundable =
    order && order.status !== "refunded" && order.status !== "cancelled" && remainingTotal > 0;
  const refundTotal = anyPicked ? partialTotal : remainingTotal;

  // Determine refund payment method: if order had a single positive payment use it, else cash
  const refundMethod = useMemo<
    "cash" | "card" | "mada" | "apple_pay" | "visa" | "mastercard" | "mixed"
  >(() => {
    const positive = payments.filter((p) => p.amount > 0);
    if (positive.length === 1) return positive[0].method as any;
    if (positive.length > 1) return "mixed";
    return "cash";
  }, [payments]);

  const confirm = async () => {
    if (!order || !isRefundable) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const type: "full" | "partial" = anyPicked ? "partial" : "full";
      const payload: any = {
        order_id: order.id,
        type,
        payment_method: refundMethod,
        reason: "POS refund",
      };
      if (type === "partial") {
        payload.items = items
          .filter((it) => (picked[it.id] ?? 0) > 0)
          .map((it) => ({ order_item_id: it.id, quantity: picked[it.id] }));
        if (!payload.items.length) {
          toast.error(lang === "ar" ? "اختر كمية للاسترجاع" : "Select quantity to refund");
          setSubmitting(false);
          return;
        }
      }
      await createRefund({ data: payload });
      toast.success(
        type === "full"
          ? lang === "ar"
            ? "تم الاسترجاع الكامل"
            : "Full refund completed"
          : lang === "ar"
            ? "تم الاسترجاع الجزئي"
            : "Partial refund completed",
      );
      setRefundOrderId(null);
      setScreen("orders");
    } catch (e: any) {
      toast.error(e?.message || "Refund failed");
    } finally {
      setSubmitting(false);
    }
  };

  const backToList = () => {
    setRefundOrderId(null);
    setOrder(null);
    loadList();
  };

  const filteredList = useMemo(() => {
    if (!q.trim()) return list;
    const term = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        r.order_number.toLowerCase().includes(term) ||
        (r.invoice_number || "").toLowerCase().includes(term),
    );
  }, [q, list]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        title={t.refund}
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRefundOrderId(null);
              setScreen("orders");
            }}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "ar" ? "الطلبات" : "Orders"}
          </Button>
        }
      />

      {!refundOrderId ? (
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                lang === "ar" ? "ابحث برقم الطلب أو الفاتورة" : "Search order/invoice number"
              }
              className="ps-9"
            />
          </div>
          <div className="card-soft max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {listLoading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!listLoading &&
              filteredList.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setRefundOrderId(o.id)}
                  className="flex w-full items-center justify-between rounded-lg p-3 text-start text-sm transition hover:bg-muted"
                >
                  <div>
                    <div className="font-semibold">{o.order_number}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {o.invoice_number || "—"}
                    </div>
                  </div>
                  <div className="text-end font-bold tabular-nums">
                    {fmtMoney(Number(o.total_including_vat))}
                  </div>
                </button>
              ))}
            {!listLoading && !filteredList.length && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد طلبات قابلة للاسترجاع" : "No refundable orders"}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl p-4">
          {loading ? (
            <div className="card-soft flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !order ? (
            <div className="card-soft p-12 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "تعذّر تحميل الطلب" : "Failed to load order"}
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={backToList}>
                  {lang === "ar" ? "رجوع" : "Back"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="card-soft p-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="text-xs text-muted-foreground">{t.invoiceNo}</div>
                  <div className="text-lg font-bold">
                    {invoiceNumber || "—"} • {order.order_number}
                  </div>
                </div>
                <span className="rounded-full bg-accent/40 px-3 py-1 text-xs font-semibold">
                  {name(ORDER_TYPES.find((o) => o.id === order.order_type) || ORDER_TYPES[0])}
                </span>
              </div>

              {!isRefundable && (
                <div className="my-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {lang === "ar" ? "هذا الطلب لا يمكن استرجاعه" : "This order cannot be refunded"}
                </div>
              )}

              <div className="my-4 space-y-2">
                {items.map((it) => {
                  const qty = pickedQty(it.id);
                  const on = qty > 0;
                  const fullyRefunded = it.remaining_refundable_quantity <= 0;
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-3",
                        on ? "border-destructive bg-destructive/5" : "",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {it.name_snapshot} × {it.quantity}
                        </div>
                        {it.addons.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {it.addons.map((a) => a.name_snapshot).join(" • ")}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {fmtMoney(it.unit_price)} × {it.quantity} = {fmtMoney(it.line_total)}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {lang === "ar" ? "مسترجع" : "Refunded"}: {it.already_refunded_quantity} •{" "}
                          {lang === "ar" ? "متبقي" : "Remaining"}:{" "}
                          {it.remaining_refundable_quantity}
                          {fullyRefunded && (
                            <span className="ms-2 text-destructive">
                              {lang === "ar" ? "مسترجع بالكامل" : "Fully refunded"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={qty === 0 || !isRefundable || fullyRefunded}
                          onClick={() => decPicked(it)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">
                          {qty}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={
                            qty >= it.remaining_refundable_quantity ||
                            !isRefundable ||
                            fullyRefunded
                          }
                          onClick={() => incPicked(it)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {anyPicked ? t.partialRefund : t.fullRefund}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-destructive">
                    {fmtMoney(refundTotal)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={backToList} disabled={submitting}>
                    {lang === "ar" ? "رجوع" : "Back"}
                  </Button>
                  <Button
                    onClick={confirm}
                    disabled={!isRefundable || submitting || refundTotal <= 0}
                    variant="destructive"
                    className="h-11 gap-2 px-6"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.confirm} {t.refund}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
