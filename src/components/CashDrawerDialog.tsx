"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useApiAction } from "@/lib/api-client";
import { recordCashMovement, listCashMovements } from "@/lib/pos.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAY_OUT_REASONS_AR = [
  "مشتريات بسيطة",
  "فكة / صرف",
  "مصروف عامل",
  "أخرى",
];
const PAY_IN_REASONS_AR = [
  "إضافة فكة",
  "إضافة من المدير",
  "أخرى",
];
const PAY_OUT_REASONS_EN = ["Small purchase", "Change", "Staff expense", "Other"];
const PAY_IN_REASONS_EN = ["Add change", "From manager", "Other"];

export function CashDrawerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, fmtMoney, shift } = useApp();
  const record = useApiAction(recordCashMovement);
  const list = useApiAction(listCashMovements);

  const [type, setType] = useState<"pay_in" | "pay_out">("pay_in");
  const [amount, setAmount] = useState("");
  const [reasonOpt, setReasonOpt] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const reasonsAr = type === "pay_in" ? PAY_IN_REASONS_AR : PAY_OUT_REASONS_AR;
  const reasonsEn = type === "pay_in" ? PAY_IN_REASONS_EN : PAY_OUT_REASONS_EN;
  const reasons = reasonsAr.map((ar, i) => ({ ar, en: reasonsEn[i] }));

  const refresh = async () => {
    if (!shift.id) return;
    setLoadingList(true);
    try {
      const rows: any[] = await list({ data: { shift_id: shift.id } });
      setHistory(rows);
    } catch (e: any) {
      // silent
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { if (open) refresh(); }, [open]);

  const submit = async () => {
    if (busy) return;
    const a = Number(amount);
    if (!a || a <= 0) {
      toast.error(lang === "ar" ? "أدخل مبلغًا صحيحًا" : "Enter a valid amount");
      return;
    }
    const isOther = reasonOpt === "أخرى" || reasonOpt === "Other";
    const reason = (isOther ? customReason : reasonOpt).trim();
    if (!reason) {
      toast.error(lang === "ar" ? "أدخل السبب" : "Enter the reason");
      return;
    }
    setBusy(true);
    try {
      await record({ data: { type, amount: a, reason } });
      toast.success(lang === "ar" ? "تم تسجيل الحركة" : "Movement recorded");
      setAmount("");
      setReasonOpt("");
      setCustomReason("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر التسجيل" : "Failed"));
    } finally {
      setBusy(false);
    }
  };

  const totalIn = history.filter(h => h.type === "pay_in").reduce((s, h) => s + Number(h.amount), 0);
  const totalOut = history.filter(h => h.type === "pay_out").reduce((s, h) => s + Number(h.amount), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "حركات الدرج النقدي" : "Cash Drawer Movements"}</DialogTitle>
          <DialogDescription>
            {lang === "ar"
              ? "تؤثر هذه الحركات على المتوقع عند إغلاق الوردية."
              : "These movements affect expected cash at close-shift."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setType("pay_in"); setReasonOpt(""); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition",
              type === "pay_in" ? "border-success bg-success/10 text-success" : "hover:bg-muted",
            )}
          >
            <ArrowDownToLine className="h-4 w-4" />
            {lang === "ar" ? "إدخال (Pay-in)" : "Pay-in"}
          </button>
          <button
            onClick={() => { setType("pay_out"); setReasonOpt(""); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition",
              type === "pay_out" ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-muted",
            )}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            {lang === "ar" ? "إخراج (Pay-out)" : "Pay-out"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">
              {lang === "ar" ? "المبلغ (ر.س)" : "Amount (SAR)"}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 text-lg tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {lang === "ar" ? "السبب" : "Reason"}
            </label>
            <Select value={reasonOpt} onValueChange={setReasonOpt}>
              <SelectTrigger>
                <SelectValue placeholder={lang === "ar" ? "اختر السبب" : "Select reason"} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.ar} value={lang === "ar" ? r.ar : r.en}>
                    {lang === "ar" ? r.ar : r.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(reasonOpt === "أخرى" || reasonOpt === "Other") && (
            <div>
              <label className="mb-1 block text-xs font-medium">
                {lang === "ar" ? "اكتب السبب" : "Specify reason"}
              </label>
              <Input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={lang === "ar" ? "السبب..." : "Reason..."}
              />
            </div>
          )}
          <Button onClick={submit} disabled={busy} className="h-11 w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
              type === "pay_in"
                ? (lang === "ar" ? "تسجيل إدخال" : "Record pay-in")
                : (lang === "ar" ? "تسجيل إخراج" : "Record pay-out")}
          </Button>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
            <span className="font-semibold">
              {lang === "ar" ? "حركات الوردية الحالية" : "Current shift movements"}
            </span>
            {loadingList && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {history.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {lang === "ar" ? "لا توجد حركات بعد" : "No movements yet"}
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-b-0">
                  <div className="flex items-center gap-2">
                    {h.type === "pay_in" ? (
                      <ArrowDownToLine className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowUpFromLine className="h-3 w-3 text-destructive" />
                    )}
                    <span className="text-muted-foreground">{h.reason || "—"}</span>
                  </div>
                  <span className={cn("font-semibold tabular-nums", h.type === "pay_in" ? "text-success" : "text-destructive")}>
                    {h.type === "pay_in" ? "+" : "-"} {fmtMoney(Number(h.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between border-t px-3 py-2 text-xs font-semibold">
            <span className="text-success">+ {fmtMoney(totalIn)}</span>
            <span className="text-destructive">- {fmtMoney(totalOut)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
