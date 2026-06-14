"use client";

// Sprint D — Finance & HR screens, fully backend-wired (no mock data).
// Screens: ManagerExpenses, ManagerBanks, ManagerChart, ManagerJournal,
//          ManagerSupplierPayments, ManagerEmployees, ManagerPayroll, ManagerFinReports.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApiAction } from "@/lib/api-client";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { ManagerLayout } from "./ManagerScreens";
import {
  listFinanceAccounts, upsertFinanceAccount, listAccountMovements,
  transferBetweenAccounts, recordCashAdjustment,
  listExpenses, createExpense,
  listChartAccounts, upsertChartAccount,
  listJournalEntries, createJournalEntry, reverseJournalEntry,
  listSupplierPayments, createSupplierPayment,
  getFinanceSummary,
} from "@/lib/finance.functions";
import {
  listEmployees, upsertEmployee, setEmployeeStatus,
  listEmployeeAdjustments, createEmployeeAdjustment, deleteEmployeeAdjustment,
  previewPayroll, generatePayroll, listSalaryRecords, paySalaryRecord,
} from "@/lib/hr.functions";
import { listSuppliers } from "@/lib/ops.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wallet, Receipt, Building2, BookOpen, Banknote, Users, BarChart3,
  Plus, Pencil, Eye, ArrowLeftRight, Trash2, RotateCcw, Loader2,
  TrendingUp, TrendingDown, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Reference data (labels only) ───────── */
const EXPENSE_CATEGORIES = [
  { id: "salary",      ar: "رواتب",        en: "Salary" },
  { id: "electricity", ar: "كهرباء",       en: "Electricity" },
  { id: "water",       ar: "ماء",          en: "Water" },
  { id: "internet",    ar: "إنترنت",       en: "Internet" },
  { id: "rent",        ar: "إيجار",        en: "Rent" },
  { id: "ads",         ar: "إعلانات",      en: "Ads" },
  { id: "license",     ar: "تراخيص",       en: "Licenses" },
  { id: "maintenance", ar: "صيانة",        en: "Maintenance" },
  { id: "advance",     ar: "سلفة عامل",    en: "Employee Advance" },
  { id: "other",       ar: "مصاريف أخرى",  en: "Other" },
] as const;
type ExpenseCategoryId = typeof EXPENSE_CATEGORIES[number]["id"];

const ACCOUNT_TYPES = [
  { id: "cashbox", ar: "صندوق", en: "Cashbox" },
  { id: "bank",    ar: "بنك",   en: "Bank" },
  { id: "network", ar: "شبكة",  en: "Network / POS" },
] as const;
type AccountType = typeof ACCOUNT_TYPES[number]["id"];

const COA_TYPES = [
  { id: "asset",     ar: "أصول",       en: "Assets" },
  { id: "liability", ar: "التزامات",   en: "Liabilities" },
  { id: "revenue",   ar: "إيرادات",    en: "Revenue" },
  { id: "expense",   ar: "مصروفات",    en: "Expenses" },
  { id: "equity",    ar: "حقوق ملكية", en: "Equity" },
] as const;
type CoaType = typeof COA_TYPES[number]["id"];

const ADJ_KINDS = [
  { id: "advance",   ar: "سلفة",  en: "Advance" },
  { id: "deduction", ar: "خصم",   en: "Deduction" },
] as const;

function tr(arr: readonly { id: string; ar: string; en: string }[], id: string, lang: "ar" | "en") {
  return arr.find((x) => x.id === id)?.[lang] ?? id;
}

/* ───────── Shared helpers ───────── */
function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function fmtDate(d: string | number | Date | null | undefined, lang: "ar" | "en") {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    year: "numeric", month: "short", day: "numeric",
  });
}
function fmtDateTime(d: string | number | Date | null | undefined, lang: "ar" | "en") {
  if (!d) return "—";
  return new Date(d).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <div className="mt-3 text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
function LoadingRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="p-10">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">{text}</span>
        </div>
      </td>
    </tr>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold tabular-nums">{v || "—"}</div>
    </div>
  );
}
function curMonth() { return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 7); }

/* ════════════════════════════════════════════════════
   1. FINANCE ACCOUNTS — Banks / Cashboxes
   ════════════════════════════════════════════════════ */
type FinanceAccount = {
  id: string; name_ar: string; name_en: string; type: AccountType;
  account_code: string | null; opening_balance: number; balance: number;
  active: boolean; notes: string | null; last_movement_at: string | null;
};
type AccountMovement = {
  id: string; account_id: string; occurred_at: string; type: string;
  amount_in: number; amount_out: number; balance_after: number;
  description: string | null; reference: string | null; notes: string | null;
};

export function ManagerBanks() {
  const { lang, fmtMoney } = useApp();
  const fetchAccounts = useApiAction(listFinanceAccounts);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<FinanceAccount | null>(null);

  const reload = async () => {
    setLoading(true);
    try { setAccounts((await fetchAccounts()) as any); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الصناديق والبنوك" : "Banks & Cashboxes"}
        subtitle={lang === "ar" ? "أرصدة الصناديق والحسابات البنكية وأجهزة الشبكة" : "Cashboxes, bank accounts and network terminals"}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              <ArrowLeftRight className="me-1 h-4 w-4" />{lang === "ar" ? "تحويل بين الحسابات" : "Transfer"}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "إضافة حساب" : "Add Account"}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Wallet}
          title={lang === "ar" ? "لا توجد حسابات مالية" : "No finance accounts"}
          hint={lang === "ar" ? "ابدأ بإضافة صندوق المحل أو حساب بنكي" : "Start by adding your cashbox or a bank account"} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card-soft p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {a.type === "cashbox" ? <Wallet className="h-4 w-4 text-primary" />
                      : a.type === "bank" ? <Building2 className="h-4 w-4 text-primary" />
                      : <Banknote className="h-4 w-4 text-primary" />}
                    <div className="font-semibold">{lang === "ar" ? a.name_ar : a.name_en}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {tr(ACCOUNT_TYPES, a.type, lang)}
                    {a.account_code ? ` • ${a.account_code}` : ""}
                  </div>
                </div>
                {!a.active && (
                  <Badge variant="outline" className="text-xs">{lang === "ar" ? "موقوف" : "Inactive"}</Badge>
                )}
              </div>
              <div className="my-4 text-3xl font-bold tabular-nums">{fmtMoney(Number(a.balance))}</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <KV k={lang === "ar" ? "افتتاحي" : "Opening"} v={fmtMoney(Number(a.opening_balance))} />
                <KV k={lang === "ar" ? "آخر حركة" : "Last movement"} v={a.last_movement_at ? fmtDate(a.last_movement_at, lang) : "—"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setStatementId(a.id)}>
                  <Eye className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "كشف الحركة" : "Statement"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdjustOpen(a)}>
                  <DollarSign className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تعديل يدوي" : "Adjust"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                  <Pencil className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تعديل" : "Edit"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AccountDialog
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
      {statementId && (
        <AccountStatementSheet
          account={accounts.find((a) => a.id === statementId)!}
          onClose={() => setStatementId(null)}
        />
      )}
      {transferOpen && (
        <TransferDialog accounts={accounts} onClose={() => setTransferOpen(false)} onSaved={() => { setTransferOpen(false); reload(); }} />
      )}
      {adjustOpen && (
        <AdjustDialog account={adjustOpen} onClose={() => setAdjustOpen(null)} onSaved={() => { setAdjustOpen(null); reload(); }} />
      )}
    </ManagerLayout>
  );
}

