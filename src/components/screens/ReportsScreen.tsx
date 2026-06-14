"use client";

// Sprint B — Reports Hub.
// Tabbed admin reports screen pulling 100% real data from the backend.
// Tabs: Daily Sales · Z-Reports · End-of-Day · Top Products · Payment Method
//       · Order Type · Cashier · Discounts · Refunds.

import { useEffect, useMemo, useState } from "react";
import { useApiAction } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { useSettings } from "@/lib/settings-context";
import { ManagerLayout } from "@/components/screens/ManagerScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Printer, RefreshCw, BarChart3, FileText, Calendar, Trophy, CreditCard, ShoppingCart, Users, Percent, Undo2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDailySalesReport, getShiftReport, getEndOfDayReport,
  getTopProductsReport, getSalesByPaymentMethod, getSalesByOrderType,
  getSalesByCashier, getDiscountsReport, getRefundsReport, listZReports,
} from "@/lib/reports.functions";
import { toast } from "sonner";
import { riyadhToday } from "@/lib/riyadh-date";

const todayIso = () => riyadhToday();

const fmtDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    timeZone: "Asia/Riyadh", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

const fmtDay = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  });

const ORDER_TYPE_LABEL: Record<string, { ar: string; en: string }> = {
  dine_in: { ar: "داخل المحل", en: "Dine-in" },
  takeaway: { ar: "سفري", en: "Takeaway" },
  delivery_app: { ar: "تطبيقات توصيل", en: "Delivery Apps" },
  delivery: { ar: "توصيل", en: "Delivery" },
};

const METHOD_LABEL: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  mada: { ar: "مدى", en: "Mada" },
  apple_pay: { ar: "Apple Pay", en: "Apple Pay" },
  visa: { ar: "Visa", en: "Visa" },
  mastercard: { ar: "Mastercard", en: "Mastercard" },
  card: { ar: "شبكة", en: "Card" },
  mixed: { ar: "دفع مركب", en: "Mixed" },
};

const STATUS_LABEL: Record<string, { ar: string; en: string; tone: string }> = {
  completed: { ar: "مكتمل", en: "Completed", tone: "bg-success/15 text-success" },
  partially_refunded: { ar: "مرتجع جزئي", en: "Partial Refund", tone: "bg-warning/20 text-warning" },
  refunded: { ar: "مرتجع كامل", en: "Refunded", tone: "bg-destructive/15 text-destructive" },
  cancelled: { ar: "ملغي", en: "Cancelled", tone: "bg-muted text-muted-foreground" },
};

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-soft p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Empty({ lang }: { lang: string }) {
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
      <BarChart3 className="h-8 w-8 opacity-50" />
      <div className="text-sm">{lang === "ar" ? "لا توجد بيانات في النطاق المحدد" : "No data in selected range"}</div>
    </div>
  );
}

function LoadingBlock() {
  return <div className="card-soft flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-sm text-destructive">{message}</div>
      <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="me-1 h-3.5 w-3.5" />Retry</Button>
    </div>
  );
}

function useReportQuery<T>(fn: any, params: any, deps: any[]) {
  const call = useApiAction(fn);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setLoading(true); setError(null);
    try { setData(await call({ data: params })); }
    catch (e: any) { setError(e?.message ?? "Failed to load report"); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, loading, error, reload: run };
}

/* ───────── Filters bar ───────── */
type Filters = { date: string; cashier_id?: string; order_type?: string; payment_method?: string };

