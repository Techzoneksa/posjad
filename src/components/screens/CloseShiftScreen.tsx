"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApiAction } from "@/lib/api-client";
import { closeShift as closeShiftFn, getShiftSummary } from "@/lib/shifts.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type ShiftStats = {
  openingCash: number;
  cashSales: number;
  mada: number;
  apple: number;
  visa: number;
  cashRefunds: number;
  cashExpenses: number;
  cashAdditions: number;
  expected: number;
  refunded: number;
  discounts: number;
  net: number;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "";

export function CloseShiftScreen() {
  const { shift, closeShift, setScreen, t, lang, fmtMoney } = useApp();
  const summaryFn = useApiAction(getShiftSummary);
  const closeShiftServer = useApiAction(closeShiftFn);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<ShiftStats>({
    openingCash: shift.openingCash,
    cashSales: 0,
    mada: 0,
    apple: 0,
    visa: 0,
    cashRefunds: 0,
    cashExpenses: 0,
    cashAdditions: 0,
    expected: shift.openingCash,
    refunded: 0,
    discounts: 0,
    net: 0,
  });
  const [actual, setActual] = useState<string>(shift.openingCash.toFixed(2));
  const diff = (Number(actual) || 0) - stats.expected;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = (await summaryFn({ data: { shift_id: shift.id } })) as ShiftStats;
        if (cancelled) return;
        setStats(res);
        setActual(Number(res.expected).toFixed(2));
      } catch (e: unknown) {
        toast.error(
          errorMessage(e) ||
            (lang === "ar" ? "تعذر تحميل ملخص الوردية" : "Failed to load shift summary"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [summaryFn, shift.id, lang]);

  const submitCloseShift = async () => {
    if (!shift.id || submitting) return;
    setSubmitting(true);
    try {
      await closeShiftServer({ data: { shift_id: shift.id, closing_cash: Number(actual) || 0 } });
      toast.success(lang === "ar" ? "تم إغلاق الوردية" : "Shift closed");
      closeShift();
    } catch (e: unknown) {
      toast.error(
        errorMessage(e) || (lang === "ar" ? "تعذر إغلاق الوردية" : "Failed to close shift"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={t.closeShift} />
      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-2">
        <section className="card-soft p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "النقد" : "Cash"}
          </h3>
          <dl className="space-y-2.5 text-sm">
            <Row
              k={lang === "ar" ? "الرصيد الافتتاحي" : "Opening cash"}
              v={fmtMoney(stats.openingCash)}
            />
            <Row k={lang === "ar" ? "مبيعات نقدية" : "Cash sales"} v={fmtMoney(stats.cashSales)} />
            <Row
              k={lang === "ar" ? "استرجاع نقدي" : "Cash refunds"}
              v={`- ${fmtMoney(stats.cashRefunds)}`}
              accent="text-destructive"
            />
            <Row
              k={lang === "ar" ? "مصاريف نقدية" : "Cash expenses"}
              v={fmtMoney(stats.cashExpenses)}
            />
            <Row
              k={lang === "ar" ? "إضافات نقدية" : "Cash additions"}
              v={fmtMoney(stats.cashAdditions)}
            />
            <div className="my-2 border-t" />
            <Row k={t.expected} v={fmtMoney(stats.expected)} bold />
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium">{t.actual}</label>
              <Input
                type="number"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                className="h-12 text-xl font-bold tabular-nums"
                disabled={loading || submitting}
              />
            </div>
            <div
              className={cn(
                "flex justify-between rounded-lg p-3 text-sm font-bold",
                Math.abs(diff) < 0.01
                  ? "bg-success/15 text-success"
                  : diff > 0
                    ? "bg-warning/20 text-warning-foreground"
                    : "bg-destructive/15 text-destructive",
              )}
            >
              <span>{t.difference}</span>
              <span className="tabular-nums">
                {diff >= 0 ? "+" : ""}
                {fmtMoney(diff)}
              </span>
            </div>
          </dl>
        </section>

        <section className="card-soft p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "البطاقات والملخص" : "Cards & Summary"}
          </h3>
          <dl className="space-y-2.5 text-sm">
            <Row k="مدى / Mada" v={fmtMoney(stats.mada)} />
            <Row k="Apple Pay" v={fmtMoney(stats.apple)} />
            <Row k="Visa / Mastercard" v={fmtMoney(stats.visa)} />
            <div className="my-2 border-t" />
            <Row k={t.discount} v={fmtMoney(stats.discounts)} />
            <Row k={t.refund} v={fmtMoney(stats.refunded)} accent="text-destructive" />
            <div className="my-2 border-t" />
            <Row k={lang === "ar" ? "صافي المبيعات" : "Net sales"} v={fmtMoney(stats.net)} bold />
          </dl>
          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setScreen("pos")}
              className="flex-1"
              disabled={submitting}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitCloseShift}
              variant="destructive"
              className="flex-1 h-11 gap-2"
              disabled={loading || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.closeShift}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, accent, bold }: { k: string; v: string; accent?: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-bold")}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("tabular-nums font-semibold text-foreground", accent)}>{v}</dd>
    </div>
  );
}
