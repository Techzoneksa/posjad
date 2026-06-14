"use client";

// Sprint C — Suppliers, Purchases, Inventory, Recipes, Adjustments, Waste.
// All screens are backend-wired (no mock data).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApiAction } from "@/lib/api-client";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { ManagerLayout } from "./ManagerScreens";
import { useAdminCatalog } from "@/lib/admin-catalog";
import {
  listSuppliers, upsertSupplier, setSupplierActive, getSupplierProfile,
  listInventory, upsertInventoryItem, setInventoryActive, listItemMovements,
  listPurchases, createPurchase, getPurchase,
  listRecipes, saveRecipe, deleteRecipe,
  listAdjustments, createAdjustment,
  listWaste, createWaste,
} from "@/lib/ops.functions";
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
  AlertTriangle, Plus, Pencil, Trash2, Eye, Search,
  ChefHat, Boxes, Truck, ShoppingBag, SlidersHorizontal, Trash, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Reference data ───────── */
export const INVENTORY_CATEGORIES = [
  { id: "coffee", ar: "بن وحبوب", en: "Coffee beans" },
  { id: "milk", ar: "حليب", en: "Milk" },
  { id: "syrups", ar: "نكهات وصوصات", en: "Syrups & sauces" },
  { id: "bakery", ar: "مخبوزات وكيك", en: "Bakery & cakes" },
  { id: "tea", ar: "شاي", en: "Tea" },
  { id: "drinks", ar: "مشروبات", en: "Drinks" },
  { id: "packaging", ar: "تغليف", en: "Packaging" },
  { id: "other", ar: "أخرى", en: "Other" },
];
export const UNITS = [
  { id: "carton", ar: "كرتون", en: "Carton" },
  { id: "liter", ar: "لتر", en: "Liter" },
  { id: "tin", ar: "تنكة", en: "Tin" },
  { id: "bag", ar: "كيس", en: "Bag" },
  { id: "pack", ar: "علبة", en: "Pack" },
  { id: "piece", ar: "حبة", en: "Piece" },
];
const ADJUSTMENT_REASONS = [
  { id: "physical_count", ar: "جرد فعلي", en: "Physical count" },
  { id: "damage", ar: "تلف", en: "Damage" },
  { id: "waste", ar: "هدر", en: "Waste" },
  { id: "entry_error", ar: "خطأ إدخال", en: "Entry error" },
  { id: "other", ar: "أخرى", en: "Other" },
];
const WASTE_REASONS = [
  { id: "damage", ar: "تلف", en: "Damage" },
  { id: "expired", ar: "انتهاء صلاحية", en: "Expired" },
  { id: "prep_error", ar: "خطأ تحضير", en: "Prep error" },
  { id: "daily_waste", ar: "هدر يومي", en: "Daily waste" },
  { id: "broken_lost", ar: "كسر / فقد", en: "Broken / lost" },
  { id: "other", ar: "أخرى", en: "Other" },
];
function tr(arr: { id: string; ar: string; en: string }[], id: string, lang: "ar" | "en") {
  return arr.find((x) => x.id === id)?.[lang] ?? id;
}

/* ───────── Helpers ───────── */
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
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold tabular-nums">{v || "—"}</div>
    </div>
  );
}
function StatBox({ label, v, tone }: { label: string; v: string; tone?: "warning" | "success" }) {
  return (
    <div className={cn("rounded-lg p-3",
      tone === "warning" ? "bg-warning/10" : tone === "success" ? "bg-success/10" : "bg-muted/40")}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-bold tabular-nums",
        tone === "warning" && "text-warning-foreground",
        tone === "success" && "text-success-foreground")}>{v}</div>
    </div>
  );
}

/* ════════════════════ 1. SUPPLIERS ════════════════════ */
type Supplier = {
  id: string; supplier_name: string; mobile: string | null; representative_name: string | null;
  vat_number: string | null; email: string | null; address: string | null; payment_terms: string | null;
  opening_balance: number; active: boolean; notes: string | null;
};

