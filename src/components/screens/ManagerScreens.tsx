"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAdminCatalog, type AdminCategory, type AdminProduct, type AdminAddonGroup, type AdminAddon } from "@/lib/admin-catalog";
import { useAdminUsers, type UserDTO, type AppRole } from "@/lib/admin-users";
import { useSettings } from "@/lib/settings-context";
import { useApiAction } from "@/lib/api-client";
import { updateRestaurantSettings } from "@/lib/settings.functions";
import { getDashboardSummary } from "@/lib/reports.functions";
import { listCustomersWithStats, getCustomerHistory } from "@/lib/ops.functions";
import { toast } from "sonner";
import { Loader2, Upload, X as XIcon, Link2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type Screen } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PRODUCTS as SEED_PRODUCTS, CATEGORIES as SEED_CATEGORIES, VAT_RATE, type Product,
} from "@/lib/data";
import {
  INITIAL_CASHIERS, INITIAL_MODIFIER_GROUPS, INITIAL_CUSTOMERS,
  INITIAL_SHIFTS, ROLES, PERMISSIONS, COMPANY_LEGAL,
  type UserRecord, type CashierRecord, type ModifierGroupRecord, type ShiftRecord,
  type RoleId,
} from "@/lib/phase2Data";
import {
  LayoutDashboard, Package, Tags, PlusCircle, ClipboardList, BarChart3,
  Settings as Cog, ArrowLeft, TrendingUp, ShoppingCart, Wallet, Undo2, Percent,
  Trophy, Users, UserCog, Receipt, UserCircle2, Search, Plus, Pencil, Trash2,
  Printer, Eye, KeyRound, Lock, Smartphone, CreditCard, DollarSign,
  AlertCircle, Check, X, ChevronRight, PauseCircle, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLowStock } from "./Phase3Screens";

/* ───────────────────────── Sidebar items ───────────────────────── */
import {
  Truck, ShoppingBag, Boxes, ChefHat, SlidersHorizontal, Trash,
  Wallet as WalletIcon, ArrowLeftRight, BookOpen, Banknote, Users as UsersIcon,
  Calculator, BarChart3 as ReportsIcon, Landmark, ShieldCheck,
  Activity as ActivityIcon, ShieldAlert, Bell as BellIcon, Upload as UploadIcon,
  Download as DownloadIcon, Database as DatabaseIcon, KeyRound as KeyIcon,
  ClipboardCheck as ClipCheckIcon, Server as ServerIcon, CheckCircle2,
} from "lucide-react";
type NavItem = { id: Screen; ar: string; en: string; icon: any };
const NAV_MAIN: NavItem[] = [
  { id: "dashboard", ar: "لوحة التحكم", en: "Dashboard", icon: LayoutDashboard },
  { id: "m_orders", ar: "الطلبات والفواتير", en: "Orders & Invoices", icon: Receipt },
  { id: "m_products", ar: "المنتجات", en: "Products", icon: Package },
  { id: "m_categories", ar: "الفئات", en: "Categories", icon: Tags },
  { id: "m_addons", ar: "الإضافات", en: "Addons", icon: PlusCircle },
  { id: "m_users", ar: "المستخدمون والصلاحيات", en: "Users & Roles", icon: UserCog },
  { id: "m_cashiers", ar: "الكاشير", en: "Cashiers", icon: Users },
  { id: "m_shifts", ar: "الورديات", en: "Shifts", icon: ClipboardList },
  { id: "m_customers", ar: "العملاء", en: "Customers", icon: UserCircle2 },
  { id: "m_reports", ar: "التقارير اليومية", en: "Daily Reports", icon: BarChart3 },
  { id: "settings", ar: "الإعدادات", en: "Settings", icon: Cog },
];
const NAV_INVENTORY: NavItem[] = [
  { id: "m_suppliers", ar: "الموردون", en: "Suppliers", icon: Truck },
  { id: "m_purchases", ar: "المشتريات", en: "Purchases", icon: ShoppingBag },
  { id: "m_inventory", ar: "المخزون", en: "Inventory", icon: Boxes },
  { id: "m_recipes", ar: "الوصفات", en: "Recipes", icon: ChefHat },
  { id: "m_adjustments", ar: "تسويات المخزون", en: "Stock Adjustments", icon: SlidersHorizontal },
  { id: "m_waste", ar: "الهدر والتالف", en: "Waste / Damaged", icon: Trash },
];
const NAV_FINANCE: NavItem[] = [
  { id: "m_expenses", ar: "المصاريف", en: "Expenses", icon: WalletIcon },
  { id: "m_banks", ar: "البنوك والصناديق", en: "Banks & Cashboxes", icon: Landmark },
  { id: "m_chart", ar: "دليل الحسابات", en: "Chart of Accounts", icon: BookOpen },
  { id: "m_journal", ar: "القيود المحاسبية", en: "Journal Entries", icon: Calculator },
  { id: "m_supplier_payments", ar: "دفعات الموردين", en: "Supplier Payments", icon: ArrowLeftRight },
  { id: "m_employees", ar: "الموظفون", en: "Employees", icon: UsersIcon },
  { id: "m_payroll", ar: "الرواتب", en: "Salaries / Payroll", icon: Banknote },
  { id: "m_finreports", ar: "التقارير المالية", en: "Financial Reports", icon: ReportsIcon },
];
const NAV_OPS: NavItem[] = [
  { id: "m_readiness", ar: "جاهزية النظام", en: "System Readiness", icon: CheckCircle2 },
  { id: "m_activity", ar: "سجل النشاط", en: "Activity Logs", icon: ActivityIcon },
  { id: "m_audit", ar: "سجل التدقيق", en: "Audit Logs", icon: ShieldAlert },
  { id: "m_notifications", ar: "التنبيهات", en: "Notifications", icon: BellIcon },
  { id: "m_import", ar: "استيراد البيانات", en: "Data Import", icon: UploadIcon },
  { id: "m_export", ar: "تصدير البيانات", en: "Data Export", icon: DownloadIcon },
  { id: "m_backup", ar: "النسخ الاحتياطي", en: "Backup Settings", icon: DatabaseIcon },
  { id: "m_permissions", ar: "مراجعة الصلاحيات", en: "Permissions Review", icon: KeyIcon },
  { id: "m_qa", ar: "قائمة الجودة", en: "QA Checklist", icon: ClipCheckIcon },
  { id: "m_backend", ar: "جاهزية الباك إند", en: "Backend Readiness", icon: ServerIcon },
];
const NAV_ZATCA: NavItem[] = [
  { id: "m_zatca", ar: "زاتكا / الفوترة الإلكترونية", en: "ZATCA / E-Invoicing", icon: ShieldCheck },
];
const NAV_NEXT_PHASE: { ar: string; en: string }[] = [
  { ar: "تكامل زاتكا الفعلي", en: "Real ZATCA integration" },
];

