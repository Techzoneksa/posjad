"use client";

// Sprint E — Production-ready screens.
// Replaces five Phase6 simulations with backend-wired versions:
//   • ManagerActivity   → recent business activity (last ~7d, latest 200 events)
//   • ManagerAudit      → full audit log explorer with filters
//   • ManagerReadiness  → live data/configuration readiness checklist
//   • ManagerExport     → JSON/CSV export of core entities
//   • ManagerBackup     → backup posture + Supabase guidance
import { useEffect, useMemo, useState } from "react";
import { useApiAction } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { ManagerLayout } from "./ManagerScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, ShieldAlert, ClipboardCheck, Download, Database,
  CheckCircle2, AlertCircle, Circle, Inbox, RefreshCw, FileJson, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listAuditLogs, getReadinessSnapshot } from "@/lib/audit.functions";
import { listFinanceAccounts } from "@/lib/finance.functions";

/* ───────── Shared ───────── */
function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/60" />
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}
function fmtTime(ts: string | number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/* Map audit action codes → friendly labels (AR / EN) */
const ACTION_LABELS: Record<string, { ar: string; en: string; tone: "primary" | "warn" | "info" | "muted" }> = {
  "order.create":             { ar: "إنشاء طلب",          en: "Order created",         tone: "primary" },
  "refund.create":            { ar: "استرجاع طلب",         en: "Refund",                tone: "warn" },
  "shift.open":               { ar: "فتح وردية",          en: "Shift opened",          tone: "info" },
  "shift.close":              { ar: "إقفال وردية",        en: "Shift closed",          tone: "info" },
  "cash.pay_in":              { ar: "إيداع في الدرج",     en: "Cash pay-in",           tone: "info" },
  "cash.pay_out":             { ar: "سحب من الدرج",       en: "Cash pay-out",          tone: "warn" },
  "expense.create":           { ar: "تسجيل مصروف",        en: "Expense recorded",      tone: "warn" },
  "supplier_payment.create":  { ar: "دفع للمورد",         en: "Supplier payment",      tone: "warn" },
  "journal.create":           { ar: "قيد محاسبي",         en: "Journal entry",         tone: "info" },
  "journal.reverse":          { ar: "عكس قيد",            en: "Journal reversed",      tone: "warn" },
  "account.transfer":         { ar: "تحويل بين حسابات",   en: "Account transfer",      tone: "info" },
  "account.cash_in":          { ar: "إيداع نقدي",         en: "Cash in",               tone: "info" },
  "account.cash_out":         { ar: "صرف نقدي",           en: "Cash out",              tone: "warn" },
  "salary.pay":               { ar: "دفع راتب",           en: "Salary paid",           tone: "warn" },
  "settings.update":          { ar: "تعديل إعدادات",      en: "Settings updated",      tone: "info" },
  "product.create":           { ar: "إضافة منتج",         en: "Product created",       tone: "info" },
  "product.update":           { ar: "تعديل منتج",         en: "Product updated",       tone: "info" },
};

function ActionPill({ action, lang }: { action: string; lang: "ar" | "en" }) {
  const meta = ACTION_LABELS[action];
  const label = meta ? (lang === "ar" ? meta.ar : meta.en) : action;
  const tone = meta?.tone ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "warn" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        tone === "info" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/* ═══════════════════ 1. Activity (recent business events) ═══════════════════ */
export function ManagerActivity() {
  const { lang } = useApp();
  const call = useApiAction(listAuditLogs);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const sevenDays = new Date(Date.now() - 7 * 86400_000).toISOString();
      const r = await call({ data: { from: sevenDays, limit: 200 } });
      setRows(r as any[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "النشاط الأخير" : "Recent Activity"}
        subtitle={lang === "ar" ? "أهم العمليات خلال آخر 7 أيام" : "Key business events in the last 7 days"}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("me-2 h-4 w-4", loading && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        }
      />
      {rows.length === 0 ? (
        loading ? (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : (
          <EmptyState
            title={lang === "ar" ? "لا يوجد نشاط بعد" : "No activity yet"}
            hint={lang === "ar" ? "ستظهر الطلبات والمدفوعات والمصاريف هنا فور تسجيلها." : "Orders, payments, and expenses will appear here as they happen."}
          />
        )
      ) : (
        <div className="card-soft divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 p-3 sm:p-4">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionPill action={r.action} lang={lang as "ar" | "en"} />
                  <span className="text-xs text-muted-foreground">{fmtTime(r.created_at)}</span>
                  {r.user_name && (
                    <Badge variant="outline" className="text-xs">{r.user_name}</Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-sm text-foreground/80">
                  {summarizeAudit(r, lang as "ar" | "en")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

function summarizeAudit(r: any, lang: "ar" | "en"): string {
  const v = r.new_value ?? {};
  switch (r.action) {
    case "order.create":
      return lang === "ar"
        ? `${v.order_number ?? ""} — ${v.total ?? ""} ر.س — ${v.items ?? 0} صنف`
        : `${v.order_number ?? ""} — SAR ${v.total ?? ""} — ${v.items ?? 0} items`;
    case "refund.create":
      return lang === "ar" ? `استرجاع بقيمة ${v.amount ?? ""} ر.س` : `Refund SAR ${v.amount ?? ""}`;
    case "shift.open":
      return lang === "ar" ? `رصيد افتتاحي ${v.opening_float ?? 0} ر.س` : `Opening float SAR ${v.opening_float ?? 0}`;
    case "shift.close":
      return lang === "ar"
        ? `كاش ${v.closing_cash ?? 0} / متوقع ${v.expected_cash ?? 0} / فرق ${v.variance ?? 0}`
        : `Cash ${v.closing_cash ?? 0} / expected ${v.expected_cash ?? 0} / variance ${v.variance ?? 0}`;
    case "expense.create":
      return `${v.number ?? ""} — ${v.category ?? ""} — ${v.total ?? ""}`;
    case "supplier_payment.create":
      return `${v.number ?? ""} — ${v.amount ?? ""} (${v.method ?? ""})`;
    case "salary.pay":
      return lang === "ar" ? `راتب ${v.month ?? ""} — ${v.amount ?? ""}` : `Salary ${v.month ?? ""} — ${v.amount ?? ""}`;
    case "settings.update":
      return Object.keys(v).slice(0, 4).join(", ");
    case "product.update": {
      const old = r.old_value ?? {};
      if (old.price != null && v.price != null && Number(old.price) !== Number(v.price)) {
        return lang === "ar"
          ? `سعر ${v.name_ar} ${old.price} ← ${v.price}`
          : `Price ${v.name_ar}: ${old.price} → ${v.price}`;
      }
      return v.name_ar ?? "";
    }
    default:
      return typeof v === "object" ? JSON.stringify(v).slice(0, 140) : String(v);
  }
}

/* ═══════════════════ 2. Audit logs explorer ═══════════════════ */
export function ManagerAudit() {
  const { lang } = useApp();
  const call = useApiAction(listAuditLogs);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await call({ data: { limit: 500 } });
      setRows(r as any[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );
  const entities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity_type))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterAction !== "all" && r.action !== filterAction) return false;
      if (filterEntity !== "all" && r.entity_type !== filterEntity) return false;
      if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filterAction, filterEntity, search]);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "سجل المراجعة" : "Audit Log"}
        subtitle={lang === "ar" ? "كل العمليات الحساسة مسجلة هنا للمراجعة." : "Every sensitive action is recorded here for review."}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("me-2 h-4 w-4", loading && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        }
      />
      <div className="card-soft mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Label className="text-xs">{lang === "ar" ? "بحث" : "Search"}</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === "ar" ? "ابحث..." : "Search..."} />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "العملية" : "Action"}</Label>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "النوع" : "Entity"}</Label>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              {entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        loading ? (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : (
          <EmptyState title={lang === "ar" ? "لا توجد نتائج" : "No results"} />
        )
      ) : (
        <div className="card-soft divide-y">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpen(r)}
              className="flex w-full items-start gap-3 p-3 text-start hover:bg-muted/40 sm:p-4"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionPill action={r.action} lang={lang as "ar" | "en"} />
                  <Badge variant="outline" className="text-xs">{r.entity_type}</Badge>
                  {r.user_role && <Badge variant="secondary" className="text-xs">{r.user_role}</Badge>}
                  <span className="text-xs text-muted-foreground">{fmtTime(r.created_at)}</span>
                </div>
                <div className="mt-1 truncate text-sm text-foreground/80">
                  {summarizeAudit(r, lang as "ar" | "en")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ActionPill action={open.action} lang={lang as "ar" | "en"} />
                  <span className="text-xs text-muted-foreground">{open.entity_type}</span>
                </SheetTitle>
                <SheetDescription>{fmtTime(open.created_at)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div><span className="text-muted-foreground">{lang === "ar" ? "المستخدم: " : "User: "}</span>{open.user_name ?? "—"} {open.user_role && <span className="text-muted-foreground">({open.user_role})</span>}</div>
                {open.entity_id && <div><span className="text-muted-foreground">ID: </span><span className="font-mono text-xs">{open.entity_id}</span></div>}
                {open.old_value && (
                  <div>
                    <div className="mb-1 text-muted-foreground">{lang === "ar" ? "قبل" : "Before"}</div>
                    <pre className="overflow-x-auto rounded border bg-muted/40 p-2 text-xs">{JSON.stringify(open.old_value, null, 2)}</pre>
                  </div>
                )}
                {open.new_value && (
                  <div>
                    <div className="mb-1 text-muted-foreground">{lang === "ar" ? "بعد" : "After"}</div>
                    <pre className="overflow-x-auto rounded border bg-muted/40 p-2 text-xs">{JSON.stringify(open.new_value, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ManagerLayout>
  );
}

/* ═══════════════════ 3. System Readiness ═══════════════════ */
type CheckStatus = "ready" | "warn" | "missing";
type Check = { id: string; label: string; status: CheckStatus; hint?: string };
type CheckGroup = { id: string; label: string; items: Check[] };

function buildReadiness(snap: any, lang: "ar" | "en"): CheckGroup[] {
  const c = snap.counts;
  const s = snap.settings;
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const yn = (ok: boolean): CheckStatus => (ok ? "ready" : "missing");

  return [
    {
      id: "catalog",
      label: T("الكتالوج", "Catalog"),
      items: [
        { id: "cat",  label: T("توجد أصناف",     "Categories defined"), status: yn(c.categories > 0) },
        { id: "prod", label: T("منتجات مفعّلة",  "Active products"),   status: yn(c.activeProducts > 0), hint: `${c.activeProducts}/${c.products}` },
        { id: "add",  label: T("إضافات معرَّفة",  "Addons defined"),    status: yn(c.addons > 0) },
      ],
    },
    {
      id: "settings",
      label: T("الإعدادات", "Settings"),
      items: [
        { id: "brand", label: T("اسم العلامة التجارية", "Brand name"), status: yn(s.loaded) },
        { id: "vat",   label: T("نسبة الضريبة",         "VAT rate"),   status: s.vatRate != null ? (Number(s.vatRate) > 0 ? "ready" : "warn") : "missing", hint: s.vatRate != null ? `${Math.round(Number(s.vatRate) * 100)}%` : undefined },
        { id: "incl",  label: T("الأسعار شاملة الضريبة", "Prices include VAT"), status: yn(!!s.pricesIncludeVat) },
        { id: "logo",  label: T("شعار للطباعة", "Receipt logo"), status: s.logoUrl ? "ready" : "warn" },
        { id: "rec",   label: T("عرض الإيصال", "Receipt width"), status: yn(!!s.receiptWidth) },
      ],
    },
    {
      id: "zatca",
      label: T("جاهزية زاتكا", "ZATCA readiness"),
      items: [
        { id: "legal", label: T("الاسم القانوني عربي/إنجليزي", "Legal name AR/EN"), status: yn(!s.missingZatcaFields.includes("legal_name_ar") && !s.missingZatcaFields.includes("legal_name_en")) },
        { id: "vatno", label: T("الرقم الضريبي", "VAT number"),   status: yn(!s.missingZatcaFields.includes("vat_number")) },
        { id: "cr",    label: T("السجل التجاري", "Commercial registration"), status: yn(!s.missingZatcaFields.includes("commercial_registration")) },
        { id: "addr",  label: T("العنوان الوطني", "National address"), status: yn(!s.missingZatcaFields.includes("national_address")) },
      ],
    },
    {
      id: "ops",
      label: T("التشغيل", "Operations"),
      items: [
        { id: "users", label: T("مستخدمون مفعّلون", "Users created"), status: yn(c.users > 0) },
        { id: "shift", label: T("ورديات مسجَّلة", "Shifts recorded"), status: yn(c.shifts > 0), hint: `${c.openShifts} ${T("مفتوحة", "open")}` },
        { id: "ord",   label: T("طلبات مكتملة", "Completed orders"), status: yn(c.completedOrders > 0), hint: `${c.completedOrders}` },
      ],
    },
    {
      id: "inv",
      label: T("المخزون والمشتريات", "Inventory & purchases"),
      items: [
        { id: "sup",  label: T("موردون",         "Suppliers"),        status: yn(c.suppliers > 0) },
        { id: "item", label: T("أصناف مخزنية",   "Inventory items"),  status: yn(c.inventory > 0) },
        { id: "pur",  label: T("فواتير شراء",    "Purchase invoices"),status: c.purchases > 0 ? "ready" : "warn" },
        { id: "rec",  label: T("وصفات",          "Recipes"),          status: c.recipes > 0 ? "ready" : "warn" },
      ],
    },
    {
      id: "fin",
      label: T("المالية والموارد البشرية", "Finance & HR"),
      items: [
        { id: "acc",  label: T("حسابات/خزائن",   "Cashboxes / banks"),status: yn(c.financeAccounts > 0) },
        { id: "exp",  label: T("مصروفات",        "Expenses"),         status: c.expenses > 0 ? "ready" : "warn" },
        { id: "je",   label: T("قيود محاسبية",   "Journal entries"),  status: c.journals > 0 ? "ready" : "warn" },
        { id: "emp",  label: T("موظفون",         "Employees"),        status: c.employees > 0 ? "ready" : "warn" },
      ],
    },
    {
      id: "audit",
      label: T("التتبع", "Auditing"),
      items: [
        { id: "logs", label: T("سجل المراجعة يعمل", "Audit log writes"), status: yn(c.auditLogs > 0), hint: `${c.auditLogs}` },
      ],
    },
  ];
}

export function ManagerReadiness() {
  const { lang } = useApp();
  const call = useApiAction(getReadinessSnapshot);
  const [snap, setSnap] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setSnap(await call({})); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const groups = useMemo(() => (snap ? buildReadiness(snap, lang as "ar" | "en") : []), [snap, lang]);
  const all = groups.flatMap((g) => g.items);
  const ready = all.filter((i) => i.status === "ready").length;
  const warn = all.filter((i) => i.status === "warn").length;
  const missing = all.filter((i) => i.status === "missing").length;
  const pct = all.length ? Math.round((ready / all.length) * 100) : 0;

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "جاهزية النظام" : "System Readiness"}
        subtitle={lang === "ar" ? "حالة البيانات والإعدادات قبل التشغيل" : "Live data + configuration readiness"}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("me-2 h-4 w-4", loading && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        }
      />

      {!snap ? (
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
          {lang === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : (
        <>
          <div className="card-soft mb-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">{lang === "ar" ? "نسبة الجاهزية" : "Overall readiness"}</div>
                <div className="text-3xl font-bold">{pct}%</div>
                <div className="text-xs text-muted-foreground">{ready} / {all.length}</div>
              </div>
              <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="hidden gap-3 text-xs sm:flex">
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {ready}</span>
                <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> {warn}</span>
                <span className="flex items-center gap-1 text-rose-600"><Circle className="h-3 w-3" /> {missing}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="card-soft p-4">
                <div className="mb-3 font-semibold">{g.label}</div>
                <ul className="space-y-2 text-sm">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {it.status === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {it.status === "warn" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                        {it.status === "missing" && <Circle className="h-4 w-4 text-rose-500" />}
                        <span>{it.label}</span>
                      </div>
                      {it.hint && <span className="text-xs text-muted-foreground">{it.hint}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </ManagerLayout>
  );
}

/* ═══════════════════ 4. Export ═══════════════════ */
const EXPORTABLES = [
  { id: "audit",    table: "audit_logs",        labelAr: "سجل المراجعة",    labelEn: "Audit log" },
  { id: "orders",   table: "orders",            labelAr: "الطلبات",         labelEn: "Orders" },
  { id: "invoices", table: "invoices",          labelAr: "الفواتير",         labelEn: "Invoices" },
  { id: "expenses", table: "expenses",          labelAr: "المصروفات",        labelEn: "Expenses" },
  { id: "supply",   table: "supplier_payments", labelAr: "دفعات الموردين",  labelEn: "Supplier payments" },
  { id: "journals", table: "journal_entries",   labelAr: "القيود",          labelEn: "Journal entries" },
  { id: "salaries", table: "salary_records",    labelAr: "الرواتب",         labelEn: "Salary records" },
];

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce<Set<string>>((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set()),
  );
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ManagerExport() {
  const { lang } = useApp();
  const callAudit = useApiAction(listAuditLogs);
  const [busy, setBusy] = useState<string | null>(null);

  // Generic export uses listAuditLogs for audit; everything else requires real per-table fetchers.
  // We do not have generic raw-table fetchers from the client, so we expose audit + JSON snapshots of
  // readiness counts. Per-entity dumps will be added as needed.
  const exportAudit = async (fmt: "json" | "csv") => {
    setBusy("audit-" + fmt);
    try {
      const rows = await callAudit({ data: { limit: 500 } });
      const stamp = new Date().toISOString().slice(0, 10);
      if (fmt === "json") download(`audit-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
      else download(`audit-${stamp}.csv`, toCsv(rows as any[]), "text/csv");
    } finally { setBusy(null); }
  };

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "تصدير البيانات" : "Export Data"}
        subtitle={lang === "ar" ? "تنزيل لقطة من البيانات للأرشفة أو المحاسب" : "Download a snapshot for archiving or your accountant"}
      />
      <div className="card-soft p-4">
        <div className="mb-3 font-semibold">{lang === "ar" ? "سجل المراجعة" : "Audit log"}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => exportAudit("json")} disabled={busy !== null}>
            <FileJson className="me-2 h-4 w-4" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportAudit("csv")} disabled={busy !== null}>
            <FileText className="me-2 h-4 w-4" /> CSV
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {lang === "ar"
            ? "تصدير المبيعات والمصاريف والقيود مفصّلة من تقارير كل قسم (نهاية اليوم، تقرير ز، ملخص مالي)."
            : "Export detailed sales, expenses, and journals from each module's reports (Daily, Z-Report, Finance summary)."}
        </p>
      </div>

      <div className="card-soft mt-4 p-4">
        <div className="mb-3 font-semibold">{lang === "ar" ? "جداول قابلة للتصدير لاحقًا" : "Future per-table exports"}</div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXPORTABLES.filter((e) => e.id !== "audit").map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded border bg-card/40 px-3 py-2 text-sm">
              <span>{lang === "ar" ? e.labelAr : e.labelEn}</span>
              <Badge variant="outline" className="text-xs">{lang === "ar" ? "قريبًا" : "Soon"}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 5. Backup ═══════════════════ */
export function ManagerBackup() {
  const { lang } = useApp();
  const call = useApiAction(getReadinessSnapshot);
  const callAccounts = useApiAction(listFinanceAccounts);
  const [snap, setSnap] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([call({}), callAccounts({})]).then(([s, a]) => {
      setSnap(s); setAccounts(a as any[]);
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "النسخ الاحتياطي" : "Backup"}
        subtitle={lang === "ar" ? "حالة البيانات على Supabase Cloud" : "Posture on Supabase Cloud"}
      />
      <div className="card-soft mb-4 p-5">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <div>
            <div className="font-semibold">{lang === "ar" ? "Supabase يدير النسخ التلقائي" : "Supabase manages automatic backups"}</div>
            <div className="text-xs text-muted-foreground">
              {lang === "ar"
                ? "قاعدة البيانات على Supabase تعمل بنسخ يومية مُدارة. لا تحتاج تشغيل سكربتات يدوية."
                : "Your database on Supabase runs managed daily backups. No manual scripts required."}
            </div>
          </div>
        </div>
      </div>

      {snap && (
        <div className="card-soft mb-4 p-4">
          <div className="mb-3 font-semibold">{lang === "ar" ? "حجم البيانات الحالي" : "Current dataset"}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={lang === "ar" ? "طلبات" : "Orders"} value={snap.counts.orders} />
            <Tile label={lang === "ar" ? "فواتير شراء" : "Purchases"} value={snap.counts.purchases} />
            <Tile label={lang === "ar" ? "مصروفات" : "Expenses"} value={snap.counts.expenses} />
            <Tile label={lang === "ar" ? "قيود" : "Journal entries"} value={snap.counts.journals} />
            <Tile label={lang === "ar" ? "موظفون" : "Employees"} value={snap.counts.employees} />
            <Tile label={lang === "ar" ? "سجلات مراجعة" : "Audit logs"} value={snap.counts.auditLogs} />
          </div>
        </div>
      )}

      <div className="card-soft p-4">
        <div className="mb-3 font-semibold">{lang === "ar" ? "حسابات مالية تحت الرصد" : "Finance accounts being tracked"}</div>
        {accounts.length === 0 ? (
          <div className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد حسابات بعد." : "No accounts yet."}</div>
        ) : (
          <ul className="divide-y">
            {accounts.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>{lang === "ar" ? a.name_ar : a.name_en} <Badge variant="outline" className="ms-1 text-xs">{a.type}</Badge></span>
                <span className="font-medium">{Number(a.balance).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ManagerLayout>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