export function ManagerSuppliers() {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(listSuppliers);
  const save = useApiAction(upsertSupplier);
  const setActive = useApiAction(setSupplierActive);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try { const r: any = await fetch_(); setSuppliers(r.suppliers); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const filtered = suppliers.filter((s) =>
    !q || s.supplier_name.includes(q) || (s.mobile || "").includes(q) || (s.representative_name || "").includes(q));

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "الموردون" : "Suppliers"}
        subtitle={lang === "ar" ? "إدارة بيانات الموردين والأرصدة" : "Manage suppliers and balances"}
        action={
          <Button onClick={() => setCreating(true)} className="gap-1">
            <Plus className="h-4 w-4" /> {lang === "ar" ? "إضافة مورد" : "Add supplier"}
          </Button>
        }
      />

      <div className="card-soft mb-3 flex items-center gap-2 p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "ar" ? "بحث بالاسم أو الجوال…" : "Search…"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "المورد" : "Supplier"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الجوال" : "Mobile"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المندوب" : "Rep"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الرقم الضريبي" : "VAT #"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الشروط" : "Terms"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "افتتاحي" : "Opening"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow cols={8} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && filtered.map((s) => (
              <tr key={s.id} className={cn("border-t", !s.active && "opacity-50")}>
                <td className="p-3 font-medium">{s.supplier_name}</td>
                <td className="p-3 tabular-nums">{s.mobile || "—"}</td>
                <td className="p-3">{s.representative_name || "—"}</td>
                <td className="p-3 text-xs text-muted-foreground tabular-nums">{s.vat_number || "—"}</td>
                <td className="p-3"><Badge variant="outline">{s.payment_terms || "—"}</Badge></td>
                <td className="p-3 text-end tabular-nums">{fmtMoney(Number(s.opening_balance))}</td>
                <td className="p-3">{s.active
                  ? <Badge className="bg-success text-success-foreground hover:bg-success">{lang === "ar" ? "نشط" : "Active"}</Badge>
                  : <Badge variant="secondary">{lang === "ar" ? "موقوف" : "Inactive"}</Badge>}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setProfileId(s.id)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost"
                      onClick={async () => {
                        try { await setActive({ data: { id: s.id, active: !s.active } }); toast.success("✓"); reload(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="p-0"><EmptyState icon={Truck} title={lang === "ar" ? "لا يوجد موردون" : "No suppliers"} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <SupplierDialog
          supplier={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (data) => {
            try {
              await save({ data: { ...data, id: editing?.id } as any });
              toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
              setCreating(false); setEditing(null); reload();
            } catch (e: any) { toast.error(e.message); }
          }}
        />
      )}

      {profileId && <SupplierProfileSheet id={profileId} onClose={() => setProfileId(null)} />}
    </ManagerLayout>
  );
}

function SupplierDialog({ supplier, onClose, onSave }: {
  supplier: Supplier | null; onClose: () => void; onSave: (s: any) => void | Promise<void>;
}) {
  const { lang } = useApp();
  const [f, setF] = useState({
    supplier_name: supplier?.supplier_name || "",
    mobile: supplier?.mobile || "",
    representative_name: supplier?.representative_name || "",
    vat_number: supplier?.vat_number || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
    payment_terms: supplier?.payment_terms || "cash",
    opening_balance: Number(supplier?.opening_balance || 0),
    active: supplier?.active ?? true,
    notes: supplier?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{supplier ? (lang === "ar" ? "تعديل مورد" : "Edit supplier") : (lang === "ar" ? "إضافة مورد" : "Add supplier")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={lang === "ar" ? "اسم المورد" : "Supplier name"}>
            <Input value={f.supplier_name} onChange={(e) => setF({ ...f, supplier_name: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الجوال" : "Mobile"}>
            <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "اسم المندوب" : "Representative"}>
            <Input value={f.representative_name} onChange={(e) => setF({ ...f, representative_name: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الرقم الضريبي" : "VAT number"}>
            <Input value={f.vat_number} onChange={(e) => setF({ ...f, vat_number: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "البريد" : "Email"}>
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "العنوان" : "Address"}>
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "شروط الدفع" : "Payment terms"}>
            <Input value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })}
              placeholder={lang === "ar" ? "نقدي / آجل 15 / آجل 30" : "cash / net15 / net30"} />
          </Field>
          <Field label={lang === "ar" ? "الرصيد الافتتاحي" : "Opening balance"}>
            <Input type="number" value={f.opening_balance}
              onChange={(e) => setF({ ...f, opening_balance: +e.target.value || 0 })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!f.supplier_name || saving}
            onClick={async () => { setSaving(true); try { await onSave(f); } finally { setSaving(false); } }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProfileSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(getSupplierProfile);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setData(await fetch_({ data: { id } })); } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.supplier?.supplier_name || "—"}</SheetTitle>
          <SheetDescription>{data?.supplier?.address || ""}</SheetDescription>
        </SheetHeader>
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> :
        data && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <KV k={lang === "ar" ? "الجوال" : "Mobile"} v={data.supplier.mobile || "—"} />
              <KV k={lang === "ar" ? "المندوب" : "Rep"} v={data.supplier.representative_name || "—"} />
              <KV k={lang === "ar" ? "الرقم الضريبي" : "VAT #"} v={data.supplier.vat_number || "—"} />
              <KV k={lang === "ar" ? "البريد" : "Email"} v={data.supplier.email || "—"} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label={lang === "ar" ? "إجمالي المشتريات" : "Total purchases"} v={fmtMoney(data.totalPurchases)} />
              <StatBox label={lang === "ar" ? "إجمالي المدفوع" : "Total paid"} v={fmtMoney(data.totalPaid)} />
              <StatBox label={lang === "ar" ? "الرصيد المستحق" : "Outstanding"} v={fmtMoney(data.outstanding)} tone="warning" />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">{lang === "ar" ? "كشف الحساب" : "Statement"}</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                      <th className="p-2 text-start">{lang === "ar" ? "المرجع" : "Ref"}</th>
                      <th className="p-2 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
                      <th className="p-2 text-end">{lang === "ar" ? "مدفوع" : "Paid"}</th>
                      <th className="p-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((p: any) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{fmtDate(p.invoice_date, lang)}</td>
                        <td className="p-2 font-mono">{p.supplier_invoice_number || p.id.slice(0, 6)}</td>
                        <td className="p-2 text-end tabular-nums">{fmtMoney(Number(p.total))}</td>
                        <td className="p-2 text-end tabular-nums">{fmtMoney(Number(p.amount_paid))}</td>
                        <td className="p-2"><PurchaseStatusBadge s={p.status} lang={lang} /></td>
                      </tr>
                    ))}
                    {data.invoices.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                        {lang === "ar" ? "لا توجد فواتير" : "No invoices"}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ════════════════════ 2. PURCHASES ════════════════════ */
function PurchaseStatusBadge({ s, lang }: { s: string; lang: "ar" | "en" }) {
  if (s === "paid") return <Badge className="bg-success text-success-foreground hover:bg-success">{lang === "ar" ? "مدفوعة" : "Paid"}</Badge>;
  if (s === "partially_paid") return <Badge className="bg-warning text-warning-foreground hover:bg-warning">{lang === "ar" ? "جزئي" : "Partial"}</Badge>;
  return <Badge variant="destructive">{lang === "ar" ? "غير مدفوعة" : "Unpaid"}</Badge>;
}

export function ManagerPurchases() {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(listPurchases);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try { const r: any = await fetch_(); setRows(r.purchases); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "المشتريات" : "Purchases"}
        subtitle={lang === "ar" ? "فواتير الموردين وحركة الإدخال للمخزون" : "Supplier invoices and stock-in"}
        action={
          <Button onClick={() => setOpenCreate(true)} className="gap-1">
            <Plus className="h-4 w-4" /> {lang === "ar" ? "فاتورة مشتريات" : "New purchase"}
          </Button>
        }
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "المورد" : "Supplier"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الفرعي" : "Subtotal"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "ضريبة" : "VAT"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الدفع" : "Method"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow cols={9} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-mono text-xs">{p.supplier_invoice_number || p.id.slice(0, 6)}</td>
                <td className="p-3 font-medium">{p.supplier?.supplier_name || "—"}</td>
                <td className="p-3 text-xs">{fmtDate(p.invoice_date, lang)}</td>
                <td className="p-3 text-end tabular-nums">{fmtMoney(Number(p.subtotal))}</td>
                <td className="p-3 text-end tabular-nums">{fmtMoney(Number(p.vat_amount))}</td>
                <td className="p-3 text-end tabular-nums font-semibold">{fmtMoney(Number(p.total))}</td>
                <td className="p-3"><Badge variant="outline">{p.payment_method}</Badge></td>
                <td className="p-3"><PurchaseStatusBadge s={p.status} lang={lang} /></td>
                <td className="p-3 text-end">
                  <Button size="sm" variant="ghost" onClick={() => setViewId(p.id)}><Eye className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="p-0"><EmptyState icon={ShoppingBag} title={lang === "ar" ? "لا توجد فواتير شراء" : "No purchase invoices"} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openCreate && <PurchaseDialog onClose={() => setOpenCreate(false)} onSaved={() => { setOpenCreate(false); reload(); }} />}
      {viewId && <PurchaseViewSheet id={viewId} onClose={() => setViewId(null)} />}
    </ManagerLayout>
  );
}

function PurchaseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { lang, fmtMoney } = useApp();
  const fetchSup = useApiAction(listSuppliers);
  const fetchInv = useApiAction(listInventory);
  const save = useApiAction(createPurchase);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"cash" | "bank" | "credit">("cash");
  const [items, setItems] = useState<{ inventory_item_id: string; quantity: number; unit: string; unit_cost: number; vat_amount: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, i]: any = await Promise.all([fetchSup(), fetchInv()]);
        setSuppliers(s.suppliers.filter((x: Supplier) => x.active));
        setInventory(i.items.filter((x: any) => x.active));
      } catch (e: any) { toast.error(e.message); }
    })();
  }, []);

  const addItem = () => {
    if (!inventory.length) return;
    const inv = inventory[0];
    setItems([...items, { inventory_item_id: inv.id, quantity: 1, unit: inv.unit, unit_cost: Number(inv.average_cost) || 0, vat_amount: 0 }]);
  };
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_cost, 0);
  const vat = items.reduce((s, it) => s + (it.vat_amount || 0), 0);
  const total = subtotal + vat;
  const status = method === "credit" ? "unpaid" : "paid";
  const amountPaid = status === "paid" ? total : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "فاتورة مشتريات جديدة" : "New purchase invoice"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={lang === "ar" ? "المورد" : "Supplier"}>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={lang === "ar" ? "رقم فاتورة المورد" : "Supplier invoice #"}>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
            <Field label={lang === "ar" ? "التاريخ" : "Date"}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={lang === "ar" ? "طريقة الدفع" : "Payment method"}>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{lang === "ar" ? "نقدي" : "Cash"}</SelectItem>
                  <SelectItem value="bank">{lang === "ar" ? "بنك" : "Bank"}</SelectItem>
                  <SelectItem value="credit">{lang === "ar" ? "آجل" : "Credit"}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-semibold">{lang === "ar" ? "البنود" : "Items"}</span>
              <Button size="sm" variant="outline" onClick={addItem} disabled={!inventory.length}>
                <Plus className="me-1 h-3 w-3" /> {lang === "ar" ? "إضافة بند" : "Add item"}
              </Button>
            </div>
            <div className="space-y-2 p-2">
              {items.map((it, idx) => {
                const inv = inventory.find((x) => x.id === it.inventory_item_id);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                    <Select value={it.inventory_item_id} onValueChange={(v) => {
                      const next = [...items];
                      const current = next[idx];
                      if (!current) return;
                      const item = inventory.find((x) => x.id === v);
                      next[idx] = { ...current, inventory_item_id: v, unit: item?.unit || current.unit, unit_cost: Number(item?.average_cost) || current.unit_cost };
                      setItems(next);
                    }}>
                      <SelectTrigger className="col-span-4 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{inventory.map((x) => <SelectItem key={x.id} value={x.id}>{x.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="col-span-2 h-8 text-xs" value={it.quantity}
                      onChange={(e) => { const n = [...items]; const current = n[idx]; if (!current) return; n[idx] = { ...current, quantity: +e.target.value || 0 }; setItems(n); }} />
                    <span className="col-span-1 text-center text-xs text-muted-foreground">{tr(UNITS, it.unit, lang)}</span>
                    <Input type="number" className="col-span-2 h-8 text-xs" value={it.unit_cost}
                      onChange={(e) => { const n = [...items]; const current = n[idx]; if (!current) return; n[idx] = { ...current, unit_cost: +e.target.value || 0 }; setItems(n); }} placeholder={lang === "ar" ? "تكلفة" : "Cost"} />
                    <Input type="number" className="col-span-2 h-8 text-xs" value={it.vat_amount}
                      onChange={(e) => { const n = [...items]; const current = n[idx]; if (!current) return; n[idx] = { ...current, vat_amount: +e.target.value || 0 }; setItems(n); }} placeholder="VAT" />
                    <Button size="sm" variant="ghost" className="col-span-1 h-8" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              {items.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">{lang === "ar" ? "أضف بنودًا" : "Add items"}</div>}
            </div>
            <div className="grid grid-cols-3 border-t bg-muted/30 p-2 text-xs">
              <div>{lang === "ar" ? "الفرعي" : "Subtotal"}: <b>{fmtMoney(subtotal)}</b></div>
              <div>{lang === "ar" ? "ضريبة" : "VAT"}: <b>{fmtMoney(vat)}</b></div>
              <div className="text-end">{lang === "ar" ? "الإجمالي" : "Total"}: <b>{fmtMoney(total)}</b></div>
            </div>
          </div>

          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!supplierId || !items.length || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await save({ data: {
                  supplier_id: supplierId,
                  supplier_invoice_number: invoiceNo || null,
                  invoice_date: date,
                  subtotal, vat_amount: vat, total,
                  payment_method: method, status, amount_paid: amountPaid,
                  attachment_url: null, notes: notes || null,
                  items: items.map(it => ({ ...it, line_total: it.quantity * it.unit_cost + (it.vat_amount || 0) })),
                } });
                toast.success(lang === "ar" ? "تم الحفظ والمخزون محدث" : "Saved & stock updated");
                onSaved();
              } catch (e: any) { toast.error(e.message); }
              finally { setSaving(false); }
            }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ الفاتورة" : "Save invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseViewSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(getPurchase);
  const [data, setData] = useState<any>(null);
  useEffect(() => { (async () => { try { setData(await fetch_({ data: { id } })); } catch (e: any) { toast.error(e.message); } })(); }, [id]);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.invoice?.supplier_invoice_number || (lang === "ar" ? "فاتورة" : "Invoice")}</SheetTitle>
          <SheetDescription>{data?.invoice?.supplier?.supplier_name}</SheetDescription>
        </SheetHeader>
        {!data ? <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <KV k={lang === "ar" ? "التاريخ" : "Date"} v={fmtDate(data.invoice.invoice_date, lang)} />
              <KV k={lang === "ar" ? "الدفع" : "Method"} v={data.invoice.payment_method} />
              <KV k={lang === "ar" ? "الإجمالي" : "Total"} v={fmtMoney(Number(data.invoice.total))} />
              <KV k={lang === "ar" ? "مدفوع" : "Paid"} v={fmtMoney(Number(data.invoice.amount_paid))} />
            </div>
            <div className="rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="p-2 text-start">{lang === "ar" ? "الصنف" : "Item"}</th>
                    <th className="p-2 text-end">{lang === "ar" ? "كمية" : "Qty"}</th>
                    <th className="p-2 text-end">{lang === "ar" ? "سعر" : "Cost"}</th>
                    <th className="p-2 text-end">{lang === "ar" ? "إجمالي" : "Total"}</th></tr>
                </thead>
                <tbody>
                  {data.items.map((it: any) => (
                    <tr key={it.id} className="border-t">
                      <td className="p-2">{it.inventory_item?.name_ar || "—"}</td>
                      <td className="p-2 text-end tabular-nums">{Number(it.quantity)} {tr(UNITS, it.unit, lang)}</td>
                      <td className="p-2 text-end tabular-nums">{fmtMoney(Number(it.unit_cost))}</td>
                      <td className="p-2 text-end tabular-nums">{fmtMoney(Number(it.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.invoice.notes && <p className="text-xs text-muted-foreground">{data.invoice.notes}</p>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ════════════════════ 3. INVENTORY ════════════════════ */
type InvItem = {
  id: string; name_ar: string; name_en: string; category: string; unit: string;
  current_quantity: number; minimum_stock_level: number; average_cost: number;
  active: boolean; notes: string | null;
};

function StockBadge({ it, lang }: { it: InvItem; lang: "ar" | "en" }) {
  const q = Number(it.current_quantity), m = Number(it.minimum_stock_level);
  if (q <= 0) return <Badge variant="destructive">{lang === "ar" ? "نفد" : "Out"}</Badge>;
  if (q <= m) return <Badge className="bg-warning text-warning-foreground hover:bg-warning">{lang === "ar" ? "منخفض" : "Low"}</Badge>;
  return <Badge className="bg-success text-success-foreground hover:bg-success">{lang === "ar" ? "متوفر" : "OK"}</Badge>;
}

export function ManagerInventory() {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(listInventory);
  const setActive = useApiAction(setInventoryActive);
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InvItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [movId, setMovId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const reload = async () => {
    setLoading(true);
    try { const r: any = await fetch_(); setItems(r.items); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const filtered = items.filter((it) =>
    (!q || it.name_ar.includes(q) || it.name_en.toLowerCase().includes(q.toLowerCase()))
    && (filterCat === "all" || it.category === filterCat));

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "المخزون" : "Inventory"}
        subtitle={lang === "ar" ? "أصناف المخزون والكميات والحركات" : "Stock items, levels and movements"}
        action={<Button onClick={() => setCreating(true)} className="gap-1"><Plus className="h-4 w-4" /> {lang === "ar" ? "إضافة صنف" : "Add item"}</Button>} />

      <div className="card-soft mb-3 flex flex-wrap items-center gap-2 p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "ar" ? "بحث…" : "Search…"}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الفئات" : "All categories"}</SelectItem>
            {INVENTORY_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.ar : c.en}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "الصنف" : "Item"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الفئة" : "Category"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الكمية" : "Qty"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "حد أدنى" : "Min"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "متوسط التكلفة" : "Avg cost"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow cols={7} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && filtered.map((it) => (
              <tr key={it.id} className={cn("border-t", !it.active && "opacity-50")}>
                <td className="p-3 font-medium">{it.name_ar}</td>
                <td className="p-3 text-xs">{tr(INVENTORY_CATEGORIES, it.category, lang)}</td>
                <td className="p-3 text-end tabular-nums">{Number(it.current_quantity)} {tr(UNITS, it.unit, lang)}</td>
                <td className="p-3 text-end tabular-nums">{Number(it.minimum_stock_level)}</td>
                <td className="p-3 text-end tabular-nums">{fmtMoney(Number(it.average_cost))}</td>
                <td className="p-3"><StockBadge it={it} lang={lang} /></td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setMovId(it.id)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(it)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost"
                      onClick={async () => {
                        try { await setActive({ data: { id: it.id, active: !it.active } }); toast.success("✓"); reload(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-0"><EmptyState icon={Boxes} title={lang === "ar" ? "لا أصناف" : "No items"} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <InventoryDialog item={editing} onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }} />
      )}
      {movId && <MovementsSheet id={movId} onClose={() => setMovId(null)} />}
    </ManagerLayout>
  );
}

function InventoryDialog({ item, onClose, onSaved }: { item: InvItem | null; onClose: () => void; onSaved: () => void }) {
  const { lang } = useApp();
  const save = useApiAction(upsertInventoryItem);
  const [f, setF] = useState({
    name_ar: item?.name_ar || "",
    name_en: item?.name_en || "",
    category: item?.category || "other",
    unit: item?.unit || "piece",
    current_quantity: Number(item?.current_quantity || 0),
    minimum_stock_level: Number(item?.minimum_stock_level || 0),
    average_cost: Number(item?.average_cost || 0),
    active: item?.active ?? true,
    notes: item?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{item ? (lang === "ar" ? "تعديل صنف" : "Edit item") : (lang === "ar" ? "إضافة صنف" : "Add item")}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={lang === "ar" ? "الاسم (عربي)" : "Name (AR)"}>
            <Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"}>
            <Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "الفئة" : "Category"}>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INVENTORY_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lang === "ar" ? c.ar : c.en}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "الوحدة" : "Unit"}>
            <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u.id} value={u.id}>{lang === "ar" ? u.ar : u.en}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "الكمية الحالية" : "Current qty"}>
            <Input type="number" value={f.current_quantity}
              onChange={(e) => setF({ ...f, current_quantity: +e.target.value || 0 })} disabled={!!item} />
          </Field>
          <Field label={lang === "ar" ? "الحد الأدنى" : "Min level"}>
            <Input type="number" value={f.minimum_stock_level}
              onChange={(e) => setF({ ...f, minimum_stock_level: +e.target.value || 0 })} />
          </Field>
          <Field label={lang === "ar" ? "متوسط التكلفة" : "Average cost"}>
            <Input type="number" value={f.average_cost}
              onChange={(e) => setF({ ...f, average_cost: +e.target.value || 0 })} />
          </Field>
        </div>
        <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!f.name_ar || saving}
            onClick={async () => {
              setSaving(true);
              try { await save({ data: { ...f, id: item?.id } as any }); toast.success(lang === "ar" ? "تم الحفظ" : "Saved"); onSaved(); }
              catch (e: any) { toast.error(e.message); }
              finally { setSaving(false); }
            }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementsSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { lang, fmtMoney } = useApp();
  const fetch_ = useApiAction(listItemMovements);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const r: any = await fetch_({ data: { id, limit: 100 } }); setRows(r.movements); }
      catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);
  const typeLabel = (t: string) => {
    if (t === "purchase") return lang === "ar" ? "شراء" : "Purchase";
    if (t === "sale_deduction") return lang === "ar" ? "بيع" : "Sale";
    if (t === "adjustment") return lang === "ar" ? "تسوية" : "Adjustment";
    if (t === "waste") return lang === "ar" ? "هدر" : "Waste";
    return t;
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lang === "ar" ? "حركة المخزون" : "Stock movements"}</SheetTitle>
          <SheetDescription>{lang === "ar" ? "آخر 100 حركة" : "Last 100 movements"}</SheetDescription>
        </SheetHeader>
        <div className="mt-3 rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr><th className="p-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                <th className="p-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "وارد" : "In"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "صادر" : "Out"}</th>
                <th className="p-2 text-end">{lang === "ar" ? "رصيد" : "Balance"}</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
              {!loading && rows.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{fmtDateTime(m.created_at, lang)}</td>
                  <td className="p-2">{typeLabel(m.movement_type)}</td>
                  <td className="p-2 text-end tabular-nums text-success">{Number(m.quantity_in) || ""}</td>
                  <td className="p-2 text-end tabular-nums text-destructive">{Number(m.quantity_out) || ""}</td>
                  <td className="p-2 text-end tabular-nums">{Number(m.balance_after)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{lang === "ar" ? "لا حركات" : "No movements"}</td></tr>}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ════════════════════ 4. RECIPES ════════════════════ */
export function ManagerRecipes() {
  const { lang, fmtMoney } = useApp();
  const { products, loading: catLoading } = useAdminCatalog();
  const fetchInv = useApiAction(listInventory);
  const fetchRec = useApiAction(listRecipes);
  const save = useApiAction(saveRecipe);
  const del = useApiAction(deleteRecipe);
  const [inventory, setInventory] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [i, r]: any = await Promise.all([fetchInv(), fetchRec()]);
      setInventory(i.items);
      setRecipes(r.recipes);
      setIngredients(r.ingredients);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const recipeByProduct = useMemo(() => {
    const map = new Map<string, any>();
    recipes.forEach(r => map.set(r.product_id, r));
    return map;
  }, [recipes]);

  const ingredientsByRecipe = useMemo(() => {
    const map = new Map<string, any[]>();
    ingredients.forEach(g => {
      if (!map.has(g.recipe_id)) map.set(g.recipe_id, []);
      map.get(g.recipe_id)!.push(g);
    });
    return map;
  }, [ingredients]);

  const costFor = (productId: string): number => {
    const r = recipeByProduct.get(productId); if (!r) return 0;
    const ings = ingredientsByRecipe.get(r.id) || [];
    return ings.reduce((s, g) => {
      const inv = inventory.find(x => x.id === g.inventory_item_id);
      return s + (inv ? Number(inv.average_cost) * Number(g.quantity_used) : 0);
    }, 0);
  };

  const editingProduct = editing ? products.find(p => p.id === editing) : null;
  const editingRecipe = editing ? recipeByProduct.get(editing) : null;
  const editingIngs = editingRecipe ? (ingredientsByRecipe.get(editingRecipe.id) || []) : [];

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "وصفات المنتجات" : "Product recipes"}
        subtitle={lang === "ar" ? "ربط المنتجات بأصناف المخزون لخصم آلي عند البيع" : "Link products to inventory for auto-deduction"} />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "المنتج" : "Product"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "تكلفة الوصفة" : "Cost"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "هامش" : "Margin"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الوصفة" : "Recipe"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {(loading || catLoading) && <LoadingRow cols={6} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && !catLoading && products.filter(p => p.active).map((p) => {
              const r = recipeByProduct.get(p.id);
              const cost = costFor(p.id);
              const price = Number(p.price);
              const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">{p.name_ar}</td>
                  <td className="p-3 text-end tabular-nums">{fmtMoney(price)}</td>
                  <td className="p-3 text-end tabular-nums">{r ? fmtMoney(cost) : "—"}</td>
                  <td className="p-3 text-end tabular-nums">{r ? `${margin.toFixed(0)}%` : "—"}</td>
                  <td className="p-3">{r
                    ? <Badge className="bg-success text-success-foreground hover:bg-success">{(ingredientsByRecipe.get(r.id) || []).length} {lang === "ar" ? "مكون" : "ing."}</Badge>
                    : <Badge variant="outline" className="text-warning-foreground">{lang === "ar" ? "بدون وصفة" : "Missing"}</Badge>}</td>
                  <td className="p-3 text-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p.id)}><ChefHat className="h-3.5 w-3.5" /></Button>
                    {r && <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm(lang === "ar" ? "حذف الوصفة؟" : "Delete recipe?")) return;
                      try { await del({ data: { product_id: p.id } }); toast.success("✓"); reload(); }
                      catch (e: any) { toast.error(e.message); }
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && editingProduct && (
        <RecipeDialog
          product={editingProduct}
          initial={editingIngs.map(g => ({ inventory_item_id: g.inventory_item_id, quantity_used: Number(g.quantity_used), unit: g.unit }))}
          inventory={inventory}
          onClose={() => setEditing(null)}
          onSaved={async (ings) => {
            try {
              await save({ data: { product_id: editingProduct.id, active: true, ingredients: ings } });
              toast.success(lang === "ar" ? "تم حفظ الوصفة" : "Recipe saved");
              setEditing(null); reload();
            } catch (e: any) { toast.error(e.message); }
          }}
        />
      )}
    </ManagerLayout>
  );
}

function RecipeDialog({ product, initial, inventory, onClose, onSaved }: {
  product: any; initial: any[]; inventory: any[]; onClose: () => void;
  onSaved: (ings: any[]) => void | Promise<void>;
}) {
  const { lang, fmtMoney } = useApp();
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const addRow = () => {
    if (!inventory.length) return;
    setRows([...rows, { inventory_item_id: inventory[0].id, quantity_used: 1, unit: inventory[0].unit }]);
  };
  const cost = rows.reduce((s, r) => {
    const inv = inventory.find(x => x.id === r.inventory_item_id);
    return s + (inv ? Number(inv.average_cost) * Number(r.quantity_used) : 0);
  }, 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "وصفة" : "Recipe"} — {product.name_ar}</DialogTitle>
          <DialogDescription>{lang === "ar" ? "أضف مكونات الوصفة لخصمها آلياً عند البيع" : "Add ingredients to auto-deduct on sale"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1 items-center">
              <Select value={r.inventory_item_id} onValueChange={(v) => {
                const n = [...rows];
                const inv = inventory.find(x => x.id === v);
                n[idx] = { ...n[idx], inventory_item_id: v, unit: inv?.unit || n[idx].unit };
                setRows(n);
              }}>
                <SelectTrigger className="col-span-6 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{inventory.map(x => <SelectItem key={x.id} value={x.id}>{x.name_ar}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" step="any" className="col-span-3 h-8 text-xs" value={r.quantity_used}
                onChange={(e) => { const n = [...rows]; n[idx].quantity_used = +e.target.value || 0; setRows(n); }} />
              <span className="col-span-2 text-center text-xs text-muted-foreground">{tr(UNITS, r.unit, lang)}</span>
              <Button size="sm" variant="ghost" className="col-span-1 h-8" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="me-1 h-3 w-3" /> {lang === "ar" ? "إضافة مكون" : "Add ingredient"}</Button>
          <div className="rounded bg-muted/40 p-2 text-xs grid grid-cols-3 gap-2">
            <div>{lang === "ar" ? "السعر" : "Price"}: <b>{fmtMoney(Number(product.price))}</b></div>
            <div>{lang === "ar" ? "التكلفة" : "Cost"}: <b>{fmtMoney(cost)}</b></div>
            <div>{lang === "ar" ? "هامش" : "Margin"}: <b>{product.price > 0 ? (((product.price - cost) / product.price) * 100).toFixed(0) : 0}%</b></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={saving}
            onClick={async () => { setSaving(true); try { await onSaved(rows); } finally { setSaving(false); } }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════ 5. ADJUSTMENTS ════════════════════ */
export function ManagerAdjustments() {
  const { lang } = useApp();
  const fetchA = useApiAction(listAdjustments);
  const fetchI = useApiAction(listInventory);
  const save = useApiAction(createAdjustment);
  const [rows, setRows] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [a, i]: any = await Promise.all([fetchA(), fetchI()]);
      setRows(a.adjustments); setInventory(i.items.filter((x: any) => x.active));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "تسويات المخزون" : "Stock adjustments"}
        subtitle={lang === "ar" ? "تصحيح الكميات بعد الجرد" : "Correct quantities after counts"}
        action={<Button onClick={() => setOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> {lang === "ar" ? "تسوية" : "New adjustment"}</Button>} />

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الصنف" : "Item"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "قبل" : "Before"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "بعد" : "After"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الفرق" : "Diff"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "ملاحظات" : "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow cols={7} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3 text-xs">{fmtDateTime(a.created_at, lang)}</td>
                <td className="p-3 font-medium">{a.inventory_item?.name_ar || "—"}</td>
                <td className="p-3 text-end tabular-nums">{Number(a.old_quantity)}</td>
                <td className="p-3 text-end tabular-nums">{Number(a.new_quantity)}</td>
                <td className={cn("p-3 text-end tabular-nums font-semibold", Number(a.difference) > 0 ? "text-success" : "text-destructive")}>
                  {Number(a.difference) > 0 ? "+" : ""}{Number(a.difference)}
                </td>
                <td className="p-3 text-xs">{tr(ADJUSTMENT_REASONS, a.reason, lang)}</td>
                <td className="p-3 text-xs text-muted-foreground">{a.notes || ""}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-0"><EmptyState icon={SlidersHorizontal} title={lang === "ar" ? "لا توجد تسويات" : "No adjustments"} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <AdjustmentDialog inventory={inventory} onClose={() => setOpen(false)}
          onSaved={async (data) => { try { await save({ data }); toast.success(lang === "ar" ? "تمت التسوية" : "Adjusted"); setOpen(false); reload(); } catch (e: any) { toast.error(e.message); } }} />
      )}
    </ManagerLayout>
  );
}

function AdjustmentDialog({ inventory, onClose, onSaved }: {
  inventory: any[]; onClose: () => void;
  onSaved: (d: any) => void | Promise<void>;
}) {
  const { lang } = useApp();
  const [itemId, setItemId] = useState(inventory[0]?.id || "");
  const [newQty, setNewQty] = useState(0);
  const [reason, setReason] = useState("physical_count");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const inv = inventory.find(x => x.id === itemId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lang === "ar" ? "تسوية مخزون" : "Stock adjustment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={lang === "ar" ? "الصنف" : "Item"}>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{inventory.map(x => <SelectItem key={x.id} value={x.id}>{x.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {inv && <div className="text-xs text-muted-foreground">{lang === "ar" ? "الكمية الحالية" : "Current"}: <b>{Number(inv.current_quantity)} {tr(UNITS, inv.unit, lang)}</b></div>}
          <Field label={lang === "ar" ? "الكمية الجديدة" : "New quantity"}>
            <Input type="number" step="any" value={newQty} onChange={(e) => setNewQty(+e.target.value || 0)} />
          </Field>
          <Field label={lang === "ar" ? "السبب" : "Reason"}>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ADJUSTMENT_REASONS.map(r => <SelectItem key={r.id} value={r.id}>{lang === "ar" ? r.ar : r.en}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!itemId || saving}
            onClick={async () => { setSaving(true); try { await onSaved({ inventory_item_id: itemId, new_quantity: newQty, reason, notes: notes || null }); } finally { setSaving(false); } }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════ 6. WASTE ════════════════════ */
export function ManagerWaste() {
  const { lang, fmtMoney } = useApp();
  const fetchW = useApiAction(listWaste);
  const fetchI = useApiAction(listInventory);
  const save = useApiAction(createWaste);
  const [rows, setRows] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { const [w, i]: any = await Promise.all([fetchW(), fetchI()]); setRows(w.records); setInventory(i.items.filter((x: any) => x.active)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const totalCost = rows.reduce((s, r) => s + Number(r.estimated_cost), 0);

  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "الهدر والتالف" : "Waste & damage"}
        subtitle={lang === "ar" ? "تسجيل التالف والهدر اليومي" : "Daily waste and damaged items"}
        action={<Button onClick={() => setOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> {lang === "ar" ? "تسجيل هدر" : "Record waste"}</Button>} />

      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        <StatBox label={lang === "ar" ? "عدد السجلات" : "Records"} v={String(rows.length)} />
        <StatBox label={lang === "ar" ? "إجمالي التكلفة" : "Total cost"} v={fmtMoney(totalCost)} tone="warning" />
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "الصنف" : "Item"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "الكمية" : "Qty"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
              <th className="p-3 text-end">{lang === "ar" ? "التكلفة" : "Cost"}</th>
              <th className="p-3 text-start">{lang === "ar" ? "ملاحظات" : "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow cols={6} text={lang === "ar" ? "جارٍ التحميل…" : "Loading…"} />}
            {!loading && rows.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="p-3 text-xs">{fmtDateTime(w.created_at, lang)}</td>
                <td className="p-3 font-medium">{w.inventory_item?.name_ar || "—"}</td>
                <td className="p-3 text-end tabular-nums">{Number(w.quantity)} {tr(UNITS, w.unit, lang)}</td>
                <td className="p-3 text-xs">{tr(WASTE_REASONS, w.reason, lang)}</td>
                <td className="p-3 text-end tabular-nums">{fmtMoney(Number(w.estimated_cost))}</td>
                <td className="p-3 text-xs text-muted-foreground">{w.notes || ""}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-0"><EmptyState icon={Trash} title={lang === "ar" ? "لا سجلات هدر" : "No waste records"} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <WasteDialog inventory={inventory} onClose={() => setOpen(false)}
          onSaved={async (data) => { try { await save({ data }); toast.success(lang === "ar" ? "تم التسجيل" : "Recorded"); setOpen(false); reload(); } catch (e: any) { toast.error(e.message); } }} />
      )}
    </ManagerLayout>
  );
}

function WasteDialog({ inventory, onClose, onSaved }: {
  inventory: any[]; onClose: () => void;
  onSaved: (d: any) => void | Promise<void>;
}) {
  const { lang } = useApp();
  const [itemId, setItemId] = useState(inventory[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("damage");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const inv = inventory.find(x => x.id === itemId);
  useEffect(() => { if (inv) setCost(qty * Number(inv.average_cost || 0)); }, [itemId, qty]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lang === "ar" ? "تسجيل هدر" : "Record waste"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={lang === "ar" ? "الصنف" : "Item"}>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{inventory.map(x => <SelectItem key={x.id} value={x.id}>{x.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {inv && <div className="text-xs text-muted-foreground">{lang === "ar" ? "المتاح" : "Available"}: <b>{Number(inv.current_quantity)} {tr(UNITS, inv.unit, lang)}</b></div>}
          <Field label={lang === "ar" ? "الكمية" : "Quantity"}>
            <Input type="number" step="any" value={qty} onChange={(e) => setQty(+e.target.value || 0)} />
          </Field>
          <Field label={lang === "ar" ? "السبب" : "Reason"}>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WASTE_REASONS.map(r => <SelectItem key={r.id} value={r.id}>{lang === "ar" ? r.ar : r.en}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "التكلفة التقديرية" : "Estimated cost"}>
            <Input type="number" step="any" value={cost} onChange={(e) => setCost(+e.target.value || 0)} />
          </Field>
          <Field label={lang === "ar" ? "ملاحظات" : "Notes"}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!itemId || qty <= 0 || saving}
            onClick={async () => { setSaving(true); try { await onSaved({ inventory_item_id: itemId, quantity: qty, unit: inv?.unit || "piece", reason, estimated_cost: cost, notes: notes || null }); } finally { setSaving(false); } }}>
            {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════ 7. Dashboard low stock widget ════════════════════ */
export function DashboardLowStock() {
  const { lang } = useApp();
  const fetch_ = useApiAction(listInventory);
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try { const r: any = await fetch_(); setItems(r.items); }
    catch { /* user may not be admin; silently ignore */ }
    finally { setLoading(false); }
  })(); }, []);
  const low = items.filter(i => i.active && Number(i.current_quantity) <= Number(i.minimum_stock_level));
  if (loading) return null;
  return (
    <div className="card-soft p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="h-4 w-4 text-warning-foreground" />
        {lang === "ar" ? "تنبيهات المخزون المنخفض" : "Low stock alerts"}
        <Badge variant="outline" className="ms-2">{low.length}</Badge>
      </div>
      {low.length === 0 ? (
        <p className="text-xs text-muted-foreground">{lang === "ar" ? "كل الأصناف ضمن الحد الآمن" : "All items within safe levels"}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {low.slice(0, 8).map(it => (
            <li key={it.id} className="flex justify-between border-b py-1 last:border-0">
              <span>{it.name_ar}</span>
              <span className="tabular-nums text-destructive">{Number(it.current_quantity)} / {Number(it.minimum_stock_level)} {tr(UNITS, it.unit, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