/* ───────────────────────── Layout ───────────────────────── */
export function ManagerLayout({ children }: { children: ReactNode }) {
  const { screen, setScreen, lang, user } = useApp();
  const [globalSearch, setGlobalSearch] = useState("");
  return (
    <div className="min-h-screen bg-background">
      <TopBar
        title={lang === "ar" ? "بوابة الإدارة" : "Manager Portal"}
        right={
          <>
            <div className="hidden items-center gap-2 rounded-lg border bg-card px-3 py-1.5 lg:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={lang === "ar" ? "بحث سريع…" : "Quick search…"}
                className="w-44 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setScreen("pos")} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              {lang === "ar" ? "العودة للكاشير" : "Back to POS"}
            </Button>
          </>
        }
      />
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[240px_1fr]">
        <aside className="card-soft h-fit p-2 lg:sticky lg:top-20">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">
                {lang === "ar" ? COMPANY_LEGAL.legalAr : COMPANY_LEGAL.legalEn}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {lang === "ar" ? COMPANY_LEGAL.branchAr : COMPANY_LEGAL.branchEn}
            </div>
          </div>
          <nav className="space-y-1">
            {NAV_MAIN.map((i) => (
              <button
                key={i.id}
                onClick={() => setScreen(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  screen === i.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <i.icon className="h-4 w-4" />
                <span className="truncate">{lang === "ar" ? i.ar : i.en}</span>
              </button>
            ))}
            <div className="my-2 border-t" />
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "المخزون والمشتريات" : "Inventory & Purchases"}
            </div>
            {NAV_INVENTORY.map((i) => (
              <button
                key={i.id}
                onClick={() => setScreen(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  screen === i.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <i.icon className="h-4 w-4" />
                <span className="truncate">{lang === "ar" ? i.ar : i.en}</span>
              </button>
            ))}
            <div className="my-2 border-t" />
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "المالية والمحاسبة" : "Finance & Accounting"}
            </div>
            {NAV_FINANCE.map((i) => (
              <button
                key={i.id}
                onClick={() => setScreen(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  screen === i.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <i.icon className="h-4 w-4" />
                <span className="truncate">{lang === "ar" ? i.ar : i.en}</span>
              </button>
            ))}
            <div className="my-2 border-t" />
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "العمليات والجاهزية" : "Operations & Readiness"}
            </div>
            {NAV_OPS.map((i) => (
              <button
                key={i.id}
                onClick={() => setScreen(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  screen === i.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <i.icon className="h-4 w-4" />
                <span className="truncate">{lang === "ar" ? i.ar : i.en}</span>
              </button>
            ))}
            <div className="my-2 border-t" />
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "الفوترة الإلكترونية" : "E-Invoicing"}
            </div>
            {NAV_ZATCA.map((i) => (
              <button
                key={i.id}
                onClick={() => setScreen(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  screen === i.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <i.icon className="h-4 w-4" />
                <span className="truncate">{lang === "ar" ? i.ar : i.en}</span>
              </button>
            ))}
            {NAV_NEXT_PHASE.length > 0 && (
              <>
                <div className="my-2 border-t" />
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "ar" ? "قريبًا في المراحل القادمة" : "Coming in next phase"}
                </div>
                {NAV_NEXT_PHASE.map((i) => (
                  <div
                    key={i.en}
                    className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground/70"
                  >
                    <Lock className="h-3 w-3" />
                    <span>{lang === "ar" ? i.ar : i.en}</span>
                  </div>
                ))}
              </>
            )}
          </nav>
          {user && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <div className="text-[10px] uppercase text-muted-foreground">
                {lang === "ar" ? "الجلسة" : "Session"}
              </div>
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {user.role === "manager"
                  ? lang === "ar" ? "مدير" : "Manager"
                  : lang === "ar" ? "كاشير" : "Cashier"}
              </div>
            </div>
          )}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ───────────────────────── Dashboard ───────────────────────── */
export function DashboardScreen() {
  const { lang, fmtMoney, name, setScreen } = useApp();
  const call = useApiAction(getDashboardSummary);
  const [d, setD] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { setScreen("dashboard_login"); return; }
      setD(await call({ data: {} }));
    }
    catch (e: any) {
      const msg = e?.message ?? "Failed to load dashboard";
      if (/unauthorized/i.test(msg)) { setScreen("dashboard_login"); return; }
      setErr(msg);
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (loading) return <ManagerLayout><div className="flex items-center justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></ManagerLayout>;
  if (err) return <ManagerLayout><div className="card-soft p-10 text-center"><div className="mb-3 text-sm text-destructive">{err}</div><Button variant="outline" size="sm" onClick={load}>Retry</Button></div></ManagerLayout>;
  if (!d) return null;

  const cash = d.byMethod.cash ?? 0;
  const mada = d.byMethod.mada ?? 0;
  const apple = d.byMethod.apple_pay ?? 0;
  const visa = (d.byMethod.visa ?? 0) + (d.byMethod.mastercard ?? 0);

  const byTypeUI = d.byOrderType.map((b: any) => ({
    id: b.order_type,
    label: b.order_type === "dine_in" ? (lang === "ar" ? "داخل المحل" : "Dine-in")
      : b.order_type === "takeaway" ? (lang === "ar" ? "سفري" : "Takeaway")
      : (lang === "ar" ? "تطبيقات التوصيل" : "Delivery Apps"),
    val: b.orders,
  }));
  const byType = byTypeUI;
  const maxType = Math.max(1, ...byType.map((b: any) => b.val));
  const top = d.topProducts.map((p: any) => ({ p: { id: p.product_id ?? p.name, name_ar: p.name, name_en: p.name }, q: p.qty }));
  const topName = top[0] ? name(top[0].p) : "—";

  const cards = [
    { l: lang === "ar" ? "مبيعات اليوم" : "Today sales", v: fmtMoney(d.gross), i: TrendingUp, t: "text-primary bg-primary/10" },
    { l: lang === "ar" ? "صافي اليوم" : "Net sales", v: fmtMoney(d.net), i: TrendingUp, t: "text-success bg-success/10" },
    { l: lang === "ar" ? "عدد الطلبات" : "Today orders", v: String(d.ordersCount), i: ShoppingCart, t: "text-foreground bg-accent/40" },
    { l: lang === "ar" ? "متوسط قيمة الطلب" : "Avg. order value", v: fmtMoney(d.aov), i: BarChart3, t: "text-foreground bg-secondary" },
    { l: lang === "ar" ? "نقدي" : "Cash", v: fmtMoney(cash), i: DollarSign, t: "text-success bg-success/15" },
    { l: lang === "ar" ? "مدى" : "Mada", v: fmtMoney(mada), i: CreditCard, t: "text-primary bg-primary/10" },
    { l: "Apple Pay", v: fmtMoney(apple), i: Smartphone, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "Visa / Mastercard" : "Visa / Mastercard", v: fmtMoney(visa), i: CreditCard, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "ضريبة (شاملة)" : "VAT (incl.)", v: fmtMoney(d.vatIncluded), i: Percent, t: "text-foreground bg-warning/15" },
    { l: lang === "ar" ? "الخصومات" : "Discounts today", v: fmtMoney(d.discounts), i: Percent, t: "text-foreground bg-warning/20" },
    { l: lang === "ar" ? "الاسترجاع" : "Refunds today", v: fmtMoney(d.refunds), i: Undo2, t: "text-destructive bg-destructive/10" },
    { l: lang === "ar" ? "ورديات نشطة" : "Active shifts", v: String(d.activeShifts), i: ClipboardList, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "ورديات مغلقة" : "Closed today", v: String(d.closedShiftsToday), i: ClipboardList, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "طلبات معلقة" : "Held orders", v: String(d.heldOrders), i: PauseCircle, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "دفع مركب" : "Mixed payments", v: fmtMoney(d.mixedTotal), i: CreditCard, t: "text-foreground bg-muted" },
    { l: lang === "ar" ? "الأعلى مبيعًا" : "Top product", v: topName, i: Trophy, t: "text-primary bg-primary/10" },
  ];

  const paymentBars = [
    { label: lang === "ar" ? "نقدي" : "Cash", v: cash, color: "bg-success" },
    { label: lang === "ar" ? "مدى" : "Mada", v: mada, color: "bg-primary" },
    { label: "Apple Pay", v: apple, color: "bg-foreground" },
    { label: "Visa / MC", v: visa, color: "bg-accent" },
  ];
  const maxPay = Math.max(1, ...paymentBars.map((p) => p.v));


  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "نظرة عامة" : "Overview"}
        subtitle={lang === "ar" ? "ملخص أداء اليوم" : "Today's performance summary"}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="card-soft p-4">
            <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", c.t)}>
              <c.i className="h-4 w-4" />
            </div>
            <div className="text-[11px] text-muted-foreground">{c.l}</div>
            <div className="mt-1 truncate text-lg font-bold tabular-nums">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold">{lang === "ar" ? "المبيعات حسب طريقة الدفع" : "Sales by payment method"}</h2>
          <div className="space-y-3">
            {paymentBars.map((p) => (
              <div key={p.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{p.label}</span>
                  <span className="tabular-nums text-muted-foreground">{fmtMoney(p.v)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", p.color)} style={{ width: `${(p.v / maxPay) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-5">
          <h2 className="mb-4 text-sm font-bold">{lang === "ar" ? "الطلبات حسب النوع" : "Orders by type"}</h2>
          <div className="space-y-3">
            {byType.map((b: any) => (
              <div key={b.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{b.label}</span>
                  <span className="tabular-nums text-muted-foreground">{b.val}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(b.val / maxType) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 card-soft p-5">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">{lang === "ar" ? "الأكثر مبيعًا" : "Top selling products"}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {top.map(({ p, q }: any, idx: number) => (
            <div key={p.id} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="truncate text-sm font-medium">{name(p)}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">× {q}</div>
            </div>
          ))}
        </div>
      </div>

      <DashboardLowStock />
    </ManagerLayout>
  );
}

/* ───────────────────────── Products ───────────────────────── */
type EditableProduct = Partial<AdminProduct> & { _new?: boolean };

export function ManagerProducts() {
  const { lang, fmtMoney } = useApp();
  const adm = useAdminCatalog();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = adm.products.filter((p) => {
    const matchSearch = !search || p.name_ar.includes(search) || (p.name_en || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "all" || p.category_id === cat;
    return matchSearch && matchCat;
  });

  async function save(p: EditableProduct) {
    if (!p.name_ar) return;
    setSaving(true);
    try {
      const payload: Partial<AdminProduct> = { ...p };
      if (p._new) delete (payload as any).id;
      delete (payload as any)._new;
      await adm.upsertProduct(payload);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر الحفظ" : "Save failed"));
    } finally { setSaving(false); }
  }

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "المنتجات" : "Products"}
        subtitle={lang === "ar" ? "إدارة قائمة JAAD" : "Manage the JAAD menu"}
        action={
          <Button
            onClick={() => setEditing({
              name_ar: "", name_en: "", price: 0, calories: null, size: null,
              category_id: adm.categories[0]?.id ?? null, active: true,
              product_type: "other", tax_rate: 0.15, _new: true,
            })}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            {lang === "ar" ? "إضافة منتج" : "Add product"}
          </Button>
        }
      />

      <div className="card-soft mb-4 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "ابحث باسم المنتج…" : "Search products…"}
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الفئات" : "All categories"}</SelectItem>
            {adm.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.name_ar : c.name_en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="card-soft overflow-x-auto">
        {adm.loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />{lang === "ar" ? "جاري التحميل…" : "Loading…"}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "العربية" : "Arabic"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الإنجليزية" : "English"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الحجم" : "Size"}</th>
              <th className="px-3 py-2 text-start">CAL</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "السعر شامل الضريبة" : "Price (incl. VAT)"}</th>
              <th className="px-3 py-2 text-center">{lang === "ar" ? "نشط" : "Active"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const c = adm.categories.find((x) => x.id === p.category_id);
              return (
                <tr key={p.id} className={cn("border-t hover:bg-muted/30", !p.active && "opacity-50")}>
                  <td className="px-3 py-2 font-medium">{p.name_ar}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.name_en}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c ? (lang === "ar" ? c.name_ar : c.name_en) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.size || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{p.calories || "—"}</td>
                  <td className="px-3 py-2 text-end font-bold tabular-nums">{fmtMoney(Number(p.price))}</td>
                  <td className="px-3 py-2 text-center">
                    {p.active ? <Check className="mx-auto h-4 w-4 text-success" /> : <X className="mx-auto h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!adm.loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد نتائج" : "No results"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductDialog
          product={editing}
          categories={adm.categories}
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel}
        title={lang === "ar" ? "حذف المنتج" : "Delete product"}
        desc={confirmDel ? (lang === "ar" ? `سيتم حذف "${confirmDel.name_ar}"` : `Delete "${confirmDel.name_en}"`) : ""}
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await adm.deleteProduct(confirmDel.id);
            toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
          } catch (e: any) {
            toast.error(e?.message || (lang === "ar" ? "تعذر الحذف" : "Delete failed"));
          }
          setConfirmDel(null);
        }}
      />
    </ManagerLayout>
  );
}

function ProductImagePicker({
  value, onChange,
}: { value: string | null; onChange: (url: string | null) => void }) {
  const { lang } = useApp();
  const [mode, setMode] = useState<"upload" | "url">(value && /^https?:\/\//i.test(value) ? "url" : "upload");
  const [urlDraft, setUrlDraft] = useState(value && /^https?:\/\//i.test(value) ? value : "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(lang === "ar" ? "الملف يجب أن يكون صورة" : "File must be an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(lang === "ar" ? "الحد الأقصى 5 ميجابايت" : "Max size 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      // Long-lived signed URL (~10 years) so it can be stored directly in image_url.
      const { data, error: signErr } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("sign url failed");
      onChange(data.signedUrl);
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر رفع الصورة" : "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {lang === "ar" ? "صورة المنتج" : "Product image"}
        </Label>
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`px-2 py-1 rounded ${mode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Upload className="inline h-3.5 w-3.5 me-1" />
            {lang === "ar" ? "رفع" : "Upload"}
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-2 py-1 rounded ${mode === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Link2 className="inline h-3.5 w-3.5 me-1" />
            {lang === "ar" ? "رابط" : "URL"}
          </button>
        </div>
      </div>

      {value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt=""
            className="h-24 w-24 rounded-md object-cover border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
          />
          <button
            type="button"
            onClick={() => { onChange(null); setUrlDraft(""); }}
            className="absolute -top-2 -end-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow"
            aria-label={lang === "ar" ? "حذف الصورة" : "Remove image"}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {mode === "upload" ? (
        <div>
          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground hover:bg-muted/40">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading
              ? (lang === "ar" ? "جارٍ الرفع..." : "Uploading...")
              : (lang === "ar" ? "اختر صورة (حتى 5 ميجا)" : "Choose image (max 5MB)")}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="https://..."
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const v = urlDraft.trim();
              if (!v) { onChange(null); return; }
              if (!/^https?:\/\//i.test(v)) {
                toast.error(lang === "ar" ? "الرابط يجب أن يبدأ بـ http(s)" : "URL must start with http(s)");
                return;
              }
              onChange(v);
            }}
          >
            {lang === "ar" ? "تطبيق" : "Apply"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProductDialog({
  product, categories, onClose, onSave, saving,
}: { product: EditableProduct; categories: AdminCategory[]; onClose: () => void; onSave: (p: EditableProduct) => void; saving: boolean; }) {
  const { lang } = useApp();
  const [draft, setDraft] = useState<EditableProduct>(product);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product._new ? (lang === "ar" ? "منتج جديد" : "New product") : (lang === "ar" ? "تعديل منتج" : "Edit product")}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "بيانات المنتج تظهر في POS والفواتير" : "Product details show in POS and receipts"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={lang === "ar" ? "الاسم بالعربية" : "Arabic name"}>
            <Input value={draft.name_ar ?? ""} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الاسم بالإنجليزية" : "English name"}>
            <Input value={draft.name_en ?? ""} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الفئة" : "Category"}>
            <Select value={draft.category_id ?? ""} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.name_ar : c.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "النوع" : "Product type"}>
            <Select value={draft.product_type ?? "other"} onValueChange={(v) => setDraft({ ...draft, product_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["hot","cold","tea","cakes","pastry","other"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "السعر شامل الضريبة (ر.س)" : "Price incl. VAT (SAR)"}>
            <Input type="number" step="0.25" min="0" value={Number(draft.price ?? 0)} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
          </Field>
          <Field label={lang === "ar" ? "نسبة الضريبة" : "Tax rate"}>
            <Input type="number" step="0.01" min="0" max="1" value={Number(draft.tax_rate ?? 0.15)} onChange={(e) => setDraft({ ...draft, tax_rate: Number(e.target.value) })} />
          </Field>
          <Field label={lang === "ar" ? "السعرات" : "Calories"}>
            <Input type="number" value={draft.calories ?? ""} onChange={(e) => setDraft({ ...draft, calories: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label={lang === "ar" ? "الحجم" : "Size"}>
            <Input value={draft.size ?? ""} onChange={(e) => setDraft({ ...draft, size: e.target.value || null })} />
          </Field>
          <Field label="SKU">
            <Input value={draft.sku ?? ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value || null })} />
          </Field>
          <div className="sm:col-span-2">
            <ProductImagePicker
              value={draft.image_url ?? null}
              onChange={(url) => setDraft({ ...draft, image_url: url })}
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
            <Label>{lang === "ar" ? "نشط (ظاهر في الكاشير)" : "Active (visible in POS)"}</Label>
            <Switch checked={draft.active !== false} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={() => onSave(draft)} disabled={!draft.name_ar || saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Categories ───────────────────────── */
type CatRow = { id: string; ar: string; en: string; sort: number; active: boolean };
const initialCats: CatRow[] = SEED_CATEGORIES.map((c, i) => ({ ...c, sort: i + 1, active: true }));

export function ManagerCategories() {
  const { lang } = useApp();
  const adm = useAdminCatalog();
  const [editing, setEditing] = useState<Partial<AdminCategory> | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<AdminCategory | null>(null);

  function count(id: string) { return adm.products.filter((p) => p.category_id === id).length; }

  async function save(row: Partial<AdminCategory>) {
    if (!row.name_ar) return;
    setSaving(true);
    try {
      const payload: any = { ...row };
      if (!payload.id) delete payload.id;
      await adm.upsertCategory(payload);
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر الحفظ" : "Save failed"));
    } finally { setSaving(false); }
  }

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الفئات" : "Categories"}
        subtitle={lang === "ar" ? "تنظيم القائمة في الكاشير" : "Organize the POS menu"}
        action={
          <Button
            onClick={() => setEditing({ name_ar: "", name_en: "", sort_order: adm.categories.length + 1, active: true })}
            className="gap-1"
          ><Plus className="h-4 w-4" />{lang === "ar" ? "إضافة فئة" : "Add category"}</Button>
        }
      />

      <div className="card-soft overflow-x-auto">
        {adm.loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />{lang === "ar" ? "جاري التحميل…" : "Loading…"}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start w-12">#</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "العربية" : "Arabic"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الإنجليزية" : "English"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "المنتجات" : "Products"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {[...adm.categories].sort((a, b) => a.sort_order - b.sort_order).map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums">{r.sort_order}</td>
                <td className="px-3 py-2 font-medium">{r.name_ar}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.name_en}</td>
                <td className="px-3 py-2"><Badge variant="secondary">{count(r.id)}</Badge></td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                    {r.active ? (lang === "ar" ? "ظاهرة" : "Visible") : (lang === "ar" ? "مخفية" : "Hidden")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDel(r)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!adm.loading && adm.categories.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد فئات" : "No categories yet"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{lang === "ar" ? "فئة" : "Category"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label={lang === "ar" ? "الاسم بالعربية" : "Arabic name"}>
                <Input value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} />
              </Field>
              <Field label={lang === "ar" ? "الاسم بالإنجليزية" : "English name"}>
                <Input value={editing.name_en ?? ""} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} />
              </Field>
              <Field label={lang === "ar" ? "الترتيب" : "Sort order"}>
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </Field>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>{lang === "ar" ? "ظاهرة في الكاشير" : "Visible in POS"}</Label>
                <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={() => save(editing)} disabled={!editing.name_ar || saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title={lang === "ar" ? "حذف الفئة" : "Delete category"}
        desc={confirmDel ? `${confirmDel.name_ar} / ${confirmDel.name_en}` : ""}
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await adm.deleteCategory(confirmDel.id);
            toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
          } catch (e: any) {
            toast.error(e?.message || (lang === "ar" ? "تعذر الحذف" : "Delete failed"));
          }
          setConfirmDel(null);
        }}
      />
    </ManagerLayout>
  );
}

/* ───────────────────────── Modifier Groups ───────────────────────── */
export function ManagerAddons() {
  const { lang, fmtMoney } = useApp();
  const adm = useAdminCatalog();
  const [editing, setEditing] = useState<{ group: Partial<AdminAddonGroup>; options: Partial<AdminAddon>[]; productIds: string[] } | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminAddonGroup | null>(null);

  const optionsByGroup = useMemo(() => {
    const m: Record<string, AdminAddon[]> = {};
    for (const a of adm.addons) (m[a.group_id] ||= []).push(a);
    return m;
  }, [adm.addons]);

  const productsByGroup = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const l of adm.links) (m[l.group_id] ||= []).push(l.product_id);
    return m;
  }, [adm.links]);

  function openEdit(g?: AdminAddonGroup) {
    if (g) {
      setEditing({
        group: { ...g },
        options: (optionsByGroup[g.id] ?? []).map((o) => ({ ...o })),
        productIds: productsByGroup[g.id] ?? [],
      });
    } else {
      setEditing({
        group: { name_ar: "", name_en: "", required: false, min_select: 0, max_select: 1 },
        options: [],
        productIds: [],
      });
    }
  }

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الإضافات والتعديلات" : "Addons & Modifier Groups"}
        subtitle={lang === "ar" ? "مجموعات الخيارات الإلزامية والاختيارية" : "Required and optional modifier groups"}
        action={
          <Button onClick={() => openEdit()} className="gap-1">
            <Plus className="h-4 w-4" />{lang === "ar" ? "مجموعة جديدة" : "New group"}
          </Button>
        }
      />

      <div className="card-soft overflow-x-auto">
        {adm.loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />{lang === "ar" ? "جاري التحميل…" : "Loading…"}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "العربية" : "Arabic"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الإنجليزية" : "English"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="px-3 py-2 text-start">Min/Max</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "منتجات" : "Products"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الخيارات" : "Options"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {adm.addonGroups.map((g) => {
              const opts = optionsByGroup[g.id] ?? [];
              const linked = productsByGroup[g.id] ?? [];
              return (
                <tr key={g.id} className="border-t align-top hover:bg-muted/30">
                  <td className="px-3 py-3 font-medium">{g.name_ar}</td>
                  <td className="px-3 py-3 text-muted-foreground">{g.name_en}</td>
                  <td className="px-3 py-3">
                    <Badge variant={g.required ? "default" : "secondary"}>
                      {g.required ? (lang === "ar" ? "إلزامية" : "Required") : (lang === "ar" ? "اختيارية" : "Optional")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{g.min_select}/{g.max_select}</td>
                  <td className="px-3 py-3"><Badge variant="secondary">{linked.length}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {opts.slice(0, 4).map((o) => (
                        <span key={o.id} className="rounded-md border px-1.5 py-0.5 text-[10px]">
                          {lang === "ar" ? o.name_ar : o.name_en}
                          {Number(o.price_delta) > 0 && <span className="ms-1 text-primary">+{fmtMoney(Number(o.price_delta))}</span>}
                        </span>
                      ))}
                      {opts.length > 4 && <span className="text-[10px] text-muted-foreground">+{opts.length - 4}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(g)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!adm.loading && adm.addonGroups.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد مجموعات بعد" : "No groups yet"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ModifierGroupDialog
          initial={editing}
          adm={adm}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title={lang === "ar" ? "حذف المجموعة" : "Delete group"}
        desc={confirmDel ? `${confirmDel.name_ar} / ${confirmDel.name_en}` : ""}
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await adm.deleteAddonGroup(confirmDel.id);
            toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
          } catch (e: any) {
            toast.error(e?.message || (lang === "ar" ? "تعذر الحذف" : "Delete failed"));
          }
          setConfirmDel(null);
        }}
      />
    </ManagerLayout>
  );
}

function ModifierGroupDialog({
  initial, adm, onClose,
}: {
  initial: { group: Partial<AdminAddonGroup>; options: Partial<AdminAddon>[]; productIds: string[] };
  adm: ReturnType<typeof useAdminCatalog>;
  onClose: () => void;
}) {
  const { lang } = useApp();
  const [group, setGroup] = useState<Partial<AdminAddonGroup>>(initial.group);
  const [options, setOptions] = useState<Partial<AdminAddon>[]>(initial.options);
  const [productIds, setProductIds] = useState<string[]>(initial.productIds);
  const [saving, setSaving] = useState(false);

  function updateOpt(i: number, patch: Partial<AdminAddon>) {
    setOptions((arr) => arr.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }
  function addOpt() { setOptions((arr) => [...arr, { name_ar: "", name_en: "", price_delta: 0, active: true }]); }
  function delOpt(i: number) { setOptions((arr) => arr.filter((_, idx) => idx !== i)); }
  function toggleProduct(id: string) {
    setProductIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  async function save() {
    if (!group.name_ar) return;
    setSaving(true);
    try {
      // 1) upsert group
      const groupPayload: any = {
        name_ar: group.name_ar,
        name_en: group.name_en || "",
        required: !!group.required,
        min_select: Number(group.min_select ?? 0),
        max_select: Number(group.max_select ?? 1),
      };
      if (group.id) groupPayload.id = group.id;
      await adm.upsertAddonGroup(groupPayload);
      await adm.reload();
      // resolve group id (existing or newly created — match by name_ar fallback)
      const groupId = group.id ?? (adm.addonGroups.find((g) => g.name_ar === group.name_ar)?.id);
      if (!groupId) throw new Error("Group id missing after save");

      // 2) upsert options
      for (const o of options) {
        if (!o.name_ar) continue;
        const payload: any = {
          group_id: groupId,
          name_ar: o.name_ar, name_en: o.name_en || "",
          price_delta: Number(o.price_delta ?? 0),
          active: o.active !== false,
        };
        if (o.id) payload.id = o.id;
        await adm.upsertAddon(payload);
      }
      // 3) delete removed options
      const keptIds = options.filter(o => o.id).map(o => o.id);
      for (const existing of initial.options) {
        if (existing.id && !keptIds.includes(existing.id)) {
          await adm.deleteAddon(existing.id);
        }
      }
      // 4) reconcile product links
      const beforeIds = new Set(initial.productIds);
      const afterIds = new Set(productIds);
      for (const pid of productIds) {
        if (!beforeIds.has(pid)) await adm.linkGroup(pid, groupId);
      }
      for (const pid of initial.productIds) {
        if (!afterIds.has(pid)) await adm.unlinkGroup(pid, groupId);
      }
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر الحفظ" : "Save failed"));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "ar" ? "مجموعة إضافات" : "Modifier group"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={lang === "ar" ? "الاسم بالعربية" : "Arabic name"}>
            <Input value={group.name_ar ?? ""} onChange={(e) => setGroup({ ...group, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الاسم بالإنجليزية" : "English name"}>
            <Input value={group.name_en ?? ""} onChange={(e) => setGroup({ ...group, name_en: e.target.value })} />
          </Field>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>{lang === "ar" ? "إلزامية" : "Required"}</Label>
            <Switch checked={!!group.required} onCheckedChange={(v) => setGroup({ ...group, required: v })} />
          </div>
          <Field label={lang === "ar" ? "أقل / أكثر اختيار" : "Min / Max select"}>
            <div className="flex gap-2">
              <Input type="number" min="0" value={group.min_select ?? 0} onChange={(e) => setGroup({ ...group, min_select: Number(e.target.value) })} />
              <Input type="number" min="1" value={group.max_select ?? 1} onChange={(e) => setGroup({ ...group, max_select: Number(e.target.value) })} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Label className="mb-2 block text-xs">{lang === "ar" ? "المنتجات المرتبطة" : "Linked products"}</Label>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border p-2">
              {adm.products.map((p) => {
                const on = productIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                    className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {lang === "ar" ? p.name_ar : p.name_en}
                  </button>
                );
              })}
              {adm.products.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label>{lang === "ar" ? "الخيارات" : "Options"}</Label>
            <Button size="sm" variant="outline" onClick={addOpt} className="gap-1">
              <Plus className="h-3.5 w-3.5" />{lang === "ar" ? "خيار" : "Option"}
            </Button>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={o.id ?? `new_${i}`} className="grid grid-cols-12 gap-2">
                <Input className="col-span-4" placeholder={lang === "ar" ? "عربي" : "Arabic"} value={o.name_ar ?? ""} onChange={(e) => updateOpt(i, { name_ar: e.target.value })} />
                <Input className="col-span-4" placeholder={lang === "ar" ? "إنجليزي" : "English"} value={o.name_en ?? ""} onChange={(e) => updateOpt(i, { name_en: e.target.value })} />
                <Input className="col-span-3" type="number" step="0.25" placeholder="0.00 SAR" value={Number(o.price_delta ?? 0)} onChange={(e) => updateOpt(i, { price_delta: Number(e.target.value) })} />
                <Button size="icon" variant="ghost" className="col-span-1" onClick={() => delOpt(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {options.length === 0 && <p className="text-center text-xs text-muted-foreground">{lang === "ar" ? "لا توجد خيارات" : "No options yet"}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={save} disabled={!group.name_ar || saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Users & Roles ───────────────────────── */
export function ManagerUsers() {
  const { lang } = useApp();
  const adm = useAdminUsers();
  const [editing, setEditing] = useState<(Partial<UserDTO> & { password?: string }) | null>(null);
  const [resetUser, setResetUser] = useState<UserDTO | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(u: Partial<UserDTO> & { password?: string }) {
    if (!u.full_name || !u.username || !u.role) return;
    setSaving(true);
    try {
      if (!u.id) {
        if (!u.password || u.password.length < 4) {
          toast.error(lang === "ar" ? "كلمة المرور / PIN قصيرة" : "Password / PIN too short");
          setSaving(false); return;
        }
        await adm.createUser({
          fullName: u.full_name as string, username: u.username, role: u.role as AppRole,
          email: u.email || null, password: u.password, active: u.active !== false,
        });
        toast.success(lang === "ar" ? "تم إنشاء المستخدم" : "User created");
      } else {
        await adm.updateUser({
          id: u.id, fullName: u.full_name as string, username: u.username, role: u.role as AppRole,
          email: u.email || null, active: u.active !== false,
        });
        toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      }
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر الحفظ" : "Save failed"));
    } finally { setSaving(false); }
  }

  async function applyReset() {
    if (!resetUser || !newPwd || newPwd !== newPwd2) return;
    setSaving(true);
    try {
      await adm.resetCredentials(resetUser.id, newPwd);
      toast.success(lang === "ar" ? "تم التحديث" : "Updated");
      setResetUser(null); setNewPwd(""); setNewPwd2("");
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "فشل" : "Failed"));
    } finally { setSaving(false); }
  }

  const ROLE_LABELS: Record<AppRole, { ar: string; en: string }> = {
    owner: { ar: "المالك", en: "Owner" },
    manager: { ar: "مدير", en: "Manager" },
    finance: { ar: "محاسب", en: "Finance" },
    cashier: { ar: "كاشير", en: "Cashier" },
  };

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "المستخدمون والصلاحيات" : "Users & Roles"}
        subtitle={lang === "ar" ? "إدارة الحسابات وعرض مصفوفة الصلاحيات" : "Manage accounts and view the permissions matrix"}
        action={
          <Button onClick={() => setEditing({
            full_name: "", username: "", email: "", role: "cashier", active: true, password: "",
          })} className="gap-1"><Plus className="h-4 w-4" />{lang === "ar" ? "إضافة مستخدم" : "Add user"}</Button>
        }
      />

      <div className="card-soft mb-5 overflow-x-auto">
        {adm.loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />{lang === "ar" ? "جاري التحميل…" : "Loading…"}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "البريد / المستخدم" : "Email / Username"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الدور" : "Role"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {adm.users.map((u) => {
              const r = ROLE_LABELS[u.role];
              return (
                <tr key={u.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{u.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email || u.username}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{lang === "ar" ? r.ar : r.en}</Badge></td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      u.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {u.active ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "موقوف" : "Disabled")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(u as any)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setResetUser(u); setNewPwd(""); setNewPwd2(""); }}><KeyRound className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        try { await adm.setActive(u.id, !u.active); }
                        catch (e: any) { toast.error(e?.message || "Failed"); }
                      }}>
                        {u.active ? <X className="h-3.5 w-3.5 text-destructive" /> : <Check className="h-3.5 w-3.5 text-success" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!adm.loading && adm.users.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا يوجد مستخدمون بعد" : "No users yet"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PermissionsMatrix />

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? (lang === "ar" ? "تعديل مستخدم" : "Edit user") : (lang === "ar" ? "مستخدم جديد" : "New user")}</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={lang === "ar" ? "الاسم" : "Name"}>
                <Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </Field>
              <Field label={lang === "ar" ? "اسم المستخدم" : "Username"}>
                <Input value={editing.username ?? ""} onChange={(e) => setEditing({ ...editing, username: e.target.value.trim() })} />
              </Field>
              <Field label={lang === "ar" ? "البريد" : "Email"}>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value.trim() })} placeholder="user@jaad.sa" />
              </Field>
              <Field label={lang === "ar" ? "الدور" : "Role"}>
                <Select value={editing.role ?? "cashier"} onValueChange={(v) => setEditing({ ...editing, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{lang === "ar" ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {!editing.id && (
                <Field label={editing.role === "cashier" ? (lang === "ar" ? "PIN (4-6 أرقام)" : "PIN (4-6 digits)") : (lang === "ar" ? "كلمة المرور" : "Password")}>
                  <Input
                    type="password"
                    inputMode={editing.role === "cashier" ? "numeric" : undefined}
                    value={editing.password ?? ""}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                    placeholder="••••"
                  />
                </Field>
              )}
              <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
                <Label>{lang === "ar" ? "نشط" : "Active"}</Label>
                <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
              <Button
                onClick={() => save(editing)}
                disabled={saving || !editing.full_name || !editing.username || !editing.role || (!editing.id && (!editing.password || editing.password.length < 4))}
              >
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {resetUser && (
        <Dialog open onOpenChange={(o) => !o && setResetUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password"}</DialogTitle>
              <DialogDescription>{lang === "ar" ? `سيتم تحديث بيانات الدخول لـ ${resetUser.full_name}` : `Update credentials for ${resetUser.full_name}`}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Field label={resetUser.role === "cashier" ? (lang === "ar" ? "PIN الجديد" : "New PIN") : (lang === "ar" ? "كلمة المرور الجديدة" : "New password")}>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••" />
              </Field>
              <Field label={lang === "ar" ? "تأكيد" : "Confirm"}>
                <Input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} placeholder="••••" />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetUser(null)} disabled={saving}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={applyReset} disabled={saving || !newPwd || newPwd !== newPwd2 || newPwd.length < 4}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "تطبيق" : "Apply"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ManagerLayout>
  );
}


function PermissionsMatrix() {
  const { lang } = useApp();
  const areas: { k: keyof (typeof PERMISSIONS)["owner"]; ar: string; en: string }[] = [
    { k: "dashboard", ar: "لوحة التحكم", en: "Dashboard" },
    { k: "pos", ar: "الكاشير", en: "POS" },
    { k: "products", ar: "المنتجات", en: "Products" },
    { k: "categories", ar: "الفئات", en: "Categories" },
    { k: "addons", ar: "الإضافات", en: "Addons" },
    { k: "users", ar: "المستخدمون", en: "Users" },
    { k: "cashiers", ar: "الكاشير (الإدارة)", en: "Cashiers" },
    { k: "shifts", ar: "الورديات", en: "Shifts" },
    { k: "orders", ar: "الطلبات", en: "Orders" },
    { k: "customers", ar: "العملاء", en: "Customers" },
    { k: "reports", ar: "التقارير", en: "Reports" },
    { k: "settings", ar: "الإعدادات", en: "Settings" },
    { k: "expenses", ar: "المصاريف (لاحقًا)", en: "Expenses (later)" },
    { k: "accounting", ar: "المحاسبة (لاحقًا)", en: "Accounting (later)" },
    { k: "suppliers", ar: "الموردون (لاحقًا)", en: "Suppliers (later)" },
  ];
  return (
    <div className="card-soft overflow-x-auto">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-bold">{lang === "ar" ? "مصفوفة الصلاحيات" : "Permissions matrix"}</h2>
        <p className="text-xs text-muted-foreground">{lang === "ar" ? "عرض مرجعي — لا يوجد توثيق فعلي حاليًا" : "Reference view — no real auth in this phase"}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start">{lang === "ar" ? "الصلاحية" : "Permission"}</th>
            {ROLES.map((r) => <th key={r.id} className="px-3 py-2 text-center">{lang === "ar" ? r.ar : r.en}</th>)}
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.k} className="border-t">
              <td className="px-3 py-2 font-medium">{lang === "ar" ? a.ar : a.en}</td>
              {ROLES.map((r) => (
                <td key={r.id} className="px-3 py-2 text-center">
                  {PERMISSIONS[r.id][a.k]
                    ? <Check className="mx-auto h-4 w-4 text-success" />
                    : <X className="mx-auto h-4 w-4 text-muted-foreground/50" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Cashiers ───────────────────────── */
export function ManagerCashiers() {
  const { lang, fmtMoney } = useApp();
  const { users, loading: usersLoading } = useAdminUsers();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { listShifts } = await import("@/lib/shifts.functions");
        const { apiFetch } = await import("@/lib/api-client");
        const data = await apiFetch(listShifts, { data: { limit: 500 } });
        if (!cancelled) setShifts(data as any);
      } catch (e) {
        console.error("listShifts failed", e);
      } finally {
        if (!cancelled) setShiftsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cashiers = useMemo(
    () => users.filter((u) => u.role === "cashier" || u.role === "manager" || u.role === "owner"),
    [users],
  );

  const statsByUser = useMemo(() => {
    const map = new Map<string, {
      shiftsCount: number;
      openShift: ShiftRow | null;
      lastShift: ShiftRow | null;
      varianceSum: number;
      expectedSum: number;
    }>();
    for (const s of shifts) {
      const key = s.cashier_id;
      const cur = map.get(key) ?? { shiftsCount: 0, openShift: null, lastShift: null, varianceSum: 0, expectedSum: 0 };
      cur.shiftsCount += 1;
      if (s.status === "open") cur.openShift = s;
      if (!cur.lastShift || new Date(s.opened_at).getTime() > new Date(cur.lastShift.opened_at).getTime()) {
        cur.lastShift = s;
      }
      if (s.variance != null) cur.varianceSum += Number(s.variance);
      if (s.expected_cash != null) cur.expectedSum += Number(s.expected_cash);
      map.set(key, cur);
    }
    return map;
  }, [shifts]);

  const loading = usersLoading || shiftsLoading;
  const totals = useMemo(() => {
    let totalShifts = 0, open = 0, variance = 0;
    statsByUser.forEach((s) => {
      totalShifts += s.shiftsCount;
      if (s.openShift) open += 1;
      variance += s.varianceSum;
    });
    return { totalCashiers: cashiers.length, totalShifts, open, variance };
  }, [statsByUser, cashiers]);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الكاشير" : "Cashiers"}
        subtitle={lang === "ar" ? "بيانات حقيقية من الباك إند: المستخدمون والورديات" : "Live data: users & shifts"}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">{lang === "ar" ? "عدد الكاشير" : "Cashiers"}</div><div className="mt-1 text-2xl font-bold tabular-nums">{totals.totalCashiers}</div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">{lang === "ar" ? "إجمالي الورديات" : "Total shifts"}</div><div className="mt-1 text-2xl font-bold tabular-nums">{totals.totalShifts}</div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">{lang === "ar" ? "ورديات مفتوحة" : "Open shifts"}</div><div className="mt-1 text-2xl font-bold tabular-nums text-success">{totals.open}</div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">{lang === "ar" ? "إجمالي الفروقات" : "Total variance"}</div><div className={cn("mt-1 text-2xl font-bold tabular-nums", totals.variance === 0 ? "text-foreground" : totals.variance > 0 ? "text-warning" : "text-destructive")}>{fmtMoney(totals.variance)}</div></div>
      </div>
      <div className="card-soft overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : cashiers.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا يوجد كاشير. أضف مستخدمين بدور كاشير من شاشة المستخدمين والصلاحيات." : "No cashiers yet. Add users with cashier role from Users & Roles."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "Username"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الدور" : "Role"}</th>
                <th className="px-3 py-2 text-center">{lang === "ar" ? "الورديات" : "Shifts"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "آخر وردية" : "Last shift"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "مجموع الفرق" : "Variance"}</th>
                <th className="px-3 py-2 text-center">{lang === "ar" ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((u) => {
                const s = statsByUser.get(u.id);
                const variance = s?.varianceSum ?? 0;
                return (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{u.full_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{u.username || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        {u.role === "owner" ? (lang === "ar" ? "مالك" : "Owner") :
                         u.role === "manager" ? (lang === "ar" ? "مدير" : "Manager") :
                         u.role === "finance" ? (lang === "ar" ? "مالية" : "Finance") :
                         (lang === "ar" ? "كاشير" : "Cashier")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{s?.shiftsCount ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s?.lastShift ? formatDateTime(new Date(s.lastShift.opened_at).getTime(), lang) : "—"}
                    </td>
                    <td className={cn("px-3 py-2 text-end tabular-nums font-semibold",
                      !s || variance === 0 ? "text-muted-foreground" :
                      variance > 0 ? "text-warning" : "text-destructive")}>
                      {!s || s.shiftsCount === 0 ? "—" : `${variance > 0 ? "+" : ""}${variance.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s?.openShift ? (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          {lang === "ar" ? "وردية مفتوحة" : "On shift"}
                        </span>
                      ) : u.active ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {lang === "ar" ? "نشط" : "Active"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          {lang === "ar" ? "موقوف" : "Disabled"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ManagerLayout>
  );
}

/* ───────────────────────── Shifts ───────────────────────── */
type ShiftRow = {
  id: string;
  cashier_id: string;
  cashier_name: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_float: number | string;
  expected_cash: number | string | null;
  closing_cash: number | string | null;
  variance: number | string | null;
};

export function ManagerShifts() {
  const { lang, fmtMoney } = useApp();
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all");
  const [filterCashier, setFilterCashier] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { listShifts } = await import("@/lib/shifts.functions");
        const { apiFetch } = await import("@/lib/api-client");
        const data = await apiFetch(listShifts, { data: { limit: 100 } });
        if (!cancelled) setRows(data as any);
      } catch (e) {
        console.error("listShifts failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cashiers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cashier_name).filter(Boolean))),
    [rows],
  );
  const filtered = rows.filter((r) =>
    (filterStatus === "all" || r.status === filterStatus) &&
    (filterCashier === "all" || r.cashier_name === filterCashier),
  );

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الورديات" : "Shifts"}
        subtitle={lang === "ar" ? "بيانات حقيقية من الباك إند" : "Live data from backend"}
      />
      <div className="card-soft mb-4 flex flex-wrap gap-3 p-3">
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</SelectItem>
            <SelectItem value="open">{lang === "ar" ? "مفتوحة" : "Open"}</SelectItem>
            <SelectItem value="closed">{lang === "ar" ? "مغلقة" : "Closed"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCashier} onValueChange={setFilterCashier}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الكاشير" : "All cashiers"}</SelectItem>
            {cashiers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="card-soft overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد ورديات بعد. ستظهر هنا بعد فتح الورديات من شاشة الكاشير." : "No shifts yet. They will appear here after cashiers open shifts."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "فتح" : "Open"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "إغلاق" : "Close"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "افتتاحي" : "Opening"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "متوقع" : "Expected"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "فعلي" : "Actual"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "الفرق" : "Variance"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const diff = r.variance == null ? null : Number(r.variance);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.cashier_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(new Date(r.opened_at).getTime(), lang)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.closed_at ? formatDateTime(new Date(r.closed_at).getTime(), lang) : "—"}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(Number(r.opening_float))}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.expected_cash == null ? "—" : fmtMoney(Number(r.expected_cash))}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.closing_cash == null ? "—" : fmtMoney(Number(r.closing_cash))}</td>
                    <td className={cn("px-3 py-2 text-end tabular-nums font-semibold",
                      diff == null ? "text-muted-foreground" :
                      diff === 0 ? "text-success" : diff > 0 ? "text-warning" : "text-destructive")}>
                      {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "open" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                        {r.status === "open" ? (lang === "ar" ? "مفتوحة" : "Open") : (lang === "ar" ? "مغلقة" : "Closed")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ManagerLayout>
  );
}

function SheetRow({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "success" | "warning" | "destructive" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-muted-foreground", strong && "font-semibold text-foreground")}>{k}</span>
      <span className={cn("tabular-nums", strong && "font-bold",
        tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "destructive" && "text-destructive")}>
        {v}
      </span>
    </div>
  );
}

/* ───────────────────────── Orders / Invoices ───────────────────────── */
export function ManagerOrders() {
  const { lang, fmtMoney, completedOrders, name } = useApp();
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [payF, setPayF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [previewOrder, setPreviewOrder] = useState<any>(null);

  const filtered = completedOrders.filter((o) => {
    if (search && !o.number.includes(search) && !o.invoice.includes(search) && !(o.customerPhone || "").includes(search)) return false;
    if (typeF !== "all" && o.orderType !== typeF) return false;
    if (payF !== "all" && o.payment !== payF) return false;
    if (statusF === "refunded" && !o.refunded) return false;
    if (statusF === "completed" && o.refunded) return false;
    return true;
  });

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "الطلبات والفواتير" : "Orders & Invoices"} subtitle={lang === "ar" ? "سجل الطلبات اليومي" : "Daily orders log"} />
      <div className="card-soft mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 flex items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "رقم الطلب / الفاتورة / الجوال…" : "Order # / invoice / phone…"}
            className="flex-1 bg-transparent py-2 text-sm outline-none" />
        </div>
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger><SelectValue placeholder={lang === "ar" ? "النوع" : "Type"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الأنواع" : "All types"}</SelectItem>
            <SelectItem value="dine_in">{lang === "ar" ? "داخل المحل" : "Dine-in"}</SelectItem>
            <SelectItem value="takeaway">{lang === "ar" ? "سفري" : "Takeaway"}</SelectItem>
            <SelectItem value="delivery">{lang === "ar" ? "تطبيقات التوصيل" : "Delivery"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={payF} onValueChange={setPayF}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الدفع" : "All payments"}</SelectItem>
            <SelectItem value="cash">{lang === "ar" ? "نقدي" : "Cash"}</SelectItem>
            <SelectItem value="mada">{lang === "ar" ? "مدى" : "Mada"}</SelectItem>
            <SelectItem value="apple_pay">Apple Pay</SelectItem>
            <SelectItem value="visa">Visa / MC</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</SelectItem>
            <SelectItem value="completed">{lang === "ar" ? "مكتمل" : "Completed"}</SelectItem>
            <SelectItem value="refunded">{lang === "ar" ? "مرتجع" : "Refunded"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الطلب" : "Order #"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الفاتورة" : "Invoice"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الوقت" : "Time"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الكاشير" : "Cashier"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الجوال" : "Phone"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الدفع" : "Payment"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الفرعي" : "Subtotal"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "خصم" : "Discount"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-semibold">{o.number}</td>
                <td className="px-3 py-2 text-muted-foreground">{o.invoice}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(o.time, lang)}</td>
                <td className="px-3 py-2 text-xs">{o.cashier}</td>
                <td className="px-3 py-2 text-xs">{orderTypeLabel(o.orderType, lang)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{o.customerPhone || "—"}</td>
                <td className="px-3 py-2 text-xs">{paymentLabel(o.payment, lang)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(o.subtotal)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(o.discount)}</td>
                <td className="px-3 py-2 text-end font-bold tabular-nums">{fmtMoney(o.total)}</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    o.refunded ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success")}>
                    {o.refunded ? (lang === "ar" ? "مرتجع" : "Refunded") : (lang === "ar" ? "مكتمل" : "Completed")}
                  </span>
                </td>
                <td className="px-3 py-2 text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setPreviewOrder(o)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد طلبات بهذه المعايير" : "No orders match the filters"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!previewOrder} onOpenChange={(o) => !o && setPreviewOrder(null)}>
        <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
          {previewOrder && (
            <>
              <SheetHeader>
                <SheetTitle>{lang === "ar" ? `فاتورة ${previewOrder.invoice}` : `Invoice ${previewOrder.invoice}`}</SheetTitle>
                <SheetDescription>{previewOrder.number} • {formatDateTime(previewOrder.time, lang)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 rounded-lg border bg-card p-4 font-mono text-xs leading-relaxed" dir="ltr">
                <div className="text-center">
                  <div className="font-bold">JAAD — JAAD</div>
                  <div className="text-[10px] opacity-70">{COMPANY_LEGAL.legalAr}</div>
                  <div className="text-[10px] opacity-70">{COMPANY_LEGAL.branchAr}</div>
                  <div className="text-[10px] opacity-70">VAT {COMPANY_LEGAL.vatNumber}</div>
                </div>
                <div className="my-2 border-t border-dashed" />
                <div>Order {previewOrder.number}</div>
                <div>Invoice {previewOrder.invoice}</div>
                <div>Cashier {previewOrder.cashier}</div>
                <div>{orderTypeLabel(previewOrder.orderType, "en")}</div>
                <div className="my-2 border-t border-dashed" />
                {previewOrder.items.map((it: any) => (
                  <div key={it.uid} className="flex justify-between">
                    <span>{it.qty}× {name(it.product)}</span>
                    <span>{(it.product.price * it.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="my-2 border-t border-dashed" />
                <Row k="Subtotal" v={previewOrder.subtotal.toFixed(2)} />
                <Row k="Discount" v={previewOrder.discount.toFixed(2)} />
                <Row k="VAT 15% incl." v={(previewOrder.total - previewOrder.total / (1 + VAT_RATE)).toFixed(2)} />
                <Row k="TOTAL" v={previewOrder.total.toFixed(2)} strong />
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-center py-3">
                  <div className="flex h-20 w-20 items-center justify-center border-2 border-dashed text-[9px] opacity-60">QR Preview · UI only</div>
                </div>
                <div className="text-center text-[9px] opacity-60">Design-phase preview — not a fiscal invoice</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1 gap-1" onClick={() => window.print()}><Printer className="h-4 w-4" />{lang === "ar" ? "إعادة طباعة" : "Reprint"}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ManagerLayout>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-bold")}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

/* ───────────────────────── Customers ───────────────────────── */
export function ManagerCustomers() {
  const { lang, fmtMoney } = useApp();
  const fetchList = useApiAction(listCustomersWithStats);
  const fetchHist = useApiAction(getCustomerHistory);
  const [list, setList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    (async () => {
      try { const r: any = await fetchList(); setList(r.customers); }
      catch (e: any) { toast.error(e.message); }
      finally { setLoadingList(false); }
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    setLoadingHist(true);
    (async () => {
      try { const r: any = await fetchHist({ data: { id: profile.id, limit: 20 } }); setHistory(r.orders); }
      catch (e: any) { toast.error(e.message); }
      finally { setLoadingHist(false); }
    })();
  }, [profile]);

  const filtered = list.filter((c) => !search
    || (c.phone || "").includes(search)
    || (c.name || "").includes(search));

  const fmtRel = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB",
      { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "العملاء" : "Customers"}
        subtitle={lang === "ar" ? "العملاء يُعرّفون برقم الجوال (اختياري)" : "Customers identified by mobile (optional)"} />
      <div className="card-soft mb-4 p-3">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "ابحث برقم الجوال أو الاسم…" : "Search by mobile or name…"}
            className="flex-1 bg-transparent py-2 text-sm outline-none" />
        </div>
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الجوال" : "Mobile"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "عدد الطلبات" : "Orders"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجمالي المشتريات" : "Total purchases"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "آخر طلب" : "Last order"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loadingList && (
              <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                {lang === "ar" ? "جارٍ التحميل…" : "Loading…"}
              </td></tr>
            )}
            {!loadingList && filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-mono">{c.phone || "—"}</td>
                <td className="px-3 py-2">{c.name || "—"}</td>
                <td className="px-3 py-2 text-end tabular-nums">{c.orders_count}</td>
                <td className="px-3 py-2 text-end tabular-nums font-bold">{fmtMoney(Number(c.total_purchases))}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtRel(c.last_order_at)}</td>
                <td className="px-3 py-2 text-end">
                  <Button size="sm" variant="ghost" onClick={() => setProfile(c)} className="gap-1">
                    <ChevronRight className="h-3.5 w-3.5" />{lang === "ar" ? "عرض" : "View"}
                  </Button>
                </td>
              </tr>
            ))}
            {!loadingList && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                {lang === "ar" ? "لا عملاء بعد" : "No customers yet"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!profile} onOpenChange={(o) => !o && setProfile(null)}>
        <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
          {profile && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{profile.phone || profile.name || "—"}</SheetTitle>
                <SheetDescription>{lang === "ar" ? "ملف العميل" : "Customer profile"}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label={lang === "ar" ? "الطلبات" : "Orders"} value={String(profile.orders_count)} />
                <Stat label={lang === "ar" ? "المشتريات" : "Total"} value={fmtMoney(Number(profile.total_purchases))} />
                <Stat label={lang === "ar" ? "متوسط الطلب" : "Avg. order"}
                  value={fmtMoney(profile.orders_count > 0 ? Number(profile.total_purchases) / profile.orders_count : 0)} />
                <Stat label={lang === "ar" ? "آخر طلب" : "Last order"} value={fmtRel(profile.last_order_at)} />
              </div>
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold">{lang === "ar" ? "سجل الطلبات" : "Order history"}</h3>
                {loadingHist ? (
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "جارٍ التحميل…" : "Loading…"}</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "لا طلبات" : "No orders"}</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                        <div>
                          <div className="font-semibold">{o.order_number}</div>
                          <div className="text-xs text-muted-foreground">{fmtRel(o.created_at)}</div>
                        </div>
                        <div className="tabular-nums font-bold">{fmtMoney(Number(o.total_including_vat))}</div>
                      </div>
                    ))}
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


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ───────────────────────── Daily Reports ───────────────────────── */
export function ManagerReports() {
  const { lang, fmtMoney, completedOrders, name } = useApp();
  const [range, setRange] = useState<"today" | "yesterday" | "custom">("today");

  const orders = completedOrders;
  const totalSales = orders.filter((o) => !o.refunded).reduce((s, o) => s + o.total, 0);
  const totalRefunds = orders.filter((o) => o.refunded).reduce((s, o) => s + o.total, 0);
  const totalDiscounts = orders.reduce((s, o) => s + o.discount, 0);

  const byPayment = ["cash", "mada", "apple_pay", "visa"].map((pid) => ({
    id: pid,
    label: paymentLabel(pid, lang),
    val: orders.filter((o) => o.payment === pid && !o.refunded).reduce((s, o) => s + o.total, 0),
    count: orders.filter((o) => o.payment === pid && !o.refunded).length,
  }));
  const byType = ["dine_in", "takeaway", "delivery"].map((tid) => ({
    id: tid, label: orderTypeLabel(tid, lang),
    val: orders.filter((o) => o.orderType === tid && !o.refunded).reduce((s, o) => s + o.total, 0),
    count: orders.filter((o) => o.orderType === tid && !o.refunded).length,
  }));
  const byCashier = Array.from(new Set(orders.map((o) => o.cashier))).map((c) => ({
    name: c, val: orders.filter((o) => o.cashier === c && !o.refunded).reduce((s, o) => s + o.total, 0),
    count: orders.filter((o) => o.cashier === c && !o.refunded).length,
  }));
  const topMap = new Map<string, { p: any; q: number; v: number }>();
  orders.filter((o) => !o.refunded).flatMap((o) => o.items).forEach((i) => {
    const cur = topMap.get(i.product.id) || { p: i.product, q: 0, v: 0 };
    cur.q += i.qty; cur.v += i.product.price * i.qty; topMap.set(i.product.id, cur);
  });
  const top = [...topMap.values()].sort((a, b) => b.q - a.q).slice(0, 8);

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "التقارير اليومية" : "Daily Reports"} subtitle={lang === "ar" ? "ملخصات سريعة — التقارير المالية المتقدمة في مرحلة لاحقة" : "Quick summaries — advanced finance reports later"} />
      <div className="card-soft mb-4 flex flex-wrap items-center gap-2 p-3">
        {[
          { id: "today", ar: "اليوم", en: "Today" },
          { id: "yesterday", ar: "أمس", en: "Yesterday" },
          { id: "custom", ar: "تاريخ مخصص", en: "Custom" },
        ].map((r) => (
          <button key={r.id} onClick={() => setRange(r.id as any)}
            className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium",
              range === r.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {lang === "ar" ? r.ar : r.en}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label={lang === "ar" ? "إجمالي المبيعات" : "Gross sales"} value={fmtMoney(totalSales)} tone="text-primary bg-primary/10" />
        <SummaryCard label={lang === "ar" ? "عدد الطلبات" : "Orders"} value={String(orders.filter((o) => !o.refunded).length)} tone="text-foreground bg-accent/40" />
        <SummaryCard label={lang === "ar" ? "الخصومات" : "Discounts"} value={fmtMoney(totalDiscounts)} tone="text-foreground bg-warning/20" />
        <SummaryCard label={lang === "ar" ? "الاسترجاع" : "Refunds"} value={fmtMoney(totalRefunds)} tone="text-destructive bg-destructive/10" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportTable
          title={lang === "ar" ? "حسب طريقة الدفع" : "By payment method"}
          rows={byPayment.map((b) => [b.label, String(b.count), fmtMoney(b.val)])}
          headers={[lang === "ar" ? "الطريقة" : "Method", lang === "ar" ? "العدد" : "Count", lang === "ar" ? "المبلغ" : "Amount"]}
        />
        <ReportTable
          title={lang === "ar" ? "حسب نوع الطلب" : "By order type"}
          rows={byType.map((b) => [b.label, String(b.count), fmtMoney(b.val)])}
          headers={[lang === "ar" ? "النوع" : "Type", lang === "ar" ? "العدد" : "Count", lang === "ar" ? "المبلغ" : "Amount"]}
        />
        <ReportTable
          title={lang === "ar" ? "حسب الكاشير" : "By cashier"}
          rows={byCashier.map((b) => [b.name, String(b.count), fmtMoney(b.val)])}
          headers={[lang === "ar" ? "الكاشير" : "Cashier", lang === "ar" ? "العدد" : "Count", lang === "ar" ? "المبلغ" : "Amount"]}
        />
        <ReportTable
          title={lang === "ar" ? "الأكثر مبيعًا" : "Top selling"}
          rows={top.map((t) => [name(t.p), String(t.q), fmtMoney(t.v)])}
          headers={[lang === "ar" ? "المنتج" : "Product", lang === "ar" ? "الكمية" : "Qty", lang === "ar" ? "الإيراد" : "Revenue"]}
        />
      </div>
    </ManagerLayout>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card-soft p-4">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", tone)}>
        <BarChart3 className="h-4 w-4" />
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
function ReportTable({ title, rows, headers }: { title: string; rows: string[][]; headers: string[] }) {
  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b px-4 py-3 text-sm font-bold">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>{headers.map((h, i) => (
            <th key={i} className={cn("px-3 py-2", i === headers.length - 1 ? "text-end" : "text-start")}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2", j === 0 ? "font-medium" : "tabular-nums", j === r.length - 1 && "text-end font-bold")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Settings (tabs) ───────────────────────── */
export function SettingsScreen() {
  const { lang, setLang, theme, setTheme, t } = useApp();
  const { settings, loading, reload, applyLocal } = useSettings();
  const update = useApiAction(updateRestaurantSettings);
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<typeof settings>) {
    setSaving(true);
    try {
      const next = await update({ data: patch as any });
      applyLocal(next as any);
      await reload();
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    } catch (e: any) {
      toast.error(e?.message || (lang === "ar" ? "تعذر الحفظ" : "Save failed"));
    } finally { setSaving(false); }
  }

  return (
    <ManagerLayout>
      <PageHeader title={t.settings} subtitle={lang === "ar" ? "إعدادات النظام" : "System configuration"} />
      {loading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />{lang === "ar" ? "جاري التحميل…" : "Loading…"}
        </div>
      )}

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="company">{lang === "ar" ? "الشركة" : "Company"}</TabsTrigger>
          <TabsTrigger value="receipt">{lang === "ar" ? "الفاتورة" : "Receipt"}</TabsTrigger>
          <TabsTrigger value="tax">{lang === "ar" ? "الضريبة" : "Tax"}</TabsTrigger>
          <TabsTrigger value="zatca">{lang === "ar" ? "زاتكا" : "ZATCA"}</TabsTrigger>
          <TabsTrigger value="appearance">{lang === "ar" ? "المظهر" : "Appearance"}</TabsTrigger>
        </TabsList>

        <TabsContent value="zatca">
          <ZatcaSettingsPanel />
        </TabsContent>

        <TabsContent value="company">
          <CompanyTab settings={settings} onSave={save} saving={saving} lang={lang} />
        </TabsContent>

        <TabsContent value="receipt">
          <ReceiptTab settings={settings} onSave={save} saving={saving} lang={lang} />
        </TabsContent>

        <TabsContent value="tax">
          <TaxTab settings={settings} onSave={save} saving={saving} lang={lang} />
        </TabsContent>

        <TabsContent value="appearance">
          <div className="card-soft mt-3 grid gap-4 p-5 md:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs">{lang === "ar" ? "الشعار" : "Logo"}</Label>
              <div className="flex items-center justify-center rounded-lg border bg-card p-6">
                <span className="text-sm font-bold">JAAD — JAAD</span>
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs">{lang === "ar" ? "اللغة الافتراضية" : "Default language"}</Label>
              <Select value={lang} onValueChange={(v: any) => setLang(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block text-xs">{lang === "ar" ? "المظهر" : "Theme"}</Label>
              <div className="flex gap-2">
                <button onClick={() => setTheme("light")}
                  className={cn("flex-1 rounded-lg border p-4 text-sm", theme === "light" && "border-primary ring-2 ring-primary/40")}>
                  {t.light}
                </button>
                <button onClick={() => setTheme("dark")}
                  className={cn("flex-1 rounded-lg border p-4 text-sm", theme === "dark" && "border-primary ring-2 ring-primary/40")}>
                  {t.dark}
                </button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ManagerLayout>
  );
}

function CompanyTab({ settings, onSave, saving, lang }: { settings: any; onSave: (p: any) => void; saving: boolean; lang: "ar" | "en" }) {
  const [s, setS] = useState({
    legal_name_ar: settings.legal_name_ar ?? "",
    legal_name_en: settings.legal_name_en ?? "",
    brand_name_ar: settings.brand_name_ar ?? "",
    brand_name_en: settings.brand_name_en ?? "",
    branch_ar: settings.branch_ar ?? "",
    branch_en: settings.branch_en ?? "",
    vat_number: settings.vat_number ?? "",
    commercial_registration: settings.commercial_registration ?? "",
    national_address: settings.national_address ?? "",
  });
  useEffect(() => {
    setS({
      legal_name_ar: settings.legal_name_ar ?? "",
      legal_name_en: settings.legal_name_en ?? "",
      brand_name_ar: settings.brand_name_ar ?? "",
      brand_name_en: settings.brand_name_en ?? "",
      branch_ar: settings.branch_ar ?? "",
      branch_en: settings.branch_en ?? "",
      vat_number: settings.vat_number ?? "",
      commercial_registration: settings.commercial_registration ?? "",
      national_address: settings.national_address ?? "",
    });
  }, [settings]);
  return (
    <div className="card-soft mt-3 grid gap-4 p-5 md:grid-cols-2">
      <Field label={lang === "ar" ? "اسم الشركة (عربي)" : "Legal name (Arabic)"}>
        <Input value={s.legal_name_ar} onChange={(e) => setS({ ...s, legal_name_ar: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "اسم الشركة (إنجليزي)" : "Legal name (English)"}>
        <Input value={s.legal_name_en} onChange={(e) => setS({ ...s, legal_name_en: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "العلامة التجارية (عربي)" : "Brand (Arabic)"}>
        <Input value={s.brand_name_ar} onChange={(e) => setS({ ...s, brand_name_ar: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "العلامة التجارية (إنجليزي)" : "Brand (English)"}>
        <Input value={s.brand_name_en} onChange={(e) => setS({ ...s, brand_name_en: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "الفرع (عربي)" : "Branch (Arabic)"}>
        <Input value={s.branch_ar} onChange={(e) => setS({ ...s, branch_ar: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "الفرع (إنجليزي)" : "Branch (English)"}>
        <Input value={s.branch_en} onChange={(e) => setS({ ...s, branch_en: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "الرقم الضريبي" : "VAT number"}>
        <Input value={s.vat_number} onChange={(e) => setS({ ...s, vat_number: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "السجل التجاري" : "Commercial registration"}>
        <Input value={s.commercial_registration} onChange={(e) => setS({ ...s, commercial_registration: e.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label={lang === "ar" ? "العنوان الوطني" : "National address"}>
          <Input value={s.national_address} onChange={(e) => setS({ ...s, national_address: e.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={() => onSave(s)} disabled={saving}>
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ReceiptTab({ settings, onSave, saving, lang }: { settings: any; onSave: (p: any) => void; saving: boolean; lang: "ar" | "en" }) {
  const [s, setS] = useState({
    receipt_width: settings.receipt_width ?? "80mm",
    printer_type: settings.printer_type ?? "USB",
    print_method: settings.print_method ?? "browser",
    print_copies: settings.print_copies ?? 2,
    footer_note_ar: settings.footer_note_ar ?? "",
    footer_note_en: settings.footer_note_en ?? "",
  });
  useEffect(() => {
    setS({
      receipt_width: settings.receipt_width ?? "80mm",
      printer_type: settings.printer_type ?? "USB",
      print_method: settings.print_method ?? "browser",
      print_copies: settings.print_copies ?? 2,
      footer_note_ar: settings.footer_note_ar ?? "",
      footer_note_en: settings.footer_note_en ?? "",
    });
  }, [settings]);
  return (
    <div className="card-soft mt-3 grid gap-4 p-5 md:grid-cols-2">
      <Field label={lang === "ar" ? "عرض الفاتورة" : "Receipt width"}>
        <Select value={s.receipt_width} onValueChange={(v) => setS({ ...s, receipt_width: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="58mm">58mm</SelectItem>
            <SelectItem value="80mm">80mm</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={lang === "ar" ? "نوع الطابعة" : "Printer type"}>
        <Select value={s.printer_type} onValueChange={(v) => setS({ ...s, printer_type: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="USB">USB</SelectItem>
            <SelectItem value="Bluetooth">Bluetooth</SelectItem>
            <SelectItem value="Network">Network</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={lang === "ar" ? "طريقة الطباعة" : "Print method"}>
        <Select value={s.print_method} onValueChange={(v) => setS({ ...s, print_method: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="browser">{lang === "ar" ? "طباعة المتصفح" : "Browser print"}</SelectItem>
            <SelectItem value="driver">{lang === "ar" ? "تعريف الطابعة" : "Printer driver"}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={lang === "ar" ? "عدد النسخ" : "Print copies"}>
        <Input type="number" min="1" max="5" value={s.print_copies} onChange={(e) => setS({ ...s, print_copies: Number(e.target.value) })} />
      </Field>
      <Field label={lang === "ar" ? "تذييل الفاتورة (عربي)" : "Receipt footer (Arabic)"}>
        <Input value={s.footer_note_ar} onChange={(e) => setS({ ...s, footer_note_ar: e.target.value })} />
      </Field>
      <Field label={lang === "ar" ? "تذييل الفاتورة (إنجليزي)" : "Receipt footer (English)"}>
        <Input value={s.footer_note_en} onChange={(e) => setS({ ...s, footer_note_en: e.target.value })} />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={() => onSave(s)} disabled={saving}>
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function TaxTab({ settings, onSave, saving, lang }: { settings: any; onSave: (p: any) => void; saving: boolean; lang: "ar" | "en" }) {
  const [vatRate, setVatRate] = useState<number>(Number((settings.vat_rate ?? 0.15) * 100));
  const [includes, setIncludes] = useState<boolean>(settings.prices_include_vat !== false);
  useEffect(() => {
    setVatRate(Number((settings.vat_rate ?? 0.15) * 100));
    setIncludes(settings.prices_include_vat !== false);
  }, [settings]);
  return (
    <div className="card-soft mt-3 grid gap-4 p-5 md:grid-cols-2">
      <Field label={lang === "ar" ? "نسبة ضريبة القيمة المضافة (%)" : "VAT rate (%)"}>
        <Input type="number" min="0" max="100" step="0.5" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
      </Field>
      <ToggleRow label={lang === "ar" ? "الأسعار شاملة الضريبة" : "Prices include VAT"} value={includes} onChange={setIncludes} />
      <div className="md:col-span-2 rounded-lg border bg-warning/10 p-3 text-xs">
        <AlertCircle className="me-2 inline h-3.5 w-3.5 text-warning" />
        {lang === "ar" ? "حالياً نظام VAT-inclusive 15% — تكامل ZATCA الفعلي في مرحلة لاحقة." : "Currently VAT-inclusive at 15% — real ZATCA integration comes in a later phase."}
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={() => onSave({ vat_rate: vatRate / 100, prices_include_vat: includes })} disabled={saving}>
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{lang === "ar" ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <span className="h-8 w-8 rounded-md border" style={{ background: color }} />
      <span className="text-xs">{label}</span>
    </div>
  );
}
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label>{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function ConfirmDialog({ open, title, desc, onCancel, onConfirm }: { open: boolean; title: string; desc: string; onCancel: () => void; onConfirm: () => void }) {
  const { lang } = useApp();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button variant="destructive" onClick={onConfirm}>{lang === "ar" ? "حذف" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatRel(ts: number, lang: "ar" | "en") {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return lang === "ar" ? "الآن" : "just now";
  if (m < 60) return lang === "ar" ? `قبل ${m} د` : `${m}m ago`;
  if (h < 24) return lang === "ar" ? `قبل ${h} س` : `${h}h ago`;
  return lang === "ar" ? `قبل ${d} ي` : `${d}d ago`;
}
function formatDateTime(ts: number, lang: "ar" | "en") {
  const d = new Date(ts);
  return d.toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
}
function orderTypeLabel(id: string, lang: "ar" | "en") {
  const map: Record<string, [string, string]> = {
    dine_in: ["داخل المحل", "Dine-in"],
    takeaway: ["سفري", "Takeaway"],
    delivery: ["تطبيقات التوصيل", "Delivery"],
  };
  return (map[id] || [id, id])[lang === "ar" ? 0 : 1];
}
function paymentLabel(id: string, lang: "ar" | "en") {
  const map: Record<string, [string, string]> = {
    cash: ["نقدي", "Cash"],
    mada: ["مدى / شبكة", "Mada / Network"],
    apple_pay: ["Apple Pay", "Apple Pay"],
    visa: ["Visa / Mastercard", "Visa / Mastercard"],
    mixed: ["دفع مختلط", "Mixed"],
  };
  return (map[id] || [id, id])[lang === "ar" ? 0 : 1];
}

/* ───────────────────────── ZATCA settings panel ───────────────────────── */
import { usePhase5 } from "@/lib/phase5Store";
import { useQuery } from "@tanstack/react-query";
import { getZatcaConnectionStatus } from "@/lib/zatca.functions";

function ZatcaSettingsPanel() {
  const { lang, setScreen } = useApp();
  const { tax } = usePhase5();
  const taxComplete = !!(tax.vatNumber && tax.crNumber && tax.nationalAddress);
  const fetchStatus = useApiAction(getZatcaConnectionStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["zatca-connection-status"],
    queryFn: () => fetchStatus({ data: undefined as any }),
    refetchOnWindowFocus: false,
  });

  const Row = ({ k, v, tone }: { k: string; v: string; tone?: "good" | "warn" | "bad" }) => (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn(
        "font-medium",
        tone === "good" && "text-emerald-600",
        tone === "warn" && "text-amber-600",
        tone === "bad" && "text-rose-600",
      )}>{v}</span>
    </div>
  );

  const connected = !!status?.connected;
  const env = status?.environment ?? "—";
  const onboarding = status?.onboardingStatus ?? "—";
  const csidRef = status?.csidReference ?? "—";
  const prodCsidAt = status?.productionCsidAt
    ? new Date(status.productionCsidAt as any).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "—";
  const prodCsidPresent = !!status?.productionCsidPresent;

  const statusLabel = isLoading
    ? (lang === "ar" ? "جارٍ التحميل…" : "Loading…")
    : connected
      ? (lang === "ar" ? "متصل — إنتاج" : "Connected — Production")
      : (lang === "ar" ? "غير متصل" : "Not connected");
  const statusTone: "good" | "warn" = connected ? "good" : "warn";

  return (
    <div className="mt-3 space-y-3">
      <div className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        connected
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/10",
      )}>
        {connected
          ? <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
          : <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />}
        <div>
          {connected
            ? (lang === "ar"
                ? "حالة الفوترة الإلكترونية: متصل — جاهز للإنتاج."
                : "E-invoicing status: Connected — Production ready.")
            : (lang === "ar"
                ? "حالة الفوترة الإلكترونية: غير متصل بعد."
                : "E-invoicing status: Not connected yet.")}
        </div>
      </div>
      <div className="card-soft p-4">
        <Row k={lang === "ar" ? "الحالة" : "Status"} v={statusLabel} tone={statusTone} />
        <Row k={lang === "ar" ? "البيئة" : "Environment"} v={String(env)} tone={env === "production" ? "good" : "warn"} />
        <Row k={lang === "ar" ? "التهيئة" : "Onboarding"} v={String(onboarding)} tone={onboarding === "onboarded" ? "good" : "warn"} />
        <Row k={lang === "ar" ? "مرجع CSID" : "CSID reference"} v={String(csidRef)} />
        <Row k={lang === "ar" ? "تاريخ إصدار CSID للإنتاج" : "Production CSID issued at"} v={prodCsidAt} />
        <Row k={lang === "ar" ? "CSID للإنتاج" : "Production CSID"} v={prodCsidPresent ? (lang === "ar" ? "موجود" : "Present") : (lang === "ar" ? "مفقود" : "Missing")} tone={prodCsidPresent ? "good" : "bad"} />
        <Row k={lang === "ar" ? "الملف الضريبي" : "Company tax profile"}
          v={taxComplete ? (lang === "ar" ? "مكتمل" : "Complete") : (lang === "ar" ? "ناقص" : "Incomplete")}
          tone={taxComplete ? "good" : "warn"} />
        <Row k={lang === "ar" ? "قائمة الانتظار" : "Queue"} v={lang === "ar" ? "معطلة" : "Disabled"} />
        <Row k={lang === "ar" ? "الإبلاغ التلقائي" : "Auto-reporting"} v={lang === "ar" ? "معطل" : "Disabled"} />
        <Row k={lang === "ar" ? "الإرسال اليدوي" : "Manual Submit"} v={lang === "ar" ? "مفعل للمالك/المدير فقط" : "Enabled (owner/manager only)"} tone="good" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="gap-2" onClick={() => setScreen("m_zatca")}>
          <ShieldCheck className="h-4 w-4" /> {lang === "ar" ? "فتح إعداد زاتكا" : "Open ZATCA setup"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setScreen("m_zatca")}>
          <ClipboardList className="h-4 w-4" /> {lang === "ar" ? "عرض قائمة الالتزام" : "View checklist"}
        </Button>
        <Button variant="ghost" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {lang === "ar" ? "تصدير ملخص الإعداد" : "Export setup summary"}
        </Button>
      </div>
    </div>
  );
}
