"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { ManagerLayout } from "./ManagerScreens";
import { usePhase5 } from "@/lib/phase5Store";
import {
  INVOICE_STATUS_LABELS, CHECKLIST_STATUS_LABELS, SAMPLE_PREVIEW_INVOICE,
  SAMPLE_XML_PREVIEW, type ZatcaInvoiceStatus, type ChecklistStatus,
} from "@/lib/phase5Data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldCheck, AlertTriangle, FileText, QrCode, Smartphone, CloudOff,
  RefreshCw, ListChecks, Building2, FileWarning, Wifi, WifiOff, Eye, Save,
  ClipboardCheck, ChevronRight, Check, X, Info, Code2, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────── tiny helpers (local to this file) ───────────── */
function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5">
      <div className="min-w-0 pr-2">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
function StatusPill({ status }: { status: ZatcaInvoiceStatus }) {
  const { lang } = useApp();
  const meta = INVOICE_STATUS_LABELS[status];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", meta.tone)}>
    {lang === "ar" ? meta.ar : meta.en}
  </span>;
}
function ChecklistPill({ status }: { status: ChecklistStatus }) {
  const { lang } = useApp();
  const meta = CHECKLIST_STATUS_LABELS[status];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", meta.tone)}>
    {lang === "ar" ? meta.ar : meta.en}
  </span>;
}
function PrepAlert() {
  const { lang } = useApp();
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1">
        <div className="font-semibold">
          {lang === "ar" ? "وضع تجهيز الواجهات فقط — Not Connected Yet" : "UI preparation mode only — Not Connected Yet"}
        </div>
        <div className="text-muted-foreground">
          {lang === "ar"
            ? "هذه الصفحة مخصصة لتجهيز واجهات الفوترة الإلكترونية فقط. الربط الحقيقي مع زاتكا سيتم في مرحلة التكامل الخلفي."
            : "This page is for e-invoicing UI preparation only. Real ZATCA integration will be handled in the backend integration phase."}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                    MAIN ENTRY: <ManagerZatca/>               */
/* ============================================================ */
export function ManagerZatca() {
  const { lang } = useApp();
  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "زاتكا والفوترة الإلكترونية" : "ZATCA & E-Invoicing"}
        subtitle={lang === "ar" ? "تجهيز واجهات الفوترة الإلكترونية — UI Only" : "E-Invoicing preparation — UI Only"}
        action={<Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> {lang === "ar" ? "جاهز للتكامل" : "Ready for integration"}</Badge>}
      />
      <PrepAlert />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">{lang === "ar" ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="tax">{lang === "ar" ? "المعلومات الضريبية" : "Company Tax Info"}</TabsTrigger>
          <TabsTrigger value="device">{lang === "ar" ? "تسجيل الجهاز" : "Device Onboarding"}</TabsTrigger>
          <TabsTrigger value="template">{lang === "ar" ? "قالب الفاتورة" : "Invoice Template"}</TabsTrigger>
          <TabsTrigger value="preview">{lang === "ar" ? "معاينة الفاتورة" : "E-Invoice Preview"}</TabsTrigger>
          <TabsTrigger value="queue">{lang === "ar" ? "قائمة المزامنة" : "Sync Queue"}</TabsTrigger>
          <TabsTrigger value="failed">{lang === "ar" ? "الفواتير الفاشلة" : "Failed Invoices"}</TabsTrigger>
          <TabsTrigger value="offline">{lang === "ar" ? "وضع عدم الاتصال" : "Offline Mode"}</TabsTrigger>
          <TabsTrigger value="checklist">{lang === "ar" ? "قائمة الالتزام" : "Compliance Checklist"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="tax"><TaxInfoTab /></TabsContent>
        <TabsContent value="device"><DeviceTab /></TabsContent>
        <TabsContent value="template"><TemplateTab /></TabsContent>
        <TabsContent value="preview"><PreviewTab /></TabsContent>
        <TabsContent value="queue"><QueueTab /></TabsContent>
        <TabsContent value="failed"><FailedTab /></TabsContent>
        <TabsContent value="offline"><OfflineTab /></TabsContent>
        <TabsContent value="checklist"><ChecklistTab /></TabsContent>
      </Tabs>
    </ManagerLayout>
  );
}