function AccountDialog({ editing, onClose, onSaved }: { editing: FinanceAccount | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(upsertFinanceAccount);
  const [f, setF] = useState({
    name_ar: editing?.name_ar ?? "",
    name_en: editing?.name_en ?? "",
    type: (editing?.type ?? "cashbox") as AccountType,
    account_code: editing?.account_code ?? "",
    opening_balance: editing?.opening_balance ?? 0,
    active: editing?.active ?? true,
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!f.name_ar.trim() || !f.name_en.trim()) { toast.error(lang === "ar" ? "الاسم مطلوب" : "Name is required"); return; }
    setSaving(true);
    try {
      await save({ data: {
        id: editing?.id, name_ar: f.name_ar.trim(), name_en: f.name_en.trim(),
        type: f.type, account_code: f.account_code || null,
        opening_balance: Number(f.opening_balance) || 0, active: f.active,
        notes: f.notes || null,
      } } as any);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? (lang === "ar" ? "تعديل حساب" : "Edit Account") : (lang === "ar" ? "حساب جديد" : "New Account")}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "صندوق نقدي، حساب بنكي، أو جهاز شبكة." : "Cashbox, bank account, or network terminal."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}>
              <Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} />
            </Field>
            <Field label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}>
              <Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "النوع" : "Type"}>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as AccountType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{lang === "ar" ? t.ar : t.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={lang === "ar" ? "كود الحساب (اختياري)" : "Account code (optional)"}>
              <Input value={f.account_code} onChange={(e) => setF({ ...f, account_code: e.target.value })} />
            </Field>
          </div>
          <Field label={lang === "ar" ? "الرصيد الافتتاحي" : "Opening balance"}>
            <Input type="number" step="0.01" value={f.opening_balance} disabled={!!editing}
              onChange={(e) => setF({ ...f, opening_balance: Number(e.target.value) })} />
            {editing && <div className="text-[10px] text-muted-foreground">{lang === "ar" ? "لا يمكن تعديل الرصيد الافتتاحي بعد الإنشاء" : "Opening balance cannot be changed after creation"}</div>}
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            {lang === "ar" ? "نشط" : "Active"}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountStatementSheet({ account, onClose }: { account: FinanceAccount; onClose: () => void }) {
  const { lang, fmtMoney } = useApp();
  const fetchMv = useApiAction(listAccountMovements);
  const [rows, setRows] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setRows((await fetchMv({ data: { account_id: account.id, limit: 200 } } as any)) as any); }
      catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [account.id]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lang === "ar" ? "كشف حركة" : "Statement"} — {lang === "ar" ? account.name_ar : account.name_en}</SheetTitle>
          <SheetDescription>{lang === "ar" ? "آخر 200 حركة" : "Last 200 movements"} • {lang === "ar" ? "الرصيد الحالي" : "Current balance"}: {fmtMoney(Number(account.balance))}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr><th className="p-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                <th className="p-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
                <th className="p-2 text-start">{lang === "ar" ? "وصف" : "Description"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "وارد" : "In"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "صادر" : "Out"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "الرصيد" : "Balance"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRow cols={6} text={lang === "ar" ? "تحميل…" : "Loading…"} />
                : rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">{lang === "ar" ? "لا توجد حركات" : "No movements"}</td></tr>
                : rows.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="p-2 text-xs">{fmtDateTime(m.occurred_at, lang)}</td>
                    <td className="p-2 text-xs">{m.type}</td>
                    <td className="p-2 text-xs">{m.description || "—"}</td>
                    <td className="p-2 text-end tabular-nums text-success">{Number(m.amount_in) > 0 ? fmtMoney(Number(m.amount_in)) : "—"}</td>
                    <td className="p-2 text-end tabular-nums text-destructive">{Number(m.amount_out) > 0 ? fmtMoney(Number(m.amount_out)) : "—"}</td>
                    <td className="p-2 text-end font-semibold tabular-nums">{fmtMoney(Number(m.balance_after))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransferDialog({ accounts, onClose, onSaved }: { accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const run = useApiAction(transferBetweenAccounts);
  const active = accounts.filter((a) => a.active);
  const [from, setFrom] = useState(active[0]?.id ?? "");
  const [to, setTo] = useState(active[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!from || !to || from === to) { toast.error(lang === "ar" ? "اختر حسابين مختلفين" : "Pick two different accounts"); return; }
    if (amount <= 0) { toast.error(lang === "ar" ? "المبلغ غير صالح" : "Invalid amount"); return; }
    setSaving(true);
    try {
      await run({ data: { from_id: from, to_id: to, amount, notes: notes || undefined } } as any);
      toast.success(lang === "ar" ? "تم التحويل" : "Transfer completed");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lang === "ar" ? "تحويل بين الحسابات" : "Transfer between accounts"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "ar" ? "من" : "From"}>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {active.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "إلى" : "To"}>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {active.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "تحويل" : "Transfer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ account, onClose, onSaved }: { account: FinanceAccount; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const run = useApiAction(recordCashAdjustment);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (amount <= 0 || !description.trim()) { toast.error(lang === "ar" ? "البيانات غير مكتملة" : "Missing fields"); return; }
    setSaving(true);
    try {
      await run({ data: { account_id: account.id, direction, amount, description: description.trim(), notes: notes || undefined } } as any);
      toast.success(lang === "ar" ? "تم التسجيل" : "Recorded");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "تعديل يدوي" : "Manual adjustment"} — {lang === "ar" ? account.name_ar : account.name_en}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "إيداع أو سحب يدوي خارج المعاملات." : "Cash in/out outside of normal operations."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "ar" ? "الاتجاه" : "Direction"}>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">{lang === "ar" ? "إيداع (وارد)" : "Cash In"}</SelectItem>
                <SelectItem value="out">{lang === "ar" ? "سحب (صادر)" : "Cash Out"}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label={lang === "ar" ? "الوصف" : "Description"}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   2. EXPENSES
   ════════════════════════════════════════════════════ */
type Expense = {
  id: string; number: string; expense_date: string; category: ExpenseCategoryId;
  description: string; paid_from_account_id: string; amount: number; vat_amount: number;
  total: number; attachment_url: string | null; notes: string | null; created_at: string;
};

export function ManagerExpenses() {
  const { lang, fmtMoney } = useApp();
  const fetchExp = useApiAction(listExpenses);
  const fetchAccounts = useApiAction(listFinanceAccounts);
  const [rows, setRows] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterAcct, setFilterAcct] = useState<string>("all");
  const [viewing, setViewing] = useState<Expense | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [exp, acc] = await Promise.all([fetchExp({ data: {} } as any), fetchAccounts()]);
      setRows(exp as any); setAccounts(acc as any);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const filtered = rows.filter((r) =>
    (filterCat === "all" || r.category === filterCat) &&
    (filterAcct === "all" || r.paid_from_account_id === filterAcct));
  const totalAmt = filtered.reduce((s, r) => s + Number(r.total), 0);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "المصروفات" : "Expenses"}
        subtitle={lang === "ar" ? "تسجيل المصروفات التشغيلية" : "Operational expenses"}
        action={<Button size="sm" onClick={() => setCreating(true)} disabled={accounts.length === 0}>
          <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "مصروف جديد" : "New Expense"}
        </Button>}
      />

      <div className="card-soft mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder={lang === "ar" ? "الفئة" : "Category"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الفئات" : "All categories"}</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.ar : c.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAcct} onValueChange={setFilterAcct}>
          <SelectTrigger className="w-56"><SelectValue placeholder={lang === "ar" ? "الحساب" : "Account"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحسابات" : "All accounts"}</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ms-auto text-sm">
          <span className="text-muted-foreground">{lang === "ar" ? "الإجمالي:" : "Total:"}</span>{" "}
          <span className="font-bold tabular-nums">{fmtMoney(totalAmt)}</span>
        </div>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الرقم" : "Number"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الوصف" : "Description"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحساب" : "Account"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={7} text={lang === "ar" ? "تحميل…" : "Loading…"} />
              : filtered.length === 0 ? <tr><td colSpan={7}><EmptyState icon={Receipt} title={lang === "ar" ? "لا توجد مصروفات" : "No expenses"} /></td></tr>
              : filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="p-3 font-mono text-xs">{r.number}</td>
                  <td className="p-3 text-xs">{fmtDate(r.expense_date, lang)}</td>
                  <td className="p-3 text-xs">{tr(EXPENSE_CATEGORIES, r.category, lang)}</td>
                  <td className="p-3">{r.description}</td>
                  <td className="p-3 text-xs">{accById.get(r.paid_from_account_id)?.[lang === "ar" ? "name_ar" : "name_en"] || "—"}</td>
                  <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(Number(r.total))}</td>
                  <td className="p-3 text-end">
                    <Button variant="ghost" size="sm" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {creating && <ExpenseDialog accounts={accounts} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {viewing && (
        <Dialog open onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{viewing.number}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV k={lang === "ar" ? "التاريخ" : "Date"} v={fmtDate(viewing.expense_date, lang)} />
              <KV k={lang === "ar" ? "الفئة" : "Category"} v={tr(EXPENSE_CATEGORIES, viewing.category, lang)} />
              <KV k={lang === "ar" ? "الحساب" : "Account"} v={accById.get(viewing.paid_from_account_id)?.[lang === "ar" ? "name_ar" : "name_en"] || "—"} />
              <KV k={lang === "ar" ? "المبلغ" : "Amount"} v={fmtMoney(Number(viewing.amount))} />
              <KV k={lang === "ar" ? "ضريبة" : "VAT"} v={fmtMoney(Number(viewing.vat_amount))} />
              <KV k={lang === "ar" ? "الإجمالي" : "Total"} v={fmtMoney(Number(viewing.total))} />
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm"><div className="text-[10px] uppercase text-muted-foreground">{lang === "ar" ? "الوصف" : "Description"}</div>{viewing.description}</div>
            {viewing.notes && <div className="rounded-lg bg-muted/40 p-3 text-sm"><div className="text-[10px] uppercase text-muted-foreground">{lang === "ar" ? "ملاحظات" : "Notes"}</div>{viewing.notes}</div>}
          </DialogContent>
        </Dialog>
      )}
    </ManagerLayout>
  );
}