function FiltersBar({
  lang, value, onChange, cashiers, showOrderType = true, showPaymentMethod = true,
}: {
  lang: string;
  value: Filters;
  onChange: (v: Filters) => void;
  cashiers: { id: string; name: string }[];
  showOrderType?: boolean;
  showPaymentMethod?: boolean;
}) {
  const set = (k: keyof Filters, v: any) => onChange({ ...value, [k]: v === "__all__" ? undefined : v });
  return (
    <div className="card-soft mb-4 flex flex-wrap items-end gap-3 p-3">
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "التاريخ" : "Date"}</Label>
        <Input type="date" value={value.date} onChange={(e) => set("date", e.target.value)} className="h-9 w-40" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => set("date", todayIso())}>{lang === "ar" ? "اليوم" : "Today"}</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          set("date", d.toISOString().slice(0, 10));
        }}>{lang === "ar" ? "أمس" : "Yesterday"}</Button>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "الكاشير" : "Cashier"}</Label>
        <Select value={value.cashier_id ?? "__all__"} onValueChange={(v) => set("cashier_id", v)}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
            {cashiers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {showOrderType && (
        <div>
          <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "نوع الطلب" : "Order type"}</Label>
          <Select value={value.order_type ?? "__all__"} onValueChange={(v) => set("order_type", v)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              {["dine_in","takeaway","delivery_app"].map(t =>
                <SelectItem key={t} value={t}>{lang === "ar" ? ORDER_TYPE_LABEL[t].ar : ORDER_TYPE_LABEL[t].en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {showPaymentMethod && (
        <div>
          <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "طريقة الدفع" : "Payment"}</Label>
          <Select value={value.payment_method ?? "__all__"} onValueChange={(v) => set("payment_method", v)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              {["cash","mada","apple_pay","visa","mastercard","mixed"].map(m =>
                <SelectItem key={m} value={m}>{lang === "ar" ? METHOD_LABEL[m].ar : METHOD_LABEL[m].en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/* ───────── Daily Sales tab ───────── */
function DailySalesTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const params = { date: filters.date, cashier_id: filters.cashier_id, order_type: filters.order_type as any, payment_method: filters.payment_method as any };
  const q = useReportQuery<any>(getDailySalesReport, params, [JSON.stringify(params)]);

  return (
    <>
      <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} />
      {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <SummaryCard label={lang === "ar" ? "إجمالي" : "Gross"} value={fmtMoney(q.data!.summary.gross)} />
            <SummaryCard label={lang === "ar" ? "الخصومات" : "Discounts"} value={fmtMoney(q.data!.summary.discounts)} />
            <SummaryCard label={lang === "ar" ? "الاسترجاع" : "Refunds"} value={fmtMoney(q.data!.summary.refunds)} />
            <SummaryCard label={lang === "ar" ? "صافي المبيعات" : "Net"} value={fmtMoney(q.data!.summary.net)} />
            <SummaryCard label={lang === "ar" ? "ضريبة شاملة" : "VAT (incl.)"} value={fmtMoney(q.data!.summary.vatIncluded)} />
            <SummaryCard label={lang === "ar" ? "عدد الطلبات" : "Orders"} value={String(q.data!.summary.ordersCount)} hint={`${lang === "ar" ? "متوسط" : "AOV"} ${fmtMoney(q.data!.summary.aov)}`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {["cash","mada","apple_pay","visa","mastercard","mixed"].map(m => (
              <SummaryCard key={m} label={lang === "ar" ? METHOD_LABEL[m].ar : METHOD_LABEL[m].en} value={fmtMoney(q.data!.summary.totals[m] ?? 0)} />
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => printReport("daily_sales", q.data, filters.date, lang)}>
              <Printer className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "طباعة" : "Print"}
            </Button>
          </div>

          {q.data!.rows.length === 0 ? <Empty lang={lang} /> : (
            <div className="card-soft mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الوقت" : "Time"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الطلب" : "Order #"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الدفع" : "Payment"}</th>
                    <th className="px-3 py-2 text-end">{lang === "ar" ? "فرعي" : "Subtotal"}</th>
                    <th className="px-3 py-2 text-end">{lang === "ar" ? "خصم" : "Disc."}</th>
                    <th className="px-3 py-2 text-end">{lang === "ar" ? "ضريبة" : "VAT"}</th>
                    <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي" : "Total"}</th>
                    <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data!.rows.map((r: any) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-xs">{fmtDate(r.time, lang)}</td>
                      <td className="px-3 py-2 font-medium">{r.order_number}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.invoice_number || "—"}</td>
                      <td className="px-3 py-2">{r.cashier_name || "—"}</td>
                      <td className="px-3 py-2 text-xs">{ORDER_TYPE_LABEL[r.order_type]?.[lang === "ar" ? "ar" : "en"] || r.order_type}</td>
                      <td className="px-3 py-2 text-xs">{r.payment_method ? (METHOD_LABEL[r.payment_method]?.[lang === "ar" ? "ar" : "en"] || r.payment_method) : "—"}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.subtotal)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.discount)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.vat_included)}</td>
                      <td className="px-3 py-2 text-end font-semibold tabular-nums">{fmtMoney(r.total)}</td>
                      <td className="px-3 py-2"><Badge className={cn("text-[10px]", STATUS_LABEL[r.status]?.tone)}>{STATUS_LABEL[r.status]?.[lang === "ar" ? "ar" : "en"] || r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ───────── Z-Reports tab ───────── */
function ZReportsTab() {
  const { lang, fmtMoney } = useApp();
  const list = useReportQuery<any[]>(listZReports, { limit: 50, include_open: true }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useReportQuery<any>(getShiftReport, selected ? { shift_id: selected } : { shift_id: "00000000-0000-0000-0000-000000000000" }, [selected]);

  if (list.loading) return <LoadingBlock />;
  if (list.error) return <ErrorBlock message={list.error} onRetry={list.reload} />;
  if (!list.data?.length) return <Empty lang={lang} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="card-soft overflow-hidden">
        <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold">{lang === "ar" ? "الورديات" : "Shifts"}</div>
        <div className="max-h-[640px] overflow-y-auto">
          {list.data!.map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={cn("flex w-full flex-col gap-1 border-b px-3 py-2 text-start hover:bg-muted/40",
                selected === s.id && "bg-primary/10")}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{s.cashier_name || "—"}</span>
                <Badge variant="outline" className="text-[10px]">{s.status === "open" ? (lang === "ar" ? "مفتوحة" : "Open") : (lang === "ar" ? "مغلقة" : "Closed")}</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {fmtDate(s.opened_at, lang)}
                {s.closed_at && <> → {fmtDate(s.closed_at, lang)}</>}
              </div>
              <div className="text-[11px] text-muted-foreground">ID: {s.id.slice(0, 8)}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        {!selected ? (
          <div className="card-soft p-10 text-center text-sm text-muted-foreground">{lang === "ar" ? "اختر وردية لعرض تقرير Z" : "Select a shift to view its Z-Report"}</div>
        ) : detail.loading ? <LoadingBlock /> :
          detail.error ? <ErrorBlock message={detail.error} onRetry={detail.reload} /> : (
          <>
            <div className="mb-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={detail.reload}><RefreshCw className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تحديث" : "Refresh"}</Button>
              <Button size="sm" onClick={() => printReport("zreport", detail.data, selected!, lang)}><Printer className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "طباعة Z" : "Print Z"}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label={lang === "ar" ? "الكاشير" : "Cashier"} value={detail.data!.shift.cashier_name || "—"} />
              <SummaryCard label={lang === "ar" ? "الحالة" : "Status"} value={detail.data!.shift.status === "open" ? (lang === "ar" ? "مفتوحة" : "Open") : (lang === "ar" ? "مغلقة" : "Closed")} />
              <SummaryCard label={lang === "ar" ? "وقت الفتح" : "Opened"} value={fmtDate(detail.data!.shift.opened_at, lang)} />
              <SummaryCard label={lang === "ar" ? "وقت الإغلاق" : "Closed"} value={detail.data!.shift.closed_at ? fmtDate(detail.data!.shift.closed_at, lang) : "—"} />

              <SummaryCard label={lang === "ar" ? "الرصيد الافتتاحي" : "Opening cash"} value={fmtMoney(detail.data!.openingCash)} />
              <SummaryCard label={lang === "ar" ? "مبيعات نقدية" : "Cash sales"} value={fmtMoney(detail.data!.cashSales)} />
              <SummaryCard label={lang === "ar" ? "استرجاع نقدي" : "Cash refunds"} value={fmtMoney(detail.data!.cashRefunds)} />
              <SummaryCard label={lang === "ar" ? "إيداع للدرج" : "Pay-in"} value={fmtMoney(detail.data!.payIn)} />
              <SummaryCard label={lang === "ar" ? "صرف من الدرج" : "Pay-out"} value={fmtMoney(detail.data!.payOut)} />
              <SummaryCard label={lang === "ar" ? "النقد المتوقع" : "Expected cash"} value={fmtMoney(detail.data!.expectedCash)} />
              <SummaryCard label={lang === "ar" ? "النقد الفعلي" : "Actual cash"} value={detail.data!.actualCash != null ? fmtMoney(detail.data!.actualCash) : "—"} />
              <SummaryCard label={lang === "ar" ? "الفرق" : "Variance"} value={detail.data!.variance != null ? fmtMoney(detail.data!.variance) : "—"} />

              <SummaryCard label={lang === "ar" ? "مدى" : "Mada"} value={fmtMoney(detail.data!.byMethod.mada)} />
              <SummaryCard label="Apple Pay" value={fmtMoney(detail.data!.byMethod.apple_pay)} />
              <SummaryCard label="Visa" value={fmtMoney(detail.data!.byMethod.visa)} />
              <SummaryCard label="Mastercard" value={fmtMoney(detail.data!.byMethod.mastercard)} />
              <SummaryCard label={lang === "ar" ? "دفع مركب" : "Mixed"} value={fmtMoney(detail.data!.mixedTotal)} />

              <SummaryCard label={lang === "ar" ? "إجمالي" : "Gross"} value={fmtMoney(detail.data!.gross)} />
              <SummaryCard label={lang === "ar" ? "صافي" : "Net"} value={fmtMoney(detail.data!.net)} />
              <SummaryCard label={lang === "ar" ? "خصومات" : "Discounts"} value={fmtMoney(detail.data!.discounts)} />
              <SummaryCard label={lang === "ar" ? "استرجاع" : "Refunds"} value={fmtMoney(detail.data!.refunds)} />
              <SummaryCard label={lang === "ar" ? "عدد الطلبات" : "Orders"} value={String(detail.data!.ordersCount)} />
              <SummaryCard label={lang === "ar" ? "عمليات استرجاع" : "Refund count"} value={String(detail.data!.refundCount)} />
              <SummaryCard label={lang === "ar" ? "طلبات معلقة" : "Held orders"} value={String(detail.data!.heldCount)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── End-of-Day tab ───────── */
function EndOfDayTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getEndOfDayReport, { date: filters.date, cashier_id: filters.cashier_id }, [filters.date, filters.cashier_id]);

  return (
    <>
      <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showOrderType={false} showPaymentMethod={false} />
      {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => printReport("eod", q.data, filters.date, lang)}><Printer className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "طباعة EOD" : "Print EOD"}</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <SummaryCard label={lang === "ar" ? "إجمالي" : "Total sales"} value={fmtMoney(q.data!.summary.gross)} />
            <SummaryCard label={lang === "ar" ? "خصومات" : "Discounts"} value={fmtMoney(q.data!.summary.discounts)} />
            <SummaryCard label={lang === "ar" ? "استرجاع" : "Refunds"} value={fmtMoney(q.data!.summary.refunds)} />
            <SummaryCard label={lang === "ar" ? "صافي" : "Net"} value={fmtMoney(q.data!.summary.net)} />
            <SummaryCard label={lang === "ar" ? "ضريبة" : "VAT (incl.)"} value={fmtMoney(q.data!.summary.vatIncluded)} />
            <SummaryCard label={lang === "ar" ? "عدد الطلبات" : "Orders"} value={String(q.data!.summary.ordersCount)} hint={`${lang === "ar" ? "متوسط" : "AOV"} ${fmtMoney(q.data!.summary.aov)}`} />
            <SummaryCard label={lang === "ar" ? "نقدي" : "Cash"} value={fmtMoney(q.data!.summary.cashTotal)} />
            <SummaryCard label={lang === "ar" ? "شبكة/بطاقات" : "Card/Network"} value={fmtMoney(q.data!.summary.cardNetworkTotal)} />
            <SummaryCard label="Apple Pay" value={fmtMoney(q.data!.summary.applePayTotal)} />
            <SummaryCard label="Visa/MC" value={fmtMoney(q.data!.summary.visaMcTotal)} />
            <SummaryCard label={lang === "ar" ? "عدد الورديات" : "Shifts"} value={String(q.data!.summary.shiftsCount)} />
            <SummaryCard label={lang === "ar" ? "إجمالي الفروقات" : "Variance"} value={fmtMoney(q.data!.summary.cashVarianceTotal)} />
            <SummaryCard label={lang === "ar" ? "إيداع درج" : "Pay-in"} value={fmtMoney(q.data!.summary.payIn)} />
            <SummaryCard label={lang === "ar" ? "صرف درج" : "Pay-out"} value={fmtMoney(q.data!.summary.payOut)} />
            <SummaryCard label={lang === "ar" ? "عمليات استرجاع" : "Refund count"} value={String(q.data!.refundsCount)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card-soft p-4">
              <div className="mb-2 text-sm font-bold">{lang === "ar" ? "تفصيل الورديات" : "Shift breakdown"}</div>
              {!q.data!.shifts.length ? <div className="text-xs text-muted-foreground">{lang === "ar" ? "لا توجد ورديات" : "No shifts"}</div> : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground"><tr><th className="text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th><th className="text-start">{lang === "ar" ? "الحالة" : "Status"}</th><th className="text-end">{lang === "ar" ? "افتتاحي" : "Open"}</th><th className="text-end">{lang === "ar" ? "متوقع" : "Expected"}</th><th className="text-end">{lang === "ar" ? "فعلي" : "Actual"}</th><th className="text-end">{lang === "ar" ? "فرق" : "Var"}</th></tr></thead>
                  <tbody>{q.data!.shifts.map((s: any) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="py-1.5">{s.cashier_name || "—"}</td>
                      <td className="py-1.5">{s.status === "open" ? "Open" : "Closed"}</td>
                      <td className="py-1.5 text-end tabular-nums">{fmtMoney(s.opening_float)}</td>
                      <td className="py-1.5 text-end tabular-nums">{s.expected_cash != null ? fmtMoney(s.expected_cash) : "—"}</td>
                      <td className="py-1.5 text-end tabular-nums">{s.closing_cash != null ? fmtMoney(s.closing_cash) : "—"}</td>
                      <td className="py-1.5 text-end tabular-nums">{s.variance != null ? fmtMoney(s.variance) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card-soft p-4">
              <div className="mb-2 text-sm font-bold">{lang === "ar" ? "حسب النوع" : "By order type"}</div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="text-start">{lang === "ar" ? "النوع" : "Type"}</th><th className="text-end">{lang === "ar" ? "عدد" : "Orders"}</th><th className="text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th></tr></thead>
                <tbody>{q.data!.byOrderType.map((b: any) => (
                  <tr key={b.order_type} className="border-t border-border/60">
                    <td className="py-1.5">{ORDER_TYPE_LABEL[b.order_type]?.[lang === "ar" ? "ar" : "en"]}</td>
                    <td className="py-1.5 text-end tabular-nums">{b.orders}</td>
                    <td className="py-1.5 text-end tabular-nums">{fmtMoney(b.gross)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="card-soft p-4">
              <div className="mb-2 text-sm font-bold">{lang === "ar" ? "أعلى المنتجات" : "Top products"}</div>
              {!q.data!.topProducts.length ? <div className="text-xs text-muted-foreground">—</div> : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground"><tr><th className="text-start">{lang === "ar" ? "المنتج" : "Product"}</th><th className="text-end">{lang === "ar" ? "الكمية" : "Qty"}</th><th className="text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th></tr></thead>
                  <tbody>{q.data!.topProducts.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-end tabular-nums">{p.qty}</td>
                      <td className="py-1.5 text-end tabular-nums">{fmtMoney(p.gross)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card-soft p-4">
              <div className="mb-2 text-sm font-bold">{lang === "ar" ? "حسب الكاشير" : "By cashier"}</div>
              {!q.data!.byCashier.length ? <div className="text-xs text-muted-foreground">—</div> : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground"><tr><th className="text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th><th className="text-end">{lang === "ar" ? "عدد" : "Orders"}</th><th className="text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th></tr></thead>
                  <tbody>{q.data!.byCashier.map((c: any) => (
                    <tr key={c.cashier_id} className="border-t border-border/60">
                      <td className="py-1.5">{c.cashier_name || "—"}</td>
                      <td className="py-1.5 text-end tabular-nums">{c.orders}</td>
                      <td className="py-1.5 text-end tabular-nums">{fmtMoney(c.gross)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ───────── Generic table tabs ───────── */
function TopProductsTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getTopProductsReport, filters, [JSON.stringify(filters)]);
  return (<>
    <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showPaymentMethod={false} />
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> :
      !q.data!.rows.length ? <Empty lang={lang} /> : (
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "المنتج" : "Product"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الكمية" : "Qty"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "كمية مرتجعة" : "Ref Qty"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "صافي الكمية" : "Net Qty"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "صافي" : "Net Sales"}</th>
            </tr>
          </thead>
          <tbody>{q.data!.rows.map((r: any, i: number) => (
            <tr key={i} className="border-t border-border/60">
              <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{lang === "ar" ? r.category_name_ar : r.category_name_en}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.qty}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.gross)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.refundQty}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.netQty}</td>
              <td className="px-3 py-2 text-end font-semibold tabular-nums">{fmtMoney(r.netSales)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </>);
}

function ByPaymentTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getSalesByPaymentMethod, filters, [JSON.stringify(filters)]);
  return (<>
    <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showPaymentMethod={false} />
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> : (
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{lang === "ar" ? "طريقة الدفع" : "Method"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "العمليات" : "Transactions"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "استرجاع" : "Refunds"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "صافي" : "Net"}</th>
          </tr></thead>
          <tbody>{q.data!.rows.map((r: any) => (
            <tr key={r.method} className="border-t border-border/60">
              <td className="px-3 py-2 font-medium">{lang === "ar" ? METHOD_LABEL[r.method]?.ar : METHOD_LABEL[r.method]?.en}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.transactions}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.gross)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.refunds)}</td>
              <td className="px-3 py-2 text-end font-semibold tabular-nums">{fmtMoney(r.net)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </>);
}

function ByOrderTypeTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getSalesByOrderType, filters, [JSON.stringify(filters)]);
  return (<>
    <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showOrderType={false} showPaymentMethod={false} />
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> : (
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "عدد الطلبات" : "Orders"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "خصومات" : "Discounts"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "استرجاع" : "Refunds"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "صافي" : "Net"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "متوسط" : "AOV"}</th>
          </tr></thead>
          <tbody>{q.data!.rows.map((r: any) => (
            <tr key={r.order_type} className="border-t border-border/60">
              <td className="px-3 py-2 font-medium">{lang === "ar" ? ORDER_TYPE_LABEL[r.order_type]?.ar : ORDER_TYPE_LABEL[r.order_type]?.en}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.orders}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.gross)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.discounts)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.refunds)}</td>
              <td className="px-3 py-2 text-end font-semibold tabular-nums">{fmtMoney(r.net)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.aov)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </>);
}

function ByCashierTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getSalesByCashier, filters, [JSON.stringify(filters)]);
  return (<>
    <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showOrderType={false} showPaymentMethod={false} />
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> :
      !q.data!.rows.length ? <Empty lang={lang} /> : (
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "الطلبات" : "Orders"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي" : "Gross"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "خصومات" : "Discounts"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "استرجاع" : "Refunds"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "صافي" : "Net"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "نقد" : "Cash"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "شبكة" : "Card"}</th>
            <th className="px-3 py-2 text-end">{lang === "ar" ? "فرق درج" : "Variance"}</th>
          </tr></thead>
          <tbody>{q.data!.rows.map((r: any) => (
            <tr key={r.cashier_id} className="border-t border-border/60">
              <td className="px-3 py-2 font-medium">{r.cashier_name || "—"}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.orders}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.gross)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.discounts)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.refunds)}</td>
              <td className="px-3 py-2 text-end font-semibold tabular-nums">{fmtMoney(r.net)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.cash)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.card)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.variance != null ? fmtMoney(r.variance) : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </>);
}

function DiscountsTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters>({ date: todayIso() });
  const q = useReportQuery<any>(getDiscountsReport, filters, [JSON.stringify(filters)]);
  return (<>
    <FiltersBar lang={lang} value={filters} onChange={setFilters} cashiers={cashiers} showOrderType={false} showPaymentMethod={false} />
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> :
      !q.data!.rows.length ? <Empty lang={lang} /> : (
      <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SummaryCard label={lang === "ar" ? "عدد الخصومات" : "Discounts count"} value={String(q.data!.count)} />
          <SummaryCard label={lang === "ar" ? "إجمالي الخصومات" : "Total discounted"} value={fmtMoney(q.data!.total)} />
        </div>
        <div className="card-soft mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الوقت" : "Time"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الطلب" : "Order #"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "فرعي" : "Subtotal"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الخصم" : "Discount"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
            </tr></thead>
            <tbody>{q.data!.rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-3 py-2 text-xs">{fmtDate(r.time, lang)}</td>
                <td className="px-3 py-2 font-medium">{r.order_number}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.invoice_number || "—"}</td>
                <td className="px-3 py-2">{r.cashier_name || "—"}</td>
                <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.subtotal)}</td>
                <td className="px-3 py-2 text-end font-semibold tabular-nums text-destructive">−{fmtMoney(r.discount_amount)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>
    )}
  </>);
}

function RefundsTab({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { lang, fmtMoney } = useApp();
  const [filters, setFilters] = useState<Filters & { refund_type?: string }>({ date: todayIso() });
  const q = useReportQuery<any>(getRefundsReport, filters as any, [JSON.stringify(filters)]);
  return (<>
    <div className="card-soft mb-4 flex flex-wrap items-end gap-3 p-3">
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "التاريخ" : "Date"}</Label>
        <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="h-9 w-40" />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "الكاشير" : "Cashier"}</Label>
        <Select value={filters.cashier_id ?? "__all__"} onValueChange={(v) => setFilters({ ...filters, cashier_id: v === "__all__" ? undefined : v })}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
            {cashiers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "نوع الاسترجاع" : "Refund type"}</Label>
        <Select value={filters.refund_type ?? "__all__"} onValueChange={(v) => setFilters({ ...filters, refund_type: v === "__all__" ? undefined : v })}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
            <SelectItem value="full">{lang === "ar" ? "كامل" : "Full"}</SelectItem>
            <SelectItem value="partial">{lang === "ar" ? "جزئي" : "Partial"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">{lang === "ar" ? "طريقة الدفع" : "Payment"}</Label>
        <Select value={filters.payment_method ?? "__all__"} onValueChange={(v) => setFilters({ ...filters, payment_method: v === "__all__" ? undefined : v })}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{lang === "ar" ? "الكل" : "All"}</SelectItem>
            {["cash","mada","apple_pay","visa","mastercard","mixed"].map(m => <SelectItem key={m} value={m}>{lang === "ar" ? METHOD_LABEL[m].ar : METHOD_LABEL[m].en}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
    {q.loading ? <LoadingBlock /> : q.error ? <ErrorBlock message={q.error} onRetry={q.reload} /> :
      !q.data!.rows.length ? <Empty lang={lang} /> : (
      <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SummaryCard label={lang === "ar" ? "عدد عمليات الاسترجاع" : "Refund count"} value={String(q.data!.count)} />
          <SummaryCard label={lang === "ar" ? "إجمالي الاسترجاع" : "Total refunded"} value={fmtMoney(q.data!.total)} />
        </div>
        <div className="card-soft mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الوقت" : "Time"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الطلب" : "Order #"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "أصناف" : "Items"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الدفع" : "Payment"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "حالة الطلب" : "Status"}</th>
            </tr></thead>
            <tbody>{q.data!.rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-3 py-2 text-xs">{fmtDate(r.time, lang)}</td>
                <td className="px-3 py-2 font-medium">{r.order_number}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.invoice_number || "—"}</td>
                <td className="px-3 py-2">{r.cashier_name || "—"}</td>
                <td className="px-3 py-2 text-xs">{r.refund_type === "full" ? (lang === "ar" ? "كامل" : "Full") : (lang === "ar" ? "جزئي" : "Partial")}</td>
                <td className="px-3 py-2 text-end tabular-nums">{r.items_count}</td>
                <td className="px-3 py-2 text-end font-semibold tabular-nums text-destructive">−{fmtMoney(r.amount)}</td>
                <td className="px-3 py-2 text-xs">{r.payment_method ? (lang === "ar" ? METHOD_LABEL[r.payment_method]?.ar : METHOD_LABEL[r.payment_method]?.en) : "—"}</td>
                <td className="px-3 py-2"><Badge className={cn("text-[10px]", STATUS_LABEL[r.order_status_after]?.tone || "bg-muted")}>{STATUS_LABEL[r.order_status_after]?.[lang === "ar" ? "ar" : "en"] || r.order_status_after}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>
    )}
  </>);
}

/* ───────── Print view (opens new tab) ───────── */
function printReport(kind: "daily_sales" | "zreport" | "eod", data: any, label: string, lang: string) {
  if (!data) return;
  const html = buildPrintHtml(kind, data, label, lang);
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) { toast.error("Pop-up blocked"); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

function buildPrintHtml(kind: string, d: any, label: string, lang: string) {
  const isAr = lang === "ar";
  const fm = (n: number) => `${(Number(n) || 0).toFixed(2)} ${isAr ? "ر.س" : "SAR"}`;
  // HTML-escape DB-sourced strings to prevent XSS in the print window.
  const esc = (v: unknown): string =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const css = `
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;margin:24px;color:#111;direction:${isAr ? "rtl" : "ltr"};}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#555;font-size:12px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:${isAr ? "right" : "left"}}
      th{background:#f4f4f4}
      .rows{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-top:8px}
      .rows .k{color:#555}
      .rows .v{text-align:${isAr ? "left" : "right"};font-variant-numeric:tabular-nums;font-weight:600}
      .section{margin-top:18px;border-top:1px dashed #aaa;padding-top:10px}
      .right{text-align:${isAr ? "left" : "right"}}
      @media print{ button{display:none} }
    </style>`;

  const header = `
    <h1>${isAr ? "تقرير" : "Report"} — ${kind === "daily_sales" ? (isAr ? "المبيعات اليومية" : "Daily Sales") : kind === "zreport" ? (isAr ? "Z-Report للوردية" : "Shift Z-Report") : (isAr ? "نهاية اليوم" : "End of Day")}</h1>
    <div class="sub">${isAr ? "التاريخ" : "Date"}: ${esc(label)} · ${isAr ? "تم التوليد" : "Generated"}: ${esc(new Date().toLocaleString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh" }))}</div>`;

  let body = "";
  if (kind === "daily_sales") {
    const s = d.summary;
    body = `<div class="rows">
      <div class="k">${isAr ? "إجمالي" : "Gross"}</div><div class="v">${fm(s.gross)}</div>
      <div class="k">${isAr ? "الخصومات" : "Discounts"}</div><div class="v">${fm(s.discounts)}</div>
      <div class="k">${isAr ? "الاسترجاع" : "Refunds"}</div><div class="v">${fm(s.refunds)}</div>
      <div class="k">${isAr ? "الصافي" : "Net"}</div><div class="v">${fm(s.net)}</div>
      <div class="k">${isAr ? "ضريبة (شاملة)" : "VAT (incl.)"}</div><div class="v">${fm(s.vatIncluded)}</div>
      <div class="k">${isAr ? "عدد الطلبات" : "Orders"}</div><div class="v">${Number(s.ordersCount) || 0}</div>
      <div class="k">${isAr ? "متوسط" : "AOV"}</div><div class="v">${fm(s.aov)}</div>
    </div>
    <div class="section">
      <strong>${isAr ? "طرق الدفع" : "Payment methods"}</strong>
      <table><tr>${["cash","mada","apple_pay","visa","mastercard","mixed"].map(m => `<th>${esc(m)}</th>`).join("")}</tr>
      <tr>${["cash","mada","apple_pay","visa","mastercard","mixed"].map(m => `<td class="right">${fm(s.totals[m] ?? 0)}</td>`).join("")}</tr></table>
    </div>
    <div class="section"><strong>${isAr ? "الطلبات" : "Orders"}</strong>
      <table><thead><tr><th>${isAr ? "الوقت" : "Time"}</th><th>${isAr ? "الطلب" : "Order"}</th><th>${isAr ? "الفاتورة" : "Invoice"}</th><th>${isAr ? "الكاشير" : "Cashier"}</th><th>${isAr ? "الدفع" : "Payment"}</th><th class="right">${isAr ? "الإجمالي" : "Total"}</th></tr></thead>
      <tbody>${d.rows.map((r: any) => `<tr><td>${esc(new Date(r.time).toLocaleTimeString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh", hour12: false }))}</td><td>${esc(r.order_number)}</td><td>${esc(r.invoice_number || "—")}</td><td>${esc(r.cashier_name || "")}</td><td>${esc(r.payment_method || "")}</td><td class="right">${fm(r.total)}</td></tr>`).join("")}</tbody></table>
    </div>`;
  } else if (kind === "zreport") {
    body = `<div class="rows">
      <div class="k">${isAr ? "الكاشير" : "Cashier"}</div><div class="v">${esc(d.shift.cashier_name || "—")}</div>
      <div class="k">${isAr ? "الحالة" : "Status"}</div><div class="v">${esc(d.shift.status)}</div>
      <div class="k">${isAr ? "وقت الفتح" : "Opened"}</div><div class="v">${esc(new Date(d.shift.opened_at).toLocaleString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh" }))}</div>
      <div class="k">${isAr ? "وقت الإغلاق" : "Closed"}</div><div class="v">${esc(d.shift.closed_at ? new Date(d.shift.closed_at).toLocaleString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh" }) : "—")}</div>
      <div class="k">${isAr ? "افتتاحي" : "Opening cash"}</div><div class="v">${fm(d.openingCash)}</div>
      <div class="k">${isAr ? "مبيعات نقدية" : "Cash sales"}</div><div class="v">${fm(d.cashSales)}</div>
      <div class="k">${isAr ? "استرجاع نقدي" : "Cash refunds"}</div><div class="v">${fm(d.cashRefunds)}</div>
      <div class="k">${isAr ? "إيداع" : "Pay-in"}</div><div class="v">${fm(d.payIn)}</div>
      <div class="k">${isAr ? "صرف" : "Pay-out"}</div><div class="v">${fm(d.payOut)}</div>
      <div class="k">${isAr ? "متوقع" : "Expected"}</div><div class="v">${fm(d.expectedCash)}</div>
      <div class="k">${isAr ? "فعلي" : "Actual"}</div><div class="v">${d.actualCash != null ? fm(d.actualCash) : "—"}</div>
      <div class="k">${isAr ? "الفرق" : "Variance"}</div><div class="v">${d.variance != null ? fm(d.variance) : "—"}</div>
      <div class="k">${isAr ? "مدى" : "Mada"}</div><div class="v">${fm(d.byMethod.mada)}</div>
      <div class="k">Apple Pay</div><div class="v">${fm(d.byMethod.apple_pay)}</div>
      <div class="k">Visa</div><div class="v">${fm(d.byMethod.visa)}</div>
      <div class="k">Mastercard</div><div class="v">${fm(d.byMethod.mastercard)}</div>
      <div class="k">${isAr ? "دفع مركب" : "Mixed"}</div><div class="v">${fm(d.mixedTotal)}</div>
      <div class="k">${isAr ? "خصومات" : "Discounts"}</div><div class="v">${fm(d.discounts)}</div>
      <div class="k">${isAr ? "استرجاع" : "Refunds"}</div><div class="v">${fm(d.refunds)}</div>
      <div class="k">${isAr ? "الإجمالي" : "Gross"}</div><div class="v">${fm(d.gross)}</div>
      <div class="k">${isAr ? "الصافي" : "Net"}</div><div class="v">${fm(d.net)}</div>
      <div class="k">${isAr ? "عدد الطلبات" : "Orders"}</div><div class="v">${Number(d.ordersCount) || 0}</div>
      <div class="k">${isAr ? "عمليات استرجاع" : "Refund count"}</div><div class="v">${Number(d.refundCount) || 0}</div>
      <div class="k">${isAr ? "طلبات معلقة" : "Held"}</div><div class="v">${Number(d.heldCount) || 0}</div>
    </div>`;
  } else if (kind === "eod") {
    const s = d.summary;
    body = `<div class="rows">
      <div class="k">${isAr ? "إجمالي" : "Gross"}</div><div class="v">${fm(s.gross)}</div>
      <div class="k">${isAr ? "خصومات" : "Discounts"}</div><div class="v">${fm(s.discounts)}</div>
      <div class="k">${isAr ? "استرجاع" : "Refunds"}</div><div class="v">${fm(s.refunds)}</div>
      <div class="k">${isAr ? "الصافي" : "Net"}</div><div class="v">${fm(s.net)}</div>
      <div class="k">${isAr ? "نقد" : "Cash"}</div><div class="v">${fm(s.cashTotal)}</div>
      <div class="k">${isAr ? "شبكة" : "Card/Network"}</div><div class="v">${fm(s.cardNetworkTotal)}</div>
      <div class="k">Apple Pay</div><div class="v">${fm(s.applePayTotal)}</div>
      <div class="k">Visa/MC</div><div class="v">${fm(s.visaMcTotal)}</div>
      <div class="k">${isAr ? "عدد الورديات" : "Shifts"}</div><div class="v">${Number(s.shiftsCount) || 0}</div>
      <div class="k">${isAr ? "فرق درج إجمالي" : "Variance total"}</div><div class="v">${fm(s.cashVarianceTotal)}</div>
      <div class="k">${isAr ? "إيداع" : "Pay-in"}</div><div class="v">${fm(s.payIn)}</div>
      <div class="k">${isAr ? "صرف" : "Pay-out"}</div><div class="v">${fm(s.payOut)}</div>
    </div>
    <div class="section"><strong>${isAr ? "الورديات" : "Shifts"}</strong>
      <table><thead><tr><th>${isAr ? "الكاشير" : "Cashier"}</th><th>${isAr ? "الحالة" : "Status"}</th><th class="right">${isAr ? "افتتاحي" : "Open"}</th><th class="right">${isAr ? "متوقع" : "Expected"}</th><th class="right">${isAr ? "فعلي" : "Actual"}</th><th class="right">${isAr ? "الفرق" : "Variance"}</th></tr></thead>
      <tbody>${d.shifts.map((sh: any) => `<tr><td>${esc(sh.cashier_name || "—")}</td><td>${esc(sh.status)}</td><td class="right">${fm(sh.opening_float)}</td><td class="right">${sh.expected_cash != null ? fm(sh.expected_cash) : "—"}</td><td class="right">${sh.closing_cash != null ? fm(sh.closing_cash) : "—"}</td><td class="right">${sh.variance != null ? fm(sh.variance) : "—"}</td></tr>`).join("")}</tbody></table>
    </div>
    <div class="section"><strong>${isAr ? "أعلى المنتجات" : "Top products"}</strong>
      <table><thead><tr><th>${isAr ? "المنتج" : "Product"}</th><th class="right">${isAr ? "الكمية" : "Qty"}</th><th class="right">${isAr ? "إجمالي" : "Gross"}</th></tr></thead>
      <tbody>${d.topProducts.map((p: any) => `<tr><td>${esc(p.name)}</td><td class="right">${Number(p.qty) || 0}</td><td class="right">${fm(p.gross)}</td></tr>`).join("")}</tbody></table>
    </div>`;
  }

  // Brand block is rendered via safe DOM textContent (no innerHTML / no
  // unsanitized localStorage interpolation), eliminating XSS via __brand__.
  return `<!doctype html><html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Report</title>${css}</head>
    <body><div id="brand"></div>${header}${body}
    <script>(function(){try{var s=document.getElementById('brand');var raw=localStorage.getItem('__brand__');if(!raw)return;var st=JSON.parse(raw);if(!st||typeof st!=='object')return;var d1=document.createElement('div');d1.style.fontWeight='700';d1.textContent=String(st.legal||'');var d2=document.createElement('div');d2.style.fontSize='12px';d2.style.color='#555';d2.textContent=String(st.brand||'')+' \u2014 '+String(st.branch||'');s.appendChild(d1);s.appendChild(d2);}catch(e){}})();</script>
    </body></html>`;
}

/* ───────── Reports Hub Screen (exported) ───────── */
export default function ReportsHub() {
  const { lang } = useApp();
  const settings = useSettings();
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);

  // Persist brand info into localStorage so print window can read it.
  useEffect(() => {
    if (!settings?.settings) return;
    try {
      localStorage.setItem("__brand__", JSON.stringify({
        legal: lang === "ar" ? settings.settings.legal_name_ar : settings.settings.legal_name_en,
        brand: lang === "ar" ? settings.settings.brand_name_ar : settings.settings.brand_name_en,
        branch: lang === "ar" ? settings.settings.branch_ar : settings.settings.branch_en,
      }));
    } catch {}
  }, [settings, lang]);

  // Cashier dropdown choices come from listZReports' unique cashiers (best
  // available without a separate users endpoint dependency). Empty is OK.
  const loadShifts = useApiAction(listZReports);
  useEffect(() => {
    loadShifts({ data: { limit: 200, include_open: true } })
      .then((rows: any[]) => {
        const map = new Map<string, string>();
        for (const r of rows) if (r.cashier_id && !map.has(r.cashier_id)) map.set(r.cashier_id, r.cashier_name || r.cashier_id.slice(0, 6));
        setCashiers([...map.entries()].map(([id, name]) => ({ id, name })));
      })
      .catch(() => {});
  }, [loadShifts]);

  const tabs = [
    { id: "daily", icon: BarChart3, ar: "المبيعات اليومية", en: "Daily Sales" },
    { id: "z", icon: ClipboardList, ar: "تقارير Z", en: "Z-Reports" },
    { id: "eod", icon: Calendar, ar: "نهاية اليوم", en: "End of Day" },
    { id: "top", icon: Trophy, ar: "الأعلى مبيعًا", en: "Top Products" },
    { id: "pay", icon: CreditCard, ar: "حسب الدفع", en: "By Payment" },
    { id: "type", icon: ShoppingCart, ar: "حسب النوع", en: "By Order Type" },
    { id: "cashier", icon: Users, ar: "حسب الكاشير", en: "By Cashier" },
    { id: "disc", icon: Percent, ar: "الخصومات", en: "Discounts" },
    { id: "ref", icon: Undo2, ar: "الاسترجاع", en: "Refunds" },
  ];

  return (
    <ManagerLayout>
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">{lang === "ar" ? "التقارير" : "Reports"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "تقارير حية مرتبطة مباشرة بقاعدة البيانات" : "Live reports wired to the backend"}</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {tabs.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs">
              <t.icon className="h-3.5 w-3.5" />{lang === "ar" ? t.ar : t.en}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="daily"><DailySalesTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="z"><ZReportsTab /></TabsContent>
        <TabsContent value="eod"><EndOfDayTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="top"><TopProductsTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="pay"><ByPaymentTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="type"><ByOrderTypeTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="cashier"><ByCashierTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="disc"><DiscountsTab cashiers={cashiers} /></TabsContent>
        <TabsContent value="ref"><RefundsTab cashiers={cashiers} /></TabsContent>
      </Tabs>
    </ManagerLayout>
  );
}