/* ───────────────────────── 1. OVERVIEW ───────────────────────── */
function OverviewCard({ icon: Icon, title, status, tone = "neutral", note }: {
  icon: any; title: string; status: string; tone?: "good" | "warn" | "bad" | "neutral"; note?: string;
}) {
  const toneCls = tone === "good" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "bad" ? "text-rose-600 dark:text-rose-400"
    : "text-muted-foreground";
  return (
    <div className="card-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="rounded-lg bg-muted p-2"><Icon className="h-4 w-4" /></div>
        <div className="font-semibold">{title}</div>
      </div>
      <div className={cn("text-sm font-medium", toneCls)}>{status}</div>
      {note && <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
function OverviewTab() {
  const { lang } = useApp();
  const { tax, device, syncQueue, failed, offline } = usePhase5();
  const taxComplete = !!(tax.vatNumber && tax.crNumber && tax.nationalAddress);
  const pending = syncQueue.filter((s) => s.status === "pending_sync" || s.status === "offline_queued").length;
  const failedCount = failed.filter((f) => f.status !== "resolved").length;

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <OverviewCard icon={Building2}
        title={lang === "ar" ? "الملف الضريبي للشركة" : "Company tax profile"}
        tone={taxComplete ? "good" : "warn"}
        status={taxComplete
          ? (lang === "ar" ? "تم اكتمال البيانات" : "Tax info completed")
          : (lang === "ar" ? "بيانات مطلوبة ناقصة" : "Required fields missing")}
      />
      <OverviewCard icon={Smartphone}
        title={lang === "ar" ? "حالة جهاز POS" : "POS device status"}
        tone={device.status === "ready_for_backend" ? "good" : "warn"}
        status={device.status === "not_connected" ? (lang === "ar" ? "غير متصل بعد" : "Not connected yet")
          : device.status === "draft_saved" ? (lang === "ar" ? "مسودة محفوظة" : "Draft saved")
          : device.status === "otp_entered" ? (lang === "ar" ? "تم إدخال OTP" : "OTP entered")
          : (lang === "ar" ? "جاهز للتكامل الخلفي" : "Ready for backend integration")}
      />
      <OverviewCard icon={FileText}
        title={lang === "ar" ? "قالب الفاتورة" : "Invoice template status"}
        tone="good"
        status={lang === "ar" ? "القالب جاهز" : "Invoice template ready"}
      />
      <OverviewCard icon={QrCode}
        title={lang === "ar" ? "معاينة QR" : "QR preview status"}
        tone="neutral"
        status={lang === "ar" ? "معاينة فقط — UI" : "UI preview only"}
        note={lang === "ar" ? "التوليد الإنتاجي سيتم خلال التكامل" : "Production generation in backend phase"}
      />
      <OverviewCard icon={CloudOff}
        title={lang === "ar" ? "قائمة عدم الاتصال" : "Offline queue status"}
        tone={offline.enabled ? "good" : "warn"}
        status={offline.enabled
          ? (lang === "ar" ? "مفعّل — يحفظ محليًا" : "Enabled — storing locally")
          : (lang === "ar" ? "غير مفعّل" : "Disabled")}
        note={`${pending} ${lang === "ar" ? "فاتورة بالانتظار" : "pending invoices"}`}
      />
      <OverviewCard icon={FileWarning}
        title={lang === "ar" ? "الفواتير الفاشلة" : "Failed invoices"}
        tone={failedCount === 0 ? "good" : "bad"}
        status={`${failedCount} ${lang === "ar" ? "بحاجة لمراجعة" : "need review"}`}
      />
      <div className="card-soft p-4 md:col-span-2 xl:col-span-3">
        <div className="mb-2 flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <div className="font-semibold">{lang === "ar" ? "جاهزية التكامل" : "Ready-for-integration checklist"}</div>
        </div>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "افتح تبويب قائمة الالتزام لمراجعة جميع البنود المطلوبة قبل بدء التكامل."
            : "Open the Compliance Checklist tab to review every item required before backend integration begins."}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── 2. COMPANY TAX INFO ───────────────────────── */
function TaxInfoTab() {
  const { lang } = useApp();
  const { tax, setTax } = usePhase5();
  const [local, setLocal] = useState(tax);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const missing = useMemo(() => {
    const m: string[] = [];
    if (!local.vatNumber) m.push(lang === "ar" ? "الرقم الضريبي" : "VAT number");
    if (!local.crNumber) m.push(lang === "ar" ? "السجل التجاري" : "CR number");
    if (!local.nationalAddress) m.push(lang === "ar" ? "العنوان الوطني" : "National address");
    return m;
  }, [local, lang]);

  const save = () => { setTax(local); setSavedAt(new Date().toLocaleTimeString()); };

  return (
    <div className="mt-3 space-y-3">
      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <div>
            <div className="font-medium">{lang === "ar" ? "بيانات مطلوبة ناقصة:" : "Missing required fields:"}</div>
            <div className="text-muted-foreground">{missing.join("، ")}</div>
          </div>
        </div>
      )}

      <div className="card-soft grid gap-4 p-5 md:grid-cols-2">
        <Field label={lang === "ar" ? "اسم الشركة القانوني (عربي)" : "Legal company name (AR)"}>
          <Input value={local.legalNameAr} onChange={(e) => setLocal({ ...local, legalNameAr: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "Legal name (English)" : "Legal name (English)"}>
          <Input value={local.legalNameEn} onChange={(e) => setLocal({ ...local, legalNameEn: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "العلامة التجارية (عربي)" : "Brand (AR)"}>
          <Input value={local.brandAr} onChange={(e) => setLocal({ ...local, brandAr: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "Brand (EN)" : "Brand (EN)"}>
          <Input value={local.brandEn} onChange={(e) => setLocal({ ...local, brandEn: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "الرقم الضريبي" : "VAT number"} hint={lang === "ar" ? "15 رقمًا" : "15 digits"}>
          <Input value={local.vatNumber} onChange={(e) => setLocal({ ...local, vatNumber: e.target.value })} placeholder="3xxxxxxxxxxxxx3" />
        </Field>
        <Field label={lang === "ar" ? "السجل التجاري" : "Commercial registration"}>
          <Input value={local.crNumber} onChange={(e) => setLocal({ ...local, crNumber: e.target.value })} placeholder="10xxxxxxxx" />
        </Field>
        <Field label={lang === "ar" ? "العنوان الوطني" : "National address"}>
          <Input value={local.nationalAddress} onChange={(e) => setLocal({ ...local, nationalAddress: e.target.value })} placeholder={lang === "ar" ? "الرمز البريدي + الحي" : "Postal code + district"} />
        </Field>
        <Field label={lang === "ar" ? "المدينة" : "City"}>
          <Input value={local.city} onChange={(e) => setLocal({ ...local, city: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "الحي" : "District"}>
          <Input value={local.district} onChange={(e) => setLocal({ ...local, district: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "اسم الفرع" : "Branch name"}>
          <Input value={local.branchName} onChange={(e) => setLocal({ ...local, branchName: e.target.value })} />
        </Field>
        <Field label={lang === "ar" ? "نسبة الضريبة" : "VAT rate"}>
          <Input type="number" value={local.vatRate} onChange={(e) => setLocal({ ...local, vatRate: Number(e.target.value) })} />
        </Field>
        <Field label={lang === "ar" ? "نوع الفاتورة" : "Invoice type"}>
          <Input disabled value={lang === "ar" ? local.invoiceTypeAr : local.invoiceTypeEn} />
        </Field>
        <div className="md:col-span-2">
          <ToggleRow label={lang === "ar" ? "الأسعار تشمل ضريبة القيمة المضافة" : "Prices include VAT"}
            value={local.pricesIncludeVat} onChange={(v) => setLocal({ ...local, pricesIncludeVat: v })} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {savedAt ? (lang === "ar" ? `تم الحفظ محليًا في ${savedAt}` : `Saved locally at ${savedAt}`) : (lang === "ar" ? "لم يتم الحفظ بعد" : "Not saved yet")}
        </div>
        <Button onClick={save} className="gap-2"><Save className="h-4 w-4" />{lang === "ar" ? "حفظ الملف الضريبي" : "Save tax profile"}</Button>
      </div>
    </div>
  );
}

/* ───────────────────────── 3. DEVICE ONBOARDING ───────────────────────── */
function DeviceTab() {
  const { lang } = useApp();
  const { device, setDevice } = usePhase5();
  const [local, setLocal] = useState(device);

  const STEPS_AR = [
    "إدخال بيانات الشركة الضريبية",
    "تجهيز بيانات الجهاز",
    "إدخال OTP من بوابة فاتورة",
    "إنشاء CSID (Backend)",
    "الاتصال بزاتكا (Backend)",
    "الجهاز جاهز",
  ];
  const STEPS_EN = [
    "Enter company tax info",
    "Generate or prepare device data",
    "Enter OTP",
    "Backend creates CSID",
    "Backend connects to ZATCA",
    "Device ready",
  ];
  const steps = lang === "ar" ? STEPS_AR : STEPS_EN;

  const activeStep = local.status === "not_connected" ? 0
    : local.status === "draft_saved" ? 1
    : local.status === "otp_entered" ? 2
    : 3;

  const saveDraft = () => setDevice({ ...local, status: "draft_saved" });
  const submitOtp = () => {
    if (!local.otp) return;
    setDevice({ ...local, status: "otp_entered" });
  };
  const markReady = () => setDevice({ ...local, status: "ready_for_backend" });
  const reset = () => { const r = { ...local, otp: "", status: "not_connected" as const }; setLocal(r); setDevice(r); };

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="card-soft grid gap-4 p-5 md:grid-cols-2">
          <Field label={lang === "ar" ? "اسم الجهاز" : "Device name"}>
            <Input value={local.deviceName} onChange={(e) => setLocal({ ...local, deviceName: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "نوع الجهاز" : "Device type"}>
            <Select value={local.deviceType} onValueChange={(v: any) => setLocal({ ...local, deviceType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Web POS">Web POS</SelectItem>
                <SelectItem value="Tablet POS">Tablet POS</SelectItem>
                <SelectItem value="Desktop POS">Desktop POS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={lang === "ar" ? "الفرع" : "Branch"}>
            <Input value={local.branch} onChange={(e) => setLocal({ ...local, branch: e.target.value })} />
          </Field>
          <Field label={lang === "ar" ? "البيئة" : "Environment"}>
            <Select value={local.environment} onValueChange={(v: any) => setLocal({ ...local, environment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simulation">{lang === "ar" ? "محاكاة" : "Simulation"}</SelectItem>
                <SelectItem value="production_placeholder">{lang === "ar" ? "إنتاج (placeholder)" : "Production (placeholder)"}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={lang === "ar" ? "OTP من بوابة فاتورة" : "OTP from FATOORA portal"}
            hint={lang === "ar" ? "الرمز محدود الوقت — أدخله أثناء التسجيل." : "OTP is time-sensitive and must be entered during onboarding."}
          >
            <Input value={local.otp} onChange={(e) => setLocal({ ...local, otp: e.target.value })} placeholder="123456" />
          </Field>
          <Field label={lang === "ar" ? "الحالة" : "Onboarding status"}>
            <Input disabled value={
              local.status === "not_connected" ? (lang === "ar" ? "غير متصل بعد" : "Not connected yet")
              : local.status === "draft_saved" ? (lang === "ar" ? "مسودة محفوظة" : "Draft saved")
              : local.status === "otp_entered" ? (lang === "ar" ? "تم إدخال OTP" : "OTP entered")
              : (lang === "ar" ? "جاهز للتكامل الخلفي" : "Ready for backend integration")
            } />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveDraft} variant="secondary" className="gap-2"><Save className="h-4 w-4" />{lang === "ar" ? "حفظ المسودة" : "Save draft"}</Button>
          <Button onClick={submitOtp} variant="outline" className="gap-2" disabled={!local.otp}><Check className="h-4 w-4" />{lang === "ar" ? "إرسال OTP" : "Submit OTP"}</Button>
          <Button onClick={markReady} className="gap-2"><ShieldCheck className="h-4 w-4" />{lang === "ar" ? "جاهز للتكامل" : "Mark as ready for integration"}</Button>
          <Button onClick={reset} variant="ghost" className="gap-2"><X className="h-4 w-4" />{lang === "ar" ? "إعادة الضبط" : "Reset draft"}</Button>
        </div>
      </div>

      <div className="card-soft p-4">
        <div className="mb-3 text-sm font-semibold">{lang === "ar" ? "خطوات التسجيل" : "Onboarding stepper"}</div>
        <ol className="space-y-2">
          {steps.map((s, idx) => {
            const isBackend = idx >= 3;
            const isDone = idx < activeStep;
            const isActive = idx === activeStep;
            return (
              <li key={idx} className={cn(
                "flex items-start gap-3 rounded-lg border p-2.5 text-sm",
                isActive && "border-primary bg-primary/5",
                isBackend && "opacity-80",
              )}>
                <div className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "bg-muted",
                )}>{isDone ? <Check className="h-3 w-3" /> : idx + 1}</div>
                <div className="min-w-0">
                  <div>{s}</div>
                  {isBackend && <div className="text-[10px] text-muted-foreground">{lang === "ar" ? "خطوة تكامل خلفي — غير مُنفّذة" : "Backend integration step — not implemented"}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ───────────────────────── 4. INVOICE TEMPLATE ───────────────────────── */
function TemplateTab() {
  const { lang } = useApp();
  const { template, setTemplate } = usePhase5();
  const [local, setLocal] = useState(template);
  const set = <K extends keyof typeof local>(k: K, v: (typeof local)[K]) => setLocal({ ...local, [k]: v });

  return (
    <div className="mt-3 space-y-3">
      <div className="card-soft grid gap-4 p-5 md:grid-cols-3">
        <Field label={lang === "ar" ? "عرض الفاتورة" : "Receipt width"}>
          <Select value={local.width} onValueChange={(v: any) => set("width", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="58mm">58mm</SelectItem>
              <SelectItem value="80mm">80mm</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={lang === "ar" ? "نوع الطابعة" : "Printer type"}>
          <Select value={local.printer} onValueChange={(v: any) => set("printer", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USB">USB</SelectItem>
              <SelectItem value="Bluetooth">Bluetooth</SelectItem>
              <SelectItem value="Network">Network</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={lang === "ar" ? "طريقة الطباعة" : "Print method"}>
          <Select value={local.method} onValueChange={(v: any) => set("method", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="browser">{lang === "ar" ? "طباعة المتصفح" : "Browser print"}</SelectItem>
              <SelectItem value="driver">{lang === "ar" ? "تعريف الطابعة" : "Printer driver"}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={lang === "ar" ? "عدد النسخ" : "Print copies"}>
          <Input type="number" value={local.copies} onChange={(e) => set("copies", Number(e.target.value))} />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {([
          ["showLegal",         lang === "ar" ? "إظهار الاسم القانوني للشركة" : "Show company legal name"],
          ["showBrand",         lang === "ar" ? "إظهار العلامة التجارية" : "Show brand name"],
          ["showBranchAddress", lang === "ar" ? "إظهار عنوان الفرع" : "Show branch address"],
          ["showVatNumber",     lang === "ar" ? "إظهار الرقم الضريبي" : "Show VAT number"],
          ["showCrNumber",      lang === "ar" ? "إظهار السجل التجاري" : "Show CR number"],
          ["showInvoiceNumber", lang === "ar" ? "إظهار رقم الفاتورة" : "Show invoice number"],
          ["showOrderNumber",   lang === "ar" ? "إظهار رقم الطلب" : "Show order number"],
          ["showCashier",       lang === "ar" ? "إظهار اسم الكاشير" : "Show cashier name"],
          ["showPaymentMethod", lang === "ar" ? "إظهار طريقة الدفع" : "Show payment method"],
          ["showVatBreakdown",  lang === "ar" ? "إظهار تفاصيل الضريبة" : "Show VAT included details"],
          ["showQrPreview",     lang === "ar" ? "إظهار معاينة QR" : "Show QR preview"],
          ["showInvoiceStatus", lang === "ar" ? "إظهار حالة الفاتورة" : "Show invoice status"],
        ] as const).map(([k, label]) => (
          <ToggleRow key={k} label={label} value={local[k] as boolean} onChange={(v) => set(k, v as any)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card p-3">
        <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />{lang === "ar" ? "معاينة الطباعة" : "Print preview"}</Button>
        <Button onClick={() => setTemplate(local)} className="gap-2"><Save className="h-4 w-4" />{lang === "ar" ? "حفظ القالب" : "Save template"}</Button>
      </div>
    </div>
  );
}

/* ───────────────────────── 5. E-INVOICE PREVIEW ───────────────────────── */
function PreviewTab() {
  const { lang } = useApp();
  const { tax, template } = usePhase5();
  const inv = SAMPLE_PREVIEW_INVOICE;
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = (subtotal / (1 + tax.vatRate / 100)) * (tax.vatRate / 100);
  const total = subtotal - inv.discount;

  return (
    <div className="mt-3">
      <Tabs defaultValue="receipt" className="w-full">
        <TabsList>
          <TabsTrigger value="receipt">{lang === "ar" ? "معاينة الفاتورة" : "Receipt Preview"}</TabsTrigger>
          <TabsTrigger value="data">{lang === "ar" ? "ملخص البيانات" : "Data Summary"}</TabsTrigger>
          <TabsTrigger value="xml">{lang === "ar" ? "معاينة XML" : "XML Preview UI"}</TabsTrigger>
        </TabsList>

        <TabsContent value="receipt">
          <div className="mt-3 flex justify-center">
            <div className="card-soft mx-auto w-full max-w-[360px] p-4 font-mono text-[12px] leading-relaxed">
              {template.showLegal && <div className="text-center font-bold">{tax.legalNameAr}</div>}
              {template.showBrand && <div className="text-center">{tax.brandAr} / {tax.brandEn}</div>}
              {template.showBranchAddress && <div className="text-center text-[11px] text-muted-foreground">{tax.city} — {tax.district}</div>}
              <div className="my-1 text-center font-semibold">{tax.invoiceTypeAr} / {tax.invoiceTypeEn}</div>
              <div className="my-2 border-y border-dashed py-1 text-[11px]">
                {template.showInvoiceNumber && <div className="flex justify-between"><span>رقم الفاتورة</span><span>{inv.invoiceNumber}</span></div>}
                {template.showOrderNumber && <div className="flex justify-between"><span>رقم الطلب</span><span>{inv.orderNumber}</span></div>}
                <div className="flex justify-between"><span>التاريخ</span><span>{inv.date}</span></div>
                {template.showCashier && <div className="flex justify-between"><span>الكاشير</span><span>{inv.cashier}</span></div>}
                {template.showPaymentMethod && <div className="flex justify-between"><span>طريقة الدفع</span><span>{inv.paymentMethod}</span></div>}
                {template.showVatNumber && <div className="flex justify-between"><span>الرقم الضريبي</span><span>{tax.vatNumber || "—"}</span></div>}
              </div>
              <div className="space-y-0.5 text-[11px]">
                {inv.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{it.qty}× {it.ar}</span>
                    <span>{(it.qty * it.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-0.5 border-t border-dashed pt-2 text-[11px]">
                <div className="flex justify-between"><span>المجموع الفرعي</span><span>{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>الخصم</span><span>{inv.discount.toFixed(2)}</span></div>
                {template.showVatBreakdown && <div className="flex justify-between"><span>ضريبة القيمة المضافة {tax.vatRate}%</span><span>{vat.toFixed(2)}</span></div>}
                <div className="flex justify-between text-sm font-bold"><span>الإجمالي شامل الضريبة</span><span>{total.toFixed(2)} SAR</span></div>
              </div>
              {template.showQrPreview && (
                <div className="mt-3 flex flex-col items-center gap-1">
                  <div className="grid h-24 w-24 place-items-center rounded border bg-muted">
                    <QrCode className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{lang === "ar" ? "معاينة QR — UI فقط" : "QR Preview — UI only"}</div>
                </div>
              )}
              {template.showInvoiceStatus && (
                <div className="mt-2 flex justify-center">
                  <StatusPill status="ui_preview" />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="card-soft mt-3 grid gap-3 p-5 md:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}: </span><b>{inv.invoiceNumber}</b></div>
            <div><span className="text-muted-foreground">{lang === "ar" ? "رقم الطلب" : "Order #"}: </span><b>{inv.orderNumber}</b></div>
            <div><span className="text-muted-foreground">{lang === "ar" ? "التاريخ" : "Date"}: </span><b>{inv.date}</b></div>
            <div><span className="text-muted-foreground">{lang === "ar" ? "الكاشير" : "Cashier"}: </span><b>{inv.cashier}</b></div>
            <div><span className="text-muted-foreground">{lang === "ar" ? "نوع الطلب" : "Order type"}: </span><b>{inv.orderType}</b></div>
            <div><span className="text-muted-foreground">{lang === "ar" ? "الدفع" : "Payment"}: </span><b>{inv.paymentMethod}</b></div>
            <div className="md:col-span-2 border-t pt-2"></div>
            <div><span className="text-muted-foreground">Subtotal: </span><b>{subtotal.toFixed(2)}</b></div>
            <div><span className="text-muted-foreground">VAT ({tax.vatRate}%): </span><b>{vat.toFixed(2)}</b></div>
            <div><span className="text-muted-foreground">Total: </span><b>{total.toFixed(2)} SAR</b></div>
            <div><span className="text-muted-foreground">Status: </span><StatusPill status="pending_sync" /></div>
          </div>
        </TabsContent>

        <TabsContent value="xml">
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
              <Info className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>{lang === "ar"
                ? "هذه معاينة لهيكل XML للتصميم فقط — ليست XML إنتاجية ولا تُولّد توقيعًا حقيقيًا."
                : "Sample XML structure preview only — not production XML and does not generate a real signature."}</div>
            </div>
            <div className="card-soft overflow-hidden p-0">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-[11px]">
                <span className="flex items-center gap-2"><Code2 className="h-3 w-3" />invoice-sample.xml</span>
                <span className="text-muted-foreground">UI only</span>
              </div>
              <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-foreground/90"
                dir="ltr"><code>{SAMPLE_XML_PREVIEW.replace("{{ VAT_NUMBER }}", tax.vatNumber || "<VAT-NUMBER>")}</code></pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────────────────── 6. SYNC QUEUE ───────────────────────── */
function QueueTab() {
  const { lang } = useApp();
  const { syncQueue, retrySync, markReview } = usePhase5();
  const [errorOf, setErrorOf] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-start">
                <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الطلب" : "Order #"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date/time"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "الإجمالي" : "Total"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الدفع" : "Payment"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="px-3 py-2 text-center">{lang === "ar" ? "المحاولات" : "Retry"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "آخر محاولة" : "Last attempt"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {syncQueue.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="px-3 py-2">{r.orderNumber}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.datetime}</td>
                  <td className="px-3 py-2 text-end">{r.total.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.payment}</td>
                  <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2 text-center">{r.retryCount}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.lastAttempt}</td>
                  <td className="px-3 py-2 text-end">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => retrySync(r.id)}>
                        <RefreshCw className="h-3 w-3" />{lang === "ar" ? "إعادة" : "Retry"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => markReview(r.id)}>
                        <AlertTriangle className="h-3 w-3" />{lang === "ar" ? "مراجعة" : "Review"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setErrorOf(r.id)}>
                        <Eye className="h-3 w-3" />{lang === "ar" ? "التفاصيل" : "Details"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!errorOf} onOpenChange={(o) => !o && setErrorOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تفاصيل المحاولة" : "Attempt details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {lang === "ar"
                ? "هذه محاكاة محلية فقط. زر إعادة المحاولة يغيّر الحالة محليًا ولا يستدعي API حقيقية."
                : "Local simulation only. Retry button updates local status and does not call a real API."}
            </p>
            {errorOf && (() => {
              const row = syncQueue.find((x) => x.id === errorOf);
              if (!row) return null;
              return (
                <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
                  <div>invoice: {row.invoiceNumber}</div>
                  <div>status: {row.status}</div>
                  <div>retries: {row.retryCount}</div>
                  <div>last_attempt: {row.lastAttempt}</div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────── 7. FAILED INVOICES ───────────────────────── */
function FailedTab() {
  const { lang } = useApp();
  const { failed, addNote, resolveFailed } = usePhase5();
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const current = failed.find((f) => f.id === openId);

  return (
    <div className="mt-3">
      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date/time"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "نوع الخطأ" : "Error type"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{f.invoiceNumber}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{f.datetime}</td>
                  <td className="px-3 py-2">{f.errorType}</td>
                  <td className="px-3 py-2 text-end">{f.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={f.status === "resolved" ? "default" : f.status === "in_review" ? "secondary" : "destructive"}>
                      {f.status === "resolved" ? (lang === "ar" ? "مُعالَجة" : "Resolved")
                        : f.status === "in_review" ? (lang === "ar" ? "قيد المراجعة" : "In review")
                        : (lang === "ar" ? "مفتوحة" : "Open")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setOpenId(f.id)}>
                      <Eye className="h-3 w-3" />{lang === "ar" ? "فتح" : "Open"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{current.invoiceNumber}</SheetTitle>
                <SheetDescription>{current.datetime} — {current.amount.toFixed(2)} SAR</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                  <div className="font-semibold">{current.errorType}</div>
                  <div className="text-muted-foreground">{current.errorMessage}</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <div className="mb-1 font-semibold">{lang === "ar" ? "الإصلاح المقترح" : "Suggested fix"}</div>
                  {lang === "ar"
                    ? "تأكد من اكتمال بيانات الملف الضريبي للشركة، ثم أعد المحاولة بعد جاهزية التكامل الخلفي."
                    : "Verify the company tax profile is complete, then retry once backend integration is wired."}
                </div>

                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الخط الزمني" : "Timeline"}</div>
                  <ol className="space-y-1.5 text-xs">
                    <li className="flex gap-2"><span className="text-muted-foreground">{current.datetime}</span><span>{lang === "ar" ? "فشل أثناء المحاكاة" : "Failed during simulation"}</span></li>
                    {current.notes.map((n, i) => (
                      <li key={i} className="flex gap-2"><span className="text-muted-foreground">{n.at}</span><span><b>{n.by}:</b> {n.text}</span></li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "ar" ? "إضافة ملاحظة داخلية" : "Add internal note"}</Label>
                  <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button size="sm" disabled={!noteText.trim()} onClick={() => { addNote(current.id, noteText.trim(), "Manager"); setNoteText(""); }}>
                    {lang === "ar" ? "حفظ الملاحظة" : "Save note"}
                  </Button>
                </div>

                <div className="flex gap-2 border-t pt-3">
                  <Button variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />{lang === "ar" ? "إعادة المحاولة (UI)" : "Retry (UI)"}</Button>
                  <Button onClick={() => resolveFailed(current.id)} className="gap-1"><Check className="h-3 w-3" />{lang === "ar" ? "وضع كمُعالَجة" : "Mark resolved"}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───────────────────────── 8. OFFLINE MODE ───────────────────────── */
function OfflineTab() {
  const { lang } = useApp();
  const { offline, setOffline, syncQueue } = usePhase5();
  const pending = syncQueue.filter((s) => s.status === "offline_queued" || s.status === "pending_sync");
  const failedCount = syncQueue.filter((s) => s.status === "failed").length;
  const oldest = pending[0]?.datetime ?? "—";

  return (
    <div className="mt-3 space-y-3">
      {offline.enabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <WifiOff className="mt-0.5 h-4 w-4 text-amber-600" />
          <div>
            {lang === "ar"
              ? "النظام يعمل حاليًا في وضع الطوارئ. سيتم حفظ الفواتير ومزامنتها عند عودة الاتصال."
              : "The system is currently in emergency offline mode. Invoices will be saved and synced when connection returns."}
            <div className="mt-1 text-xs text-muted-foreground">
              {lang === "ar" ? "ملاحظة: لا يُعدّ هذا متوافقًا حتى يتم تنفيذ التكامل الخلفي مع زاتكا." : "Note: not considered fully compliant until backend ZATCA integration is implemented."}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <ToggleRow label={lang === "ar" ? "تفعيل وضع الطوارئ" : "Enable emergency offline mode"}
            value={offline.enabled} onChange={(v) => setOffline({ ...offline, enabled: v })} />
          <ToggleRow label={lang === "ar" ? "السماح بالمبيعات أثناء عدم الاتصال" : "Allow POS sales while offline"}
            value={offline.allowSalesWhileOffline} onChange={(v) => setOffline({ ...offline, allowSalesWhileOffline: v })} />
          <ToggleRow label={lang === "ar" ? "تخزين الفواتير محليًا حتى عودة الاتصال" : "Store invoices locally until internet returns"}
            value={offline.storeLocally} onChange={(v) => setOffline({ ...offline, storeLocally: v })} />
          <ToggleRow label={lang === "ar" ? "تنبيه الكاشير" : "Show warning to cashier"}
            value={offline.warnCashier} onChange={(v) => setOffline({ ...offline, warnCashier: v })} />
          <ToggleRow label={lang === "ar" ? "مزامنة تلقائية عند عودة الاتصال" : "Auto-sync when internet returns"}
            value={offline.autoSyncOnReturn} onChange={(v) => setOffline({ ...offline, autoSyncOnReturn: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "فواتير بالانتظار" : "Pending offline invoices"}</div>
            <div className="mt-1 text-2xl font-bold">{pending.length}</div>
          </div>
          <div className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "أقدم فاتورة" : "Oldest pending"}</div>
            <div className="mt-1 text-sm font-semibold">{oldest}</div>
          </div>
          <div className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "آخر محاولة مزامنة" : "Last sync attempt"}</div>
            <div className="mt-1 text-sm font-semibold">{syncQueue.find((s) => s.lastAttempt !== "—")?.lastAttempt ?? "—"}</div>
          </div>
          <div className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "محاولات فاشلة" : "Failed sync count"}</div>
            <div className="mt-1 text-2xl font-bold text-rose-600">{failedCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 9. COMPLIANCE CHECKLIST ───────────────────────── */
function ChecklistTab() {
  const { lang } = useApp();
  const { checklist } = usePhase5();
  return (
    <div className="mt-3 space-y-3">
      {checklist.map((g, i) => (
        <div key={i} className="card-soft p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">{lang === "ar" ? g.ar : g.en}</h3>
          </div>
          <ul className="divide-y">
            {g.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                <span>{lang === "ar" ? it.ar : it.en}</span>
                <ChecklistPill status={it.status} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Reusable badge export for orders list ───────────── */
export { StatusPill as ZatcaStatusBadge };