function ExpenseDialog({ accounts, onClose, onSaved }: { accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(createExpense);
  const active = accounts.filter((a) => a.active);
  const [f, setF] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "other" as ExpenseCategoryId,
    description: "",
    paid_from_account_id: active[0]?.id ?? "",
    amount: 0,
    vat_amount: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const total = Number(f.amount || 0) + Number(f.vat_amount || 0);

  const submit = async () => {
    if (!f.description.trim() || !f.paid_from_account_id || total <= 0) {
      toast.error(lang === "ar" ? "البيانات غير مكتملة" : "Missing fields"); return;
    }
    setSaving(true);
    try {
      await save({ data: {
        expense_date: new Date(f.expense_date + "T12:00:00").toISOString(),
        category: f.category, description: f.description.trim(),
        paid_from_account_id: f.paid_from_account_id,
        amount: Number(f.amount), vat_amount: Number(f.vat_amount || 0),
        notes: f.notes || null,
      } } as any);
      toast.success(lang === "ar" ? "تم تسجيل المصروف" : "Expense recorded");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "مصروف جديد" : "New expense"}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "سيتم تسجيل حركة صادر تلقائيًا على الحساب المختار." : "A cash-out movement is recorded on the selected account."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "التاريخ" : "Date"}>
              <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
            </Field>
            <Field label={lang === "ar" ? "الفئة" : "Category"}>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as ExpenseCategoryId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.ar : c.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={lang === "ar" ? "الوصف" : "Description"}>
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الحساب الدافع" : "Paid from account"}>
            <Select value={f.paid_from_account_id} onValueChange={(v) => setF({ ...f, paid_from_account_id: v })}>
              <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر…" : "Select…"} /></SelectTrigger>
              <SelectContent>
                {active.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
              <Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            </Field>
            <Field label={lang === "ar" ? "ضريبة" : "VAT"}>
              <Input type="number" step="0.01" value={f.vat_amount} onChange={(e) => setF({ ...f, vat_amount: Number(e.target.value) })} />
            </Field>
            <Field label={lang === "ar" ? "الإجمالي" : "Total"}>
              <Input readOnly value={total.toFixed(2)} />
            </Field>
          </div>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   3. SUPPLIER PAYMENTS
   ════════════════════════════════════════════════════ */
type SupplierPaymentRow = {
  id: string; number: string; supplier_id: string; paid_from_account_id: string;
  amount: number; method: string; reference: string | null;
  applied_invoice_id: string | null; paid_at: string; notes: string | null;
};
type SupplierRow = { id: string; supplier_name: string; opening_balance: number; active: boolean };

export function ManagerSupplierPayments() {
  const { lang, fmtMoney } = useApp();
  const fetchPays = useApiAction(listSupplierPayments);
  const fetchSuppliers = useApiAction(listSuppliers);
  const fetchAccounts = useApiAction(listFinanceAccounts);
  const [rows, setRows] = useState<SupplierPaymentRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, s, a]: any = await Promise.all([fetchPays({ data: {} } as any), fetchSuppliers(), fetchAccounts()]);
      setRows(p); setSuppliers(s.suppliers ?? s); setAccounts(a);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const supById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "مدفوعات الموردين" : "Supplier Payments"}
        subtitle={lang === "ar" ? "تسجيل دفعات الموردين وتأثيرها على الأرصدة" : "Record supplier payments and update balances"}
        action={<Button size="sm" onClick={() => setCreating(true)} disabled={suppliers.length === 0 || accounts.length === 0}>
          <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "دفعة جديدة" : "New Payment"}
        </Button>}
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الرقم" : "Number"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المورد" : "Supplier"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحساب" : "From Account"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الطريقة" : "Method"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المرجع" : "Reference"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={7} text={lang === "ar" ? "تحميل…" : "Loading…"} />
              : rows.length === 0 ? <tr><td colSpan={7}><EmptyState icon={Banknote} title={lang === "ar" ? "لا توجد مدفوعات" : "No payments"} /></td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="p-3 font-mono text-xs">{r.number}</td>
                  <td className="p-3 text-xs">{fmtDateTime(r.paid_at, lang)}</td>
                  <td className="p-3">{supById.get(r.supplier_id)?.supplier_name || "—"}</td>
                  <td className="p-3 text-xs">{accById.get(r.paid_from_account_id)?.[lang === "ar" ? "name_ar" : "name_en"] || "—"}</td>
                  <td className="p-3 text-xs">{r.method}</td>
                  <td className="p-3 text-xs">{r.reference || "—"}</td>
                  <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(Number(r.amount))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <SupplierPaymentDialog
          suppliers={suppliers} accounts={accounts}
          onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }}
        />
      )}
    </ManagerLayout>
  );
}

function SupplierPaymentDialog({ suppliers, accounts, onClose, onSaved }:
  { suppliers: SupplierRow[]; accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(createSupplierPayment);
  const active = accounts.filter((a) => a.active);
  const [f, setF] = useState({
    supplier_id: suppliers[0]?.id ?? "",
    paid_from_account_id: active[0]?.id ?? "",
    amount: 0, method: "cash" as "cash" | "bank" | "transfer",
    reference: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!f.supplier_id || !f.paid_from_account_id || f.amount <= 0) {
      toast.error(lang === "ar" ? "البيانات غير مكتملة" : "Missing fields"); return;
    }
    setSaving(true);
    try {
      await save({ data: {
        supplier_id: f.supplier_id, paid_from_account_id: f.paid_from_account_id,
        amount: f.amount, method: f.method,
        reference: f.reference || undefined, notes: f.notes || undefined,
      } } as any);
      toast.success(lang === "ar" ? "تم تسجيل الدفعة" : "Payment recorded");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lang === "ar" ? "دفعة مورد" : "Supplier payment"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "ar" ? "المورد" : "Supplier"}>
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {suppliers.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "الحساب الدافع" : "Paid from"}>
            <Select value={f.paid_from_account_id} onValueChange={(v) => setF({ ...f, paid_from_account_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {active.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
              <Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            </Field>
            <Field label={lang === "ar" ? "الطريقة" : "Method"}>
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{lang === "ar" ? "نقدي" : "Cash"}</SelectItem>
                  <SelectItem value="bank">{lang === "ar" ? "بنكي" : "Bank"}</SelectItem>
                  <SelectItem value="transfer">{lang === "ar" ? "تحويل" : "Transfer"}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={lang === "ar" ? "المرجع" : "Reference"}>
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   4. CHART OF ACCOUNTS
   ════════════════════════════════════════════════════ */
type ChartAccount = {
  code: string; name_ar: string; name_en: string;
  type: CoaType; parent_code: string | null; active: boolean;
};

export function ManagerChart() {
  const { lang } = useApp();
  const fetchAll = useApiAction(listChartAccounts);
  const [rows, setRows] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CoaType>("all");
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setRows((await fetchAll()) as any); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.type === filter);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "دليل الحسابات" : "Chart of Accounts"}
        subtitle={lang === "ar" ? "تصنيف الحسابات للقيود المحاسبية" : "Account classification for journal entries"}
        action={<Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "حساب جديد" : "New Account"}
        </Button>}
      />
      <div className="card-soft mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الأنواع" : "All types"}</SelectItem>
            {COA_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{lang === "ar" ? t.ar : t.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ms-auto text-xs text-muted-foreground">{filtered.length} {lang === "ar" ? "حساب" : "accounts"}</div>
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الكود" : "Code"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحساب الأب" : "Parent"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={6} text={lang === "ar" ? "تحميل…" : "Loading…"} />
              : filtered.length === 0 ? <tr><td colSpan={6}><EmptyState icon={BookOpen} title={lang === "ar" ? "لا توجد حسابات" : "No accounts yet"} /></td></tr>
              : filtered.map((r) => (
                <tr key={r.code} className="border-b">
                  <td className="p-3 font-mono text-xs">{r.code}</td>
                  <td className="p-3">{lang === "ar" ? r.name_ar : r.name_en}</td>
                  <td className="p-3 text-xs">{tr(COA_TYPES, r.type, lang)}</td>
                  <td className="p-3 text-xs">{r.parent_code || "—"}</td>
                  <td className="p-3">{r.active ? <Badge variant="outline">{lang === "ar" ? "نشط" : "Active"}</Badge> : <Badge variant="outline" className="bg-muted">{lang === "ar" ? "موقوف" : "Inactive"}</Badge>}</td>
                  <td className="p-3 text-end"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <CoaDialog editing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); reload(); }} />
      )}
    </ManagerLayout>
  );
}

function CoaDialog({ editing, onClose, onSaved }: { editing: ChartAccount | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(upsertChartAccount);
  const [f, setF] = useState({
    code: editing?.code ?? "",
    name_ar: editing?.name_ar ?? "",
    name_en: editing?.name_en ?? "",
    type: (editing?.type ?? "asset") as CoaType,
    parent_code: editing?.parent_code ?? "",
    active: editing?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!f.code.trim() || !f.name_ar.trim() || !f.name_en.trim()) { toast.error(lang === "ar" ? "البيانات غير مكتملة" : "Missing fields"); return; }
    setSaving(true);
    try {
      await save({ data: {
        code: f.code.trim(), name_ar: f.name_ar.trim(), name_en: f.name_en.trim(),
        type: f.type, parent_code: f.parent_code || null, active: f.active,
      } } as any);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? (lang === "ar" ? "تعديل حساب" : "Edit account") : (lang === "ar" ? "حساب جديد" : "New account")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "الكود" : "Code"}>
              <Input value={f.code} disabled={!!editing} onChange={(e) => setF({ ...f, code: e.target.value })} />
            </Field>
            <Field label={lang === "ar" ? "النوع" : "Type"}>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as CoaType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COA_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{lang === "ar" ? t.ar : t.en}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}>
            <Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}>
            <Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الحساب الأب (اختياري)" : "Parent code (optional)"}>
            <Input value={f.parent_code} onChange={(e) => setF({ ...f, parent_code: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            {lang === "ar" ? "نشط" : "Active"}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   5. JOURNAL ENTRIES
   ════════════════════════════════════════════════════ */
type JournalLine = { id?: string; account_code: string; debit: number; credit: number; notes: string | null };
type JournalEntry = {
  id: string; number: string; entry_date: string; source: string; status: "posted" | "draft" | "reversed";
  description: string; created_at: string; reverses: string | null; reversed_by: string | null;
  lines: JournalLine[];
};

export function ManagerJournal() {
  const { lang, fmtMoney } = useApp();
  const fetchEntries = useApiAction(listJournalEntries);
  const fetchCoa = useApiAction(listChartAccounts);
  const reverseFn = useApiAction(reverseJournalEntry);
  const [rows, setRows] = useState<JournalEntry[]>([]);
  const [coa, setCoa] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<JournalEntry | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, c]: any = await Promise.all([fetchEntries({ data: {} } as any), fetchCoa()]);
      setRows(e); setCoa(c);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const reverse = async (id: string) => {
    if (!confirm(lang === "ar" ? "عكس هذا القيد؟" : "Reverse this entry?")) return;
    try { await reverseFn({ data: { id } } as any); toast.success(lang === "ar" ? "تم العكس" : "Reversed"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "القيود اليومية" : "Journal Entries"}
        subtitle={lang === "ar" ? "قيود مالية متوازنة (مدين = دائن)" : "Balanced double-entry bookkeeping"}
        action={<Button size="sm" onClick={() => setCreating(true)} disabled={coa.length < 2}>
          <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "قيد جديد" : "New Entry"}
        </Button>}
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الرقم" : "Number"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المصدر" : "Source"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الوصف" : "Description"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={7} text={lang === "ar" ? "تحميل…" : "Loading…"} />
              : rows.length === 0 ? <tr><td colSpan={7}><EmptyState icon={BookOpen} title={lang === "ar" ? "لا توجد قيود" : "No journal entries"} /></td></tr>
              : rows.map((e) => {
                const total = (e.lines || []).reduce((s, l) => s + Number(l.debit), 0);
                return (
                  <tr key={e.id} className="border-b">
                    <td className="p-3 font-mono text-xs">{e.number}</td>
                    <td className="p-3 text-xs">{fmtDate(e.entry_date, lang)}</td>
                    <td className="p-3 text-xs">{e.source}</td>
                    <td className="p-3">{e.description}</td>
                    <td className="p-3 text-end tabular-nums">{fmtMoney(total)}</td>
                    <td className="p-3"><Badge variant="outline" className={e.status === "reversed" ? "bg-muted text-muted-foreground" : ""}>{e.status}</Badge></td>
                    <td className="p-3 text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewing(e)}><Eye className="h-4 w-4" /></Button>
                        {e.status === "posted" && (
                          <Button variant="ghost" size="sm" onClick={() => reverse(e.id)} title={lang === "ar" ? "عكس" : "Reverse"}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {creating && <JournalDialog coa={coa} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {viewing && (
        <Sheet open onOpenChange={(o) => !o && setViewing(null)}>
          <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewing.number}</SheetTitle>
              <SheetDescription>{fmtDate(viewing.entry_date, lang)} • {viewing.description}</SheetDescription>
            </SheetHeader>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr><th className="p-2 text-start">{lang === "ar" ? "الحساب" : "Account"}</th>
                  <th className="p-2 text-end">{lang === "ar" ? "مدين" : "Debit"}</th>
                  <th className="p-2 text-end">{lang === "ar" ? "دائن" : "Credit"}</th></tr>
              </thead>
              <tbody>
                {viewing.lines.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-mono text-xs">{l.account_code}</td>
                    <td className="p-2 text-end tabular-nums">{Number(l.debit) > 0 ? fmtMoney(Number(l.debit)) : "—"}</td>
                    <td className="p-2 text-end tabular-nums">{Number(l.credit) > 0 ? fmtMoney(Number(l.credit)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SheetContent>
        </Sheet>
      )}
    </ManagerLayout>
  );
}

function JournalDialog({ coa, onClose, onSaved }: { coa: ChartAccount[]; onClose: () => void; onSaved: () => void }) {
  const { lang, fmtMoney } = useApp();
  const save = useApiAction(createJournalEntry);
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<JournalLine[]>([
    { account_code: "", debit: 0, credit: 0, notes: null },
    { account_code: "", debit: 0, credit: 0, notes: null },
  ]);
  const [saving, setSaving] = useState(false);

  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  const balanced = diff === 0 && debit > 0;

  const updateLine = (i: number, patch: Partial<JournalLine>) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const submit = async () => {
    if (!description.trim()) { toast.error(lang === "ar" ? "أدخل الوصف" : "Enter description"); return; }
    if (!balanced) { toast.error(lang === "ar" ? "القيد غير متوازن" : "Entry not balanced"); return; }
    for (const l of lines) if (!l.account_code) { toast.error(lang === "ar" ? "اختر الحسابات" : "Choose accounts"); return; }
    setSaving(true);
    try {
      await save({ data: {
        entry_date: new Date(entryDate + "T12:00:00").toISOString(),
        description: description.trim(),
        lines: lines.map((l) => ({ account_code: l.account_code, debit: Number(l.debit || 0), credit: Number(l.credit || 0), notes: l.notes || null })),
      } } as any);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{lang === "ar" ? "قيد يومي جديد" : "New journal entry"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "التاريخ" : "Date"}>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label={lang === "ar" ? "الوصف" : "Description"}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{lang === "ar" ? "الحساب" : "Account"}</th>
                  <th className="p-2 text-end">{lang === "ar" ? "مدين" : "Debit"}</th>
                  <th className="p-2 text-end">{lang === "ar" ? "دائن" : "Credit"}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <Select value={l.account_code} onValueChange={(v) => updateLine(i, { account_code: v })}>
                        <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر…" : "Select…"} /></SelectTrigger>
                        <SelectContent>
                          {coa.filter((c) => c.active).map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.code} — {lang === "ar" ? c.name_ar : c.name_en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2"><Input type="number" step="0.01" value={l.debit} onChange={(e) => updateLine(i, { debit: Number(e.target.value), credit: 0 })} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={l.credit} onChange={(e) => updateLine(i, { credit: Number(e.target.value), debit: 0 })} /></td>
                    <td className="p-2 text-end">
                      {lines.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t bg-muted/30 p-2 text-xs">
              <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { account_code: "", debit: 0, credit: 0, notes: null }])}>
                <Plus className="me-1 h-3 w-3" />{lang === "ar" ? "سطر" : "Line"}
              </Button>
              <div className="flex gap-4 tabular-nums">
                <span>{lang === "ar" ? "مدين" : "Debit"}: <b>{fmtMoney(debit)}</b></span>
                <span>{lang === "ar" ? "دائن" : "Credit"}: <b>{fmtMoney(credit)}</b></span>
                <span className={balanced ? "text-success" : "text-destructive"}>
                  {lang === "ar" ? "الفرق" : "Diff"}: <b>{fmtMoney(diff)}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving || !balanced}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   6. EMPLOYEES
   ════════════════════════════════════════════════════ */
type Employee = {
  id: string; name: string; job_title: string; mobile: string | null;
  monthly_salary: number; start_date: string; status: "active" | "disabled"; notes: string | null;
};

export function ManagerEmployees() {
  const { lang, fmtMoney } = useApp();
  const fetchAll = useApiAction(listEmployees);
  const setStatus = useApiAction(setEmployeeStatus);
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const reload = async () => {
    setLoading(true);
    try { setRows((await fetchAll()) as any); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const toggle = async (e: Employee) => {
    try {
      await setStatus({ data: { id: e.id, status: e.status === "active" ? "disabled" : "active" } } as any);
      reload();
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الموظفون" : "Employees"}
        subtitle={lang === "ar" ? "بيانات الموظفين الأساسية والرواتب" : "Basic employee data and salaries"}
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus className="me-1 h-4 w-4" />{lang === "ar" ? "موظف جديد" : "New Employee"}</Button>}
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المسمى" : "Job Title"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الجوال" : "Mobile"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "تاريخ المباشرة" : "Start Date"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الراتب" : "Salary"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRow cols={7} text={lang === "ar" ? "تحميل…" : "Loading…"} />
              : rows.length === 0 ? <tr><td colSpan={7}><EmptyState icon={Users} title={lang === "ar" ? "لا يوجد موظفون" : "No employees"} /></td></tr>
              : rows.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3 font-medium">{e.name}</td>
                  <td className="p-3 text-xs">{e.job_title}</td>
                  <td className="p-3 text-xs">{e.mobile || "—"}</td>
                  <td className="p-3 text-xs">{fmtDate(e.start_date, lang)}</td>
                  <td className="p-3 text-end tabular-nums">{fmtMoney(Number(e.monthly_salary))}</td>
                  <td className="p-3"><Badge variant="outline" className={e.status === "disabled" ? "bg-muted" : ""}>{e.status === "active" ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "موقوف" : "Disabled")}</Badge></td>
                  <td className="p-3 text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => toggle(e)}>{e.status === "active" ? (lang === "ar" ? "إيقاف" : "Disable") : (lang === "ar" ? "تفعيل" : "Enable")}</Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <EmployeeDialog editing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); reload(); }} />
      )}
    </ManagerLayout>
  );
}

function EmployeeDialog({ editing, onClose, onSaved }: { editing: Employee | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(upsertEmployee);
  const [f, setF] = useState({
    name: editing?.name ?? "",
    job_title: editing?.job_title ?? "",
    mobile: editing?.mobile ?? "",
    monthly_salary: editing?.monthly_salary ?? 0,
    start_date: editing?.start_date ?? new Date().toISOString().slice(0, 10),
    status: (editing?.status ?? "active") as "active" | "disabled",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!f.name.trim() || !f.job_title.trim()) { toast.error(lang === "ar" ? "الاسم والمسمى مطلوبان" : "Name & title required"); return; }
    setSaving(true);
    try {
      await save({ data: {
        id: editing?.id, name: f.name.trim(), job_title: f.job_title.trim(),
        mobile: f.mobile || null, monthly_salary: Number(f.monthly_salary) || 0,
        start_date: f.start_date, status: f.status, notes: f.notes || null,
      } } as any);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved"); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? (lang === "ar" ? "تعديل موظف" : "Edit employee") : (lang === "ar" ? "موظف جديد" : "New employee")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "الاسم" : "Name"}>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label={lang === "ar" ? "المسمى الوظيفي" : "Job title"}>
              <Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "الجوال" : "Mobile"}>
              <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
            </Field>
            <Field label={lang === "ar" ? "تاريخ المباشرة" : "Start date"}>
              <Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
            </Field>
          </div>
          <Field label={lang === "ar" ? "الراتب الشهري" : "Monthly salary"}>
            <Input type="number" step="0.01" value={f.monthly_salary} onChange={(e) => setF({ ...f, monthly_salary: Number(e.target.value) })} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.status === "active"} onChange={(e) => setF({ ...f, status: e.target.checked ? "active" : "disabled" })} />
            {lang === "ar" ? "نشط" : "Active"}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   7. PAYROLL / SALARIES (also handles advances/deductions)
   ════════════════════════════════════════════════════ */
type EmployeeAdjustment = {
  id: string; employee_id: string; month: string;
  kind: "advance" | "deduction"; amount: number; notes: string | null; created_at: string;
};
type SalaryRecord = {
  id: string; employee_id: string; month: string;
  basic: number; advances: number; deductions: number; net: number;
  status: "paid" | "partial" | "unpaid";
  paid_amount: number | null; paid_at: string | null; paid_from_account_id: string | null;
};

export function ManagerPayroll() {
  const { lang, fmtMoney } = useApp();
  const fetchEmps = useApiAction(listEmployees);
  const fetchAccounts = useApiAction(listFinanceAccounts);
  const fetchAdj = useApiAction(listEmployeeAdjustments);
  const fetchSalaries = useApiAction(listSalaryRecords);
  const previewFn = useApiAction(previewPayroll);
  const generateFn = useApiAction(generatePayroll);
  const payFn = useApiAction(paySalaryRecord);
  const addAdj = useApiAction(createEmployeeAdjustment);
  const delAdj = useApiAction(deleteEmployeeAdjustment);

  const [month, setMonth] = useState(curMonth());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [adjustments, setAdjustments] = useState<EmployeeAdjustment[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addAdjOpen, setAddAdjOpen] = useState(false);
  const [paying, setPaying] = useState<SalaryRecord | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [emp, acc, adj, sal, pv]: any = await Promise.all([
        fetchEmps(),
        fetchAccounts(),
        fetchAdj({ data: { month } } as any),
        fetchSalaries({ data: { month } } as any),
        previewFn({ data: { month } } as any),
      ]);
      setEmployees(emp); setAccounts(acc); setAdjustments(adj); setSalaries(sal); setPreview(pv);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [month]);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const generate = async () => {
    setBusy(true);
    try {
      const r: any = await generateFn({ data: { month } } as any);
      toast.success(lang === "ar" ? `تم إنشاء ${r.created} سجل` : `Created ${r.created} records`);
      reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const removeAdj = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف؟" : "Delete?")) return;
    try { await delAdj({ data: { id } } as any); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الرواتب" : "Payroll"}
        subtitle={lang === "ar" ? "معاينة وإنشاء ودفع رواتب الموظفين" : "Preview, generate and pay employee salaries"}
        action={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" onClick={() => setAddAdjOpen(true)} disabled={employees.length === 0}>
              <Plus className="me-1 h-4 w-4" />{lang === "ar" ? "سلفة/خصم" : "Advance/Deduction"}
            </Button>
            <Button size="sm" onClick={generate} disabled={busy || !preview?.rows?.length}>
              {lang === "ar" ? "إنشاء سجلات الشهر" : "Generate Month"}
            </Button>
          </div>
        }
      />

      {loading ? <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <>
          {preview?.totals && (
            <div className="card-soft mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
              <KV k={lang === "ar" ? "أساسي" : "Basic"} v={fmtMoney(preview.totals.basic)} />
              <KV k={lang === "ar" ? "سلف" : "Advances"} v={fmtMoney(preview.totals.advances)} />
              <KV k={lang === "ar" ? "خصومات" : "Deductions"} v={fmtMoney(preview.totals.deductions)} />
              <KV k={lang === "ar" ? "صافي" : "Net"} v={fmtMoney(preview.totals.net)} />
            </div>
          )}

          {/* Salary records / preview */}
          <div className="card-soft overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{lang === "ar" ? "الموظف" : "Employee"}</th>
                  <th className="p-3 text-end">{lang === "ar" ? "أساسي" : "Basic"}</th>
                  <th className="p-3 text-end">{lang === "ar" ? "سلف" : "Advances"}</th>
                  <th className="p-3 text-end">{lang === "ar" ? "خصومات" : "Deductions"}</th>
                  <th className="p-3 text-end">{lang === "ar" ? "صافي" : "Net"}</th>
                  <th className="p-3 text-end">{lang === "ar" ? "مدفوع" : "Paid"}</th>
                  <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {(salaries.length ? salaries : (preview?.rows ?? [])).length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon={Wallet} title={lang === "ar" ? "لا توجد بيانات لهذا الشهر" : "Nothing for this month"} hint={lang === "ar" ? "أضف موظفين أو غيّر الشهر" : "Add employees or change month"} /></td></tr>
                ) : salaries.length ? salaries.map((s) => {
                  const emp = empById.get(s.employee_id);
                  const remaining = Number(s.net) - Number(s.paid_amount ?? 0);
                  return (
                    <tr key={s.id} className="border-b">
                      <td className="p-3 font-medium">{emp?.name ?? s.employee_id}</td>
                      <td className="p-3 text-end tabular-nums">{fmtMoney(Number(s.basic))}</td>
                      <td className="p-3 text-end tabular-nums">{fmtMoney(Number(s.advances))}</td>
                      <td className="p-3 text-end tabular-nums">{fmtMoney(Number(s.deductions))}</td>
                      <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(Number(s.net))}</td>
                      <td className="p-3 text-end tabular-nums">{fmtMoney(Number(s.paid_amount ?? 0))}{remaining > 0 && <div className="text-[10px] text-muted-foreground">{lang === "ar" ? "متبقي" : "Rem"}: {fmtMoney(remaining)}</div>}</td>
                      <td className="p-3"><Badge variant="outline" className={s.status === "paid" ? "bg-success/10 text-success" : s.status === "partial" ? "bg-warning/10" : ""}>{s.status}</Badge></td>
                      <td className="p-3 text-end">
                        {s.status !== "paid" && <Button size="sm" variant="outline" onClick={() => setPaying(s)}>{lang === "ar" ? "دفع" : "Pay"}</Button>}
                      </td>
                    </tr>
                  );
                }) : (preview?.rows ?? []).map((p: any) => (
                  <tr key={p.employee_id} className="border-b bg-muted/20">
                    <td className="p-3 font-medium">{p.employee_name}<div className="text-[10px] text-muted-foreground">{lang === "ar" ? "(معاينة)" : "(preview)"}</div></td>
                    <td className="p-3 text-end tabular-nums">{fmtMoney(p.basic)}</td>
                    <td className="p-3 text-end tabular-nums">{fmtMoney(p.advances)}</td>
                    <td className="p-3 text-end tabular-nums">{fmtMoney(p.deductions)}</td>
                    <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(p.net)}</td>
                    <td className="p-3 text-end">—</td>
                    <td className="p-3"><Badge variant="outline">{lang === "ar" ? "غير منشأ" : "Not generated"}</Badge></td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Advances/Deductions list */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold">{lang === "ar" ? "السلف والخصومات لهذا الشهر" : "Advances & Deductions this month"}</h2>
            <div className="card-soft overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start">{lang === "ar" ? "الموظف" : "Employee"}</th>
                    <th className="p-3 text-start">{lang === "ar" ? "النوع" : "Kind"}</th>
                    <th className="p-3 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                    <th className="p-3 text-start">{lang === "ar" ? "ملاحظات" : "Notes"}</th>
                    <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">{lang === "ar" ? "لا توجد قيود" : "None"}</td></tr>
                  ) : adjustments.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="p-3">{empById.get(a.employee_id)?.name ?? "—"}</td>
                      <td className="p-3 text-xs">{tr(ADJ_KINDS, a.kind, lang)}</td>
                      <td className="p-3 text-end tabular-nums">{fmtMoney(Number(a.amount))}</td>
                      <td className="p-3 text-xs">{a.notes || "—"}</td>
                      <td className="p-3 text-xs">{fmtDate(a.created_at, lang)}</td>
                      <td className="p-3 text-end"><Button variant="ghost" size="sm" onClick={() => removeAdj(a.id)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {addAdjOpen && (
        <AdjustmentDialog employees={employees} month={month}
          onClose={() => setAddAdjOpen(false)} onSaved={() => { setAddAdjOpen(false); reload(); }} />
      )}
      {paying && (
        <PaySalaryDialog record={paying} employee={empById.get(paying.employee_id)} accounts={accounts}
          onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload(); }} />
      )}
    </ManagerLayout>
  );
}

function AdjustmentDialog({ employees, month, onClose, onSaved }:
  { employees: Employee[]; month: string; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(createEmployeeAdjustment);
  const active = employees.filter((e) => e.status === "active");
  const [f, setF] = useState({
    employee_id: active[0]?.id ?? "",
    kind: "advance" as "advance" | "deduction",
    amount: 0, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!f.employee_id || f.amount <= 0) { toast.error(lang === "ar" ? "البيانات غير مكتملة" : "Missing fields"); return; }
    setSaving(true);
    try {
      await save({ data: { employee_id: f.employee_id, month, kind: f.kind, amount: f.amount, notes: f.notes || undefined } } as any);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved"); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "سلفة / خصم" : "Advance / Deduction"}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "للشهر" : "For month"} {month}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "ar" ? "الموظف" : "Employee"}>
            <Select value={f.employee_id} onValueChange={(v) => setF({ ...f, employee_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{active.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === "ar" ? "النوع" : "Kind"}>
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ADJ_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{lang === "ar" ? k.ar : k.en}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
              <Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "حفظ" : "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaySalaryDialog({ record, employee, accounts, onClose, onSaved }:
  { record: SalaryRecord; employee?: Employee; accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void }) {
  const { lang, fmtMoney } = useApp();
  const pay = useApiAction(paySalaryRecord);
  const active = accounts.filter((a) => a.active);
  const remaining = Number(record.net) - Number(record.paid_amount ?? 0);
  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const [amount, setAmount] = useState(remaining);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!accountId || amount <= 0 || amount > remaining + 0.005) { toast.error(lang === "ar" ? "البيانات غير صالحة" : "Invalid"); return; }
    setSaving(true);
    try {
      await pay({ data: { id: record.id, paid_from_account_id: accountId, amount, notes: notes || undefined } } as any);
      toast.success(lang === "ar" ? "تم الدفع" : "Paid"); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "دفع راتب" : "Pay salary"} — {employee?.name}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "شهر" : "Month"} {record.month} • {lang === "ar" ? "صافي" : "Net"} {fmtMoney(Number(record.net))} • {lang === "ar" ? "متبقي" : "Remaining"} {fmtMoney(remaining)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={lang === "ar" ? "الحساب الدافع" : "Paid from"}>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{active.map((a) => <SelectItem key={a.id} value={a.id}>{lang === "ar" ? a.name_ar : a.name_en}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "المبلغ" : "Amount"}>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : (lang === "ar" ? "دفع" : "Pay")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════
   8. SIMPLE FINANCE SUMMARY
   ════════════════════════════════════════════════════ */
export function ManagerFinReports() {
  const { lang, fmtMoney } = useApp();
  const fetchSummary = useApiAction(getFinanceSummary);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const reload = async () => {
    setLoading(true);
    try {
      setData(await fetchSummary({
        data: {
          date_from: new Date(from + "T00:00:00+03:00").toISOString(),
          date_to: new Date(to + "T23:59:59+03:00").toISOString(),
        },
      } as any));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [from, to]);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "ملخص مالي مبسّط" : "Simple Finance Summary"}
        subtitle={lang === "ar" ? "معاينة تشغيلية — ليست قوائم مالية مدققة" : "Operational preview — not audited financial statements"}
        action={
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        }
      />

      {loading || !data ? (
        <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <SummaryCard icon={TrendingUp} tone="success" label={lang === "ar" ? "المبيعات (شامل)" : "Sales (incl. VAT)"} value={fmtMoney(data.sales.including_vat)} sub={`${lang === "ar" ? "صافي" : "Net"} ${fmtMoney(data.sales.net)}`} />
            <SummaryCard icon={TrendingDown} tone="destructive" label={lang === "ar" ? "المرتجعات" : "Refunds"} value={fmtMoney(data.refunds_total)} />
            <SummaryCard icon={Receipt} label={lang === "ar" ? "المشتريات" : "Purchases"} value={fmtMoney(data.purchases_total)} />
            <SummaryCard icon={Receipt} label={lang === "ar" ? "المصروفات" : "Expenses"} value={fmtMoney(data.expenses.total)} />
            <SummaryCard icon={Users} label={lang === "ar" ? "الرواتب المدفوعة" : "Salaries paid"} value={fmtMoney(data.salaries_paid)} />
            <SummaryCard icon={DollarSign} tone="success" label={lang === "ar" ? "إجمالي الربح" : "Gross profit"} value={fmtMoney(data.gross_profit)} sub={lang === "ar" ? "صافي مبيعات − مشتريات" : "Net sales − purchases"} />
            <SummaryCard icon={DollarSign} tone={data.net_result >= 0 ? "success" : "destructive"} label={lang === "ar" ? "النتيجة الصافية" : "Net result"} value={fmtMoney(data.net_result)} sub={lang === "ar" ? "بعد المصروفات والرواتب" : "After expenses & salaries"} />
            <SummaryCard icon={Wallet} label={lang === "ar" ? "نقد بالصناديق" : "Cash on hand"} value={fmtMoney(data.cash_on_hand)} />
            <SummaryCard icon={Building2} label={lang === "ar" ? "أرصدة بنكية" : "Bank balances"} value={fmtMoney(data.bank_balances)} />
          </div>

          {data.accounts?.length > 0 && (
            <div className="card-soft mt-6 overflow-x-auto">
              <div className="border-b p-3 text-sm font-semibold">{lang === "ar" ? "أرصدة الحسابات" : "Account balances"}</div>
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr><th className="p-3 text-start">{lang === "ar" ? "الحساب" : "Account"}</th>
                    <th className="p-3 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
                    <th className="p-3 text-end">{lang === "ar" ? "الرصيد" : "Balance"}</th></tr>
                </thead>
                <tbody>
                  {data.accounts.map((a: any) => (
                    <tr key={a.id} className="border-b">
                      <td className="p-3">{lang === "ar" ? a.name_ar : a.name_en}</td>
                      <td className="p-3 text-xs">{tr(ACCOUNT_TYPES, a.type, lang)}</td>
                      <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(Number(a.balance))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.expenses?.by_category && Object.keys(data.expenses.by_category).length > 0 && (
            <div className="card-soft mt-6 overflow-x-auto">
              <div className="border-b p-3 text-sm font-semibold">{lang === "ar" ? "المصروفات حسب الفئة" : "Expenses by category"}</div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(data.expenses.by_category).map(([cat, amt]: any) => (
                    <tr key={cat} className="border-b">
                      <td className="p-3">{tr(EXPENSE_CATEGORIES, cat, lang)}</td>
                      <td className="p-3 text-end font-semibold tabular-nums">{fmtMoney(Number(amt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ManagerLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, tone }:
  { icon: any; label: string; value: string; sub?: string; tone?: "success" | "destructive" }) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("h-4 w-4",
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary")} />
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums",
        tone === "success" && "text-success", tone === "destructive" && "text-destructive")}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
