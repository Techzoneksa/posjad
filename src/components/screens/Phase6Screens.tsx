"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ManagerLayout } from "./ManagerScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, ShieldAlert, Bell, Upload, Download, Database, KeyRound, ClipboardCheck,
  Server, CheckCircle2, AlertCircle, Clock, Circle, FileSpreadsheet, FileText,
  Calendar, ChevronRight, Search, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhase6 } from "@/lib/phase6Store";
import {
  EXPORT_MODULES, IMPORT_TEMPLATES, PERM_ROLES, PERM_MODULES, PERM_ACTIONS,
  BACKEND_MODELS, API_GROUPS, INTEGRATION_REQS, BACKEND_CHECKLIST,
  type ActivityLog, type AuditLog, type Notification,
} from "@/lib/phase6Data";

/* ───────── Shared helpers ───────── */
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
function fmtTime(ts: number) {
  return new Date(ts).toLocaleString();
}
function StatusDot({ tone }: { tone: "good" | "warn" | "bad" | "muted" }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full",
    tone === "good" && "bg-emerald-500",
    tone === "warn" && "bg-amber-500",
    tone === "bad" && "bg-rose-500",
    tone === "muted" && "bg-muted-foreground/40",
  )} />;
}
function EmptyState({ icon: Icon = Inbox, title, hint }: { icon?: any; title: string; hint?: string }) {
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/60" />
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ═══════════════════ 1. System Readiness ═══════════════════ */
export function ManagerReadiness() {
  const { lang } = useApp();
  const { readiness, setReadinessStatus } = usePhase6();
  const all = readiness.flatMap((s) => s.items);
  const ready = all.filter((i) => i.status === "ready").length;
  const pct = Math.round((ready / all.length) * 100);
  const tone = (s: string) => s === "ready" ? "good" : s === "missing" ? "bad" : s === "review" ? "warn" : "muted";
  const label = (s: string) => lang === "ar"
    ? { ready: "جاهز", missing: "ناقص", review: "للمراجعة", "n/a": "غير مطلوب" }[s]
    : { ready: "Ready", missing: "Missing", review: "Needs review", "n/a": "Not required" }[s];

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "جاهزية النظام" : "System Readiness"}
        subtitle={lang === "ar" ? "مراجعة اكتمال البيانات والتدفقات قبل ربط الباك إند" : "Review data and flow completeness before backend integration"}
      />
      <div className="card-soft mb-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "نسبة الجاهزية الكلية" : "Overall readiness"}</div>
            <div className="text-3xl font-bold">{pct}%</div>
            <div className="text-xs text-muted-foreground">{ready} / {all.length}</div>
          </div>
          <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {readiness.map((sec) => (
          <div key={sec.id} className="card-soft p-4">
            <div className="mb-3 font-semibold">{lang === "ar" ? sec.ar : sec.en}</div>
            <ul className="divide-y">
              {sec.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot tone={tone(it.status) as any} />
                    <div className="truncate">
                      <div className="truncate">{lang === "ar" ? it.ar : it.en}</div>
                      {it.note && <div className="truncate text-[11px] text-muted-foreground">{it.note}</div>}
                    </div>
                  </div>
                  <Select value={it.status} onValueChange={(v) => setReadinessStatus(sec.id, it.id, v as any)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ready">{label("ready")}</SelectItem>
                      <SelectItem value="missing">{label("missing")}</SelectItem>
                      <SelectItem value="review">{label("review")}</SelectItem>
                      <SelectItem value="n/a">{label("n/a")}</SelectItem>
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 2. Activity Logs ═══════════════════ */
export function ManagerActivity() {
  const { lang } = useApp();
  const { activity } = usePhase6();
  const [query, setQuery] = useState("");
  const [act, setAct] = useState<string>("all");
  const [mod, setMod] = useState<string>("all");
  const [detail, setDetail] = useState<ActivityLog | null>(null);
  const filtered = useMemo(() => activity.filter((a) =>
    (act === "all" || a.action === act) &&
    (mod === "all" || a.module === mod) &&
    (!query || (a.user + a.description).toLowerCase().includes(query.toLowerCase()))
  ), [activity, act, mod, query]);
  const modules = Array.from(new Set(activity.map((a) => a.module)));

  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "سجل النشاط" : "Activity Logs"}
        subtitle={lang === "ar" ? "كل ما يحدث في النظام مع الفلترة" : "Everything that happens — searchable & filterable"}
        action={<Button variant="outline" className="gap-2"><Download className="h-4 w-4" />{lang === "ar" ? "تصدير" : "Export"}</Button>}
      />
      <div className="card-soft mb-3 flex flex-wrap gap-2 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-8" placeholder={lang === "ar" ? "بحث…" : "Search…"} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={act} onValueChange={setAct}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الإجراءات" : "All actions"}</SelectItem>
            {["login", "create", "update", "delete", "print", "refund", "shift_open", "shift_close", "payment", "adjust"].map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mod} onValueChange={setMod}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الوحدات" : "All modules"}</SelectItem>
            {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? <EmptyState title={lang === "ar" ? "لا توجد سجلات مطابقة" : "No matching logs"} /> : (
        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "User"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الوحدة" : "Module"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الإجراء" : "Action"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الوصف" : "Description"}</th>
                <th className="px-3 py-2 text-start">{lang === "ar" ? "الجهاز" : "Device"}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(a.ts)}</td>
                  <td className="px-3 py-2"><div className="font-medium">{a.user}</div><div className="text-[11px] text-muted-foreground">{a.role}</div></td>
                  <td className="px-3 py-2">{a.module}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{a.action}</Badge></td>
                  <td className="px-3 py-2">{a.description}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.device} · {a.ip}</td>
                  <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => setDetail(a)}><ChevronRight className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{lang === "ar" ? "تفاصيل النشاط" : "Activity details"}</SheetTitle>
            <SheetDescription>{detail?.id}</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-2 text-sm">
              {Object.entries({
                Date: fmtTime(detail.ts), User: detail.user, Role: detail.role,
                Module: detail.module, Action: detail.action, Description: detail.description,
                Device: detail.device, IP: detail.ip, Status: detail.status,
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b py-1.5">
                  <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </ManagerLayout>
  );
}

/* ═══════════════════ 3. Audit Logs ═══════════════════ */
export function ManagerAudit() {
  const { lang } = useApp();
  const { audit } = usePhase6();
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [note, setNote] = useState("");
  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "سجل التدقيق" : "Audit Logs"}
        subtitle={lang === "ar" ? "متابعة التغييرات الحساسة" : "Track sensitive changes"}
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "User"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الكيان" : "Entity"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الحقل" : "Field"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "السابق" : "Old"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الجديد" : "New"}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(a.ts)}</td>
                <td className="px-3 py-2">{a.user}<div className="text-[11px] text-muted-foreground">{a.role}</div></td>
                <td className="px-3 py-2">{a.entity}</td>
                <td className="px-3 py-2">{a.field}</td>
                <td className="px-3 py-2 text-rose-600">{a.oldValue}</td>
                <td className="px-3 py-2 text-emerald-600">{a.newValue}</td>
                <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => setDetail(a)}><ChevronRight className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!detail} onOpenChange={(o) => !o && (setDetail(null), setNote(""))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detail?.id}</SheetTitle>
            <SheetDescription>{detail?.entity}</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{lang === "ar" ? "مقارنة" : "Comparison"}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded bg-rose-500/10 p-2"><div className="text-[11px] text-rose-700">{lang === "ar" ? "قبل" : "Before"}</div><div className="font-mono">{detail.oldValue}</div></div>
                  <div className="rounded bg-emerald-500/10 p-2"><div className="text-[11px] text-emerald-700">{lang === "ar" ? "بعد" : "After"}</div><div className="font-mono">{detail.newValue}</div></div>
                </div>
              </div>
              {detail.reason && <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "السبب" : "Reason"}</div><div>{detail.reason}</div></div>}
              <div>
                <Label className="text-xs">{lang === "ar" ? "ملاحظة داخلية" : "Internal note"}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={lang === "ar" ? "أضف ملاحظة…" : "Add a note…"} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </ManagerLayout>
  );
}

/* ═══════════════════ 4. Notifications ═══════════════════ */
const NOTIF_PRIO_COLOR: Record<string, string> = {
  low: "bg-muted text-foreground",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  critical: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};
export function ManagerNotifications() {
  const { lang } = useApp();
  const { notifications, setNotifStatus } = usePhase6();
  const [tab, setTab] = useState("all");
  const list = notifications.filter((n) => tab === "all" ? true : n.status === tab);
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "مركز التنبيهات" : "Notifications Center"} subtitle={lang === "ar" ? "كل التنبيهات في مكان واحد" : "All alerts in one place"} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{lang === "ar" ? "الكل" : "All"} ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">{lang === "ar" ? "غير مقروء" : "Unread"} ({notifications.filter((n) => n.status === "unread").length})</TabsTrigger>
          <TabsTrigger value="resolved">{lang === "ar" ? "تم الحل" : "Resolved"}</TabsTrigger>
          <TabsTrigger value="snoozed">{lang === "ar" ? "مؤجل" : "Snoozed"}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {list.length === 0 ? <EmptyState icon={Bell} title={lang === "ar" ? "لا توجد تنبيهات" : "No notifications"} /> :
            list.map((n) => <NotifCard key={n.id} n={n} onAction={setNotifStatus} />)}
        </TabsContent>
      </Tabs>
    </ManagerLayout>
  );
}
function NotifCard({ n, onAction }: { n: Notification; onAction: (id: string, s: any) => void }) {
  const { lang } = useApp();
  return (
    <div className={cn("card-soft flex items-start gap-3 p-3", n.status === "unread" && "border-primary/30")}>
      <div className="mt-1"><Bell className="h-4 w-4 text-primary" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold">{n.title}</div>
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", NOTIF_PRIO_COLOR[n.priority])}>{n.priority.toUpperCase()}</span>
          <Badge variant="outline" className="text-[10px]">{n.category}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{n.message}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{fmtTime(n.ts)} · {lang === "ar" ? "مُسند إلى" : "Assigned to"} {n.assignee}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        {n.status !== "read" && <Button size="sm" variant="ghost" onClick={() => onAction(n.id, "read")}>{lang === "ar" ? "مقروء" : "Read"}</Button>}
        {n.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => onAction(n.id, "resolved")}>{lang === "ar" ? "حل" : "Resolve"}</Button>}
        {n.status !== "snoozed" && <Button size="sm" variant="ghost" onClick={() => onAction(n.id, "snoozed")}>{lang === "ar" ? "تأجيل" : "Snooze"}</Button>}
      </div>
    </div>
  );
}

/* ═══════════════════ 5. Data Import ═══════════════════ */
export function ManagerImport() {
  const { lang } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const tpl = IMPORT_TEMPLATES.find((t) => t.id === open);
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "استيراد البيانات" : "Data Import"} subtitle={lang === "ar" ? "محاكاة استيراد — لم يتم ربط الباك إند بعد" : "Import simulation — backend not connected yet"} />
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <AlertCircle className="me-2 inline h-4 w-4 text-amber-600" />
        {lang === "ar" ? "هذه الواجهة للتجهيز فقط. الرفع الفعلي يتم بعد ربط الباك إند." : "UI only. Real upload happens after backend integration."}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_TEMPLATES.map((t) => (
          <div key={t.id} className="card-soft p-4">
            <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /><div className="font-semibold">{lang === "ar" ? t.ar : t.en}</div></div>
            <div className="mt-2 text-xs text-muted-foreground">{lang === "ar" ? "الصيغة المدعومة" : "Format"}: Excel / CSV</div>
            <div className="mt-2 text-[11px]"><span className="text-muted-foreground">{lang === "ar" ? "الحقول المطلوبة" : "Required fields"}:</span> {t.fields.join(", ")}</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="gap-1"><Download className="h-3.5 w-3.5" />{lang === "ar" ? "قالب" : "Template"}</Button>
              <Button size="sm" className="gap-1" onClick={() => setOpen(t.id)}><Upload className="h-3.5 w-3.5" />{lang === "ar" ? "رفع" : "Upload"}</Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{lang === "ar" ? "معاينة الاستيراد" : "Import preview"} — {tpl && (lang === "ar" ? tpl.ar : tpl.en)}</DialogTitle></DialogHeader>
          {tpl && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr>{tpl.fields.map((f) => <th key={f} className="px-2 py-1.5 text-start font-semibold">{f}</th>)}</tr></thead>
                  <tbody>
                    {tpl.sample.map((row, i) => <tr key={i} className="border-t">{tpl.fields.map((f) => <td key={f} className="px-2 py-1.5">{row[f] || <span className="text-muted-foreground/50">—</span>}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">{lang === "ar" ? "نتيجة التحقق" : "Validation result"}</div>
                {tpl.validations.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700"><CheckCircle2 className="me-1 inline h-4 w-4" />{lang === "ar" ? "لا توجد أخطاء" : "No errors detected"}</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {tpl.validations.map((v, i) => (
                      <li key={i} className="flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-700">
                        <AlertCircle className="h-3.5 w-3.5" />{lang === "ar" ? "صف" : "Row"} {v.row} · {v.field}: {v.issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
}

/* ═══════════════════ 6. Data Export ═══════════════════ */
export function ManagerExport() {
  const { lang } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState("xlsx");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const run = () => { setRunning(true); setDone(false); setTimeout(() => { setRunning(false); setDone(true); }, 1200); };
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "تصدير البيانات" : "Data Export"} subtitle={lang === "ar" ? "محاكاة تصدير — التصدير الفعلي بعد ربط الباك إند" : "Export simulation — actual export after backend"} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card-soft p-4">
          <div className="mb-2 font-semibold">{lang === "ar" ? "اختر الوحدات" : "Choose modules"}</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {EXPORT_MODULES.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm", selected.includes(m.id) && "border-primary bg-primary/5")}>
                <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                <span>{lang === "ar" ? m.ar : m.en}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="card-soft space-y-3 p-4">
          <div>
            <Label className="text-xs">{lang === "ar" ? "نطاق التاريخ" : "Date range"}</Label>
            <div className="mt-1 flex gap-2"><Input type="date" /><Input type="date" /></div>
          </div>
          <div>
            <Label className="text-xs">{lang === "ar" ? "الصيغة" : "Format"}</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between"><Label className="text-xs">{lang === "ar" ? "تضمين المؤرشف" : "Include archived"}</Label><Switch /></div>
          <div className="flex items-center justify-between"><Label className="text-xs">{lang === "ar" ? "تضمين التفاصيل" : "Include details"}</Label><Switch defaultChecked /></div>
          <Button className="w-full gap-2" onClick={run} disabled={selected.length === 0 || running}>
            <Download className="h-4 w-4" />{running ? (lang === "ar" ? "جاري التجهيز…" : "Generating…") : (lang === "ar" ? "توليد التصدير" : "Generate export")}
          </Button>
          <Button variant="outline" className="w-full gap-2"><Calendar className="h-4 w-4" />{lang === "ar" ? "جدولة دورية" : "Schedule export"}</Button>
          {done && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700">
              <CheckCircle2 className="me-1 inline h-4 w-4" />{lang === "ar" ? "تم تجهيز المعاينة" : "Preview ready"} ({selected.length} {lang === "ar" ? "وحدات" : "modules"}, .{format})
            </div>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 7. Backup Settings ═══════════════════ */
export function ManagerBackup() {
  const { lang } = useApp();
  const { backup, setBackup, restorePoints, runBackup } = usePhase6();
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "إعدادات النسخ الاحتياطي" : "Backup Settings"} subtitle={lang === "ar" ? "تجهيز فقط — لا يوجد نسخ فعلي" : "Preparation only — no real backup"} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="card-soft p-4">
            <div className="mb-3 font-semibold">{lang === "ar" ? "الإعدادات" : "Configuration"}</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>{lang === "ar" ? "تفعيل النسخ التلقائي" : "Enable automatic backup"}</Label><Switch checked={backup.enabled} onCheckedChange={(v) => setBackup({ enabled: v })} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label className="text-xs">{lang === "ar" ? "التكرار" : "Frequency"}</Label>
                  <Select value={backup.frequency} onValueChange={(v) => setBackup({ frequency: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">{lang === "ar" ? "يومي" : "Daily"}</SelectItem><SelectItem value="weekly">{lang === "ar" ? "أسبوعي" : "Weekly"}</SelectItem><SelectItem value="monthly">{lang === "ar" ? "شهري" : "Monthly"}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{lang === "ar" ? "الوقت" : "Time"}</Label><Input type="time" value={backup.time} onChange={(e) => setBackup({ time: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>{lang === "ar" ? "تضمين المرفقات" : "Include attachments"}</Label><Switch checked={backup.includeAttachments} onCheckedChange={(v) => setBackup({ includeAttachments: v })} /></div>
              <div className="flex items-center justify-between"><Label>{lang === "ar" ? "تضمين السجلات" : "Include logs"}</Label><Switch checked={backup.includeLogs} onCheckedChange={(v) => setBackup({ includeLogs: v })} /></div>
              <div><Label className="text-xs">{lang === "ar" ? "فترة الاحتفاظ (أيام)" : "Retention (days)"}</Label><Input type="number" value={backup.retentionDays} onChange={(e) => setBackup({ retentionDays: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between"><Label>{lang === "ar" ? "تنبيه الأونر عند الفشل" : "Notify owner on failure"}</Label><Switch checked={backup.notifyOwner} onCheckedChange={(v) => setBackup({ notifyOwner: v })} /></div>
            </div>
          </div>
          <div className="card-soft p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">{lang === "ar" ? "نقاط الاستعادة" : "Restore points"}</div>
              <Button size="sm" className="gap-1" onClick={runBackup}><Database className="h-3.5 w-3.5" />{lang === "ar" ? "نسخ احتياطي الآن" : "Run backup now"}</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-2 py-2 text-start">ID</th><th className="px-2 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th><th className="px-2 py-2 text-start">{lang === "ar" ? "الحجم" : "Size"}</th><th className="px-2 py-2 text-start">{lang === "ar" ? "الحالة" : "Status"}</th><th className="px-2 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th><th className="px-2 py-2"></th></tr>
                </thead>
                <tbody>
                  {restorePoints.map((rp) => (
                    <tr key={rp.id} className="border-t">
                      <td className="px-2 py-2 font-mono text-xs">{rp.id}</td>
                      <td className="px-2 py-2 text-xs">{rp.date}</td>
                      <td className="px-2 py-2">{rp.size}</td>
                      <td className="px-2 py-2"><Badge variant={rp.status === "success" ? "default" : rp.status === "failed" ? "destructive" : "secondary"}>{rp.status}</Badge></td>
                      <td className="px-2 py-2 text-xs">{rp.type}</td>
                      <td className="px-2 py-2 text-end"><Button size="sm" variant="ghost">{lang === "ar" ? "استعادة" : "Restore"}</Button><Button size="sm" variant="ghost">{lang === "ar" ? "تنزيل" : "Download"}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="card-soft h-fit p-4">
          <div className="mb-3 font-semibold">{lang === "ar" ? "حالة النسخ الاحتياطي" : "Backup status"}</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{lang === "ar" ? "التفعيل" : "Status"}</span><Badge variant={backup.enabled ? "default" : "secondary"}>{backup.enabled ? (lang === "ar" ? "مفعّل" : "Active") : (lang === "ar" ? "غير مفعّل" : "Disabled")}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{lang === "ar" ? "آخر نسخة" : "Last backup"}</span><span>{restorePoints[0]?.date ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{lang === "ar" ? "الوجهة" : "Destination"}</span><span className="text-muted-foreground">—</span></div>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 8. Permissions Review ═══════════════════ */
export function ManagerPermissions() {
  const { lang } = useApp();
  const { perms, togglePerm, resetPerms } = usePhase6();
  const [role, setRole] = useState<typeof PERM_ROLES[number]["id"]>("mgr");
  return (
    <ManagerLayout>
      <PageHeader
        title={lang === "ar" ? "مراجعة الصلاحيات" : "Permissions Review"}
        subtitle={lang === "ar" ? "تعديل محلي فقط — لا يوجد ربط مصادقة" : "Local edit only — no auth backend"}
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={resetPerms}>{lang === "ar" ? "إعادة للافتراضي" : "Reset to default"}</Button>
          <Button>{lang === "ar" ? "حفظ المسودة" : "Save draft"}</Button>
        </div>}
      />
      <div className="card-soft mb-3 flex flex-wrap gap-2 p-3">
        {PERM_ROLES.map((r) => (
          <button key={r.id} onClick={() => setRole(r.id)}
            className={cn("rounded-lg border px-3 py-1.5 text-sm", role === r.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {lang === "ar" ? r.ar : r.en}
          </button>
        ))}
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2 text-start">{lang === "ar" ? "الوحدة" : "Module"}</th>{PERM_ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center">{a}</th>)}</tr>
          </thead>
          <tbody>
            {PERM_MODULES.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-medium">{lang === "ar" ? m.ar : m.en}</td>
                {PERM_ACTIONS.map((a) => (
                  <td key={a} className="px-2 py-2 text-center">
                    <Checkbox checked={perms[role][m.id]?.[a] ?? false} disabled={role === "owner"} onCheckedChange={() => togglePerm(role, m.id, a)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {lang === "ar" ? "ملاحظات: الأونر يملك صلاحيات كاملة. الكاشير محصور بالكاشير والطلبات. المدير المالي يدير الصفحات المالية. مدير المطعم يدير العمليات." :
          "Notes: Owner has full access. Cashier restricted to POS/Orders. Financial Manager owns finance. Restaurant Manager owns operations."}
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 9. QA Checklist ═══════════════════ */
const QA_PRIO_COLOR: Record<string, string> = {
  low: "text-muted-foreground", med: "text-amber-600", high: "text-orange-600", critical: "text-rose-600",
};
export function ManagerQA() {
  const { lang } = useApp();
  const { qa, toggleQA, setQANote } = usePhase6();
  const all = qa.flatMap((s) => s.items);
  const done = all.filter((i) => i.done).length;
  const critical = all.filter((i) => !i.done && i.priority === "critical").length;
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "قائمة فحص الجودة" : "QA Checklist"} subtitle={lang === "ar" ? "اختبر كل التدفقات قبل التسليم" : "Test all flows before delivery"} />
      <div className="card-soft mb-3 grid grid-cols-3 divide-x p-3 text-center">
        <div><div className="text-2xl font-bold text-emerald-600">{done}/{all.length}</div><div className="text-xs text-muted-foreground">{lang === "ar" ? "مكتمل" : "Completed"}</div></div>
        <div><div className="text-2xl font-bold text-rose-600">{critical}</div><div className="text-xs text-muted-foreground">{lang === "ar" ? "حرج متبقي" : "Critical open"}</div></div>
        <div><div className="text-2xl font-bold">{all.length - done}</div><div className="text-xs text-muted-foreground">{lang === "ar" ? "متبقي" : "Remaining"}</div></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {qa.map((sec) => (
          <div key={sec.id} className="card-soft p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">{lang === "ar" ? sec.ar : sec.en}</div>
              <Badge variant="outline">{sec.items.filter((i) => i.done).length}/{sec.items.length}</Badge>
            </div>
            <ul className="space-y-1.5">
              {sec.items.map((it) => (
                <li key={it.id} className="flex items-start gap-2 rounded-lg p-1.5 text-sm hover:bg-muted/40">
                  <Checkbox className="mt-0.5" checked={it.done} onCheckedChange={() => toggleQA(sec.id, it.id)} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("flex items-center gap-2", it.done && "line-through text-muted-foreground")}>
                      <span>{lang === "ar" ? it.ar : it.en}</span>
                      <Circle className={cn("h-2 w-2 fill-current", QA_PRIO_COLOR[it.priority])} />
                    </div>
                    {it.notes !== undefined && (
                      <Input className="mt-1 h-7 text-xs" placeholder={lang === "ar" ? "ملاحظة…" : "Note…"} value={it.notes} onChange={(e) => setQANote(sec.id, it.id, e.target.value)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ManagerLayout>
  );
}

/* ═══════════════════ 10. Backend Readiness ═══════════════════ */
export function ManagerBackend() {
  const { lang } = useApp();
  const [model, setModel] = useState<typeof BACKEND_MODELS[number] | null>(null);
  const [group, setGroup] = useState<typeof API_GROUPS[number] | null>(null);
  return (
    <ManagerLayout>
      <PageHeader title={lang === "ar" ? "جاهزية الباك إند" : "Backend Readiness"} subtitle={lang === "ar" ? "توثيق UI لتجهيز التطوير الفعلي" : "Documentation UI to prepare real implementation"} />
      <Tabs defaultValue="models">
        <TabsList>
          <TabsTrigger value="models">{lang === "ar" ? "نماذج البيانات" : "Data Models"}</TabsTrigger>
          <TabsTrigger value="api">{lang === "ar" ? "خطة API" : "API Plan"}</TabsTrigger>
          <TabsTrigger value="integ">{lang === "ar" ? "متطلبات التكامل" : "Integration"}</TabsTrigger>
          <TabsTrigger value="check">{lang === "ar" ? "قائمة الباك إند" : "Checklist"}</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BACKEND_MODELS.map((m) => (
            <button key={m.id} onClick={() => setModel(m)} className="card-soft p-4 text-start transition hover:border-primary">
              <div className="flex items-center justify-between"><div className="font-semibold">{m.id}</div><Badge variant="outline" className="text-[10px]">planned</Badge></div>
              <div className="mt-1 text-sm text-muted-foreground">{m.purpose}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">→ {m.related.join(", ")}</div>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="api" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {API_GROUPS.map((g) => (
            <button key={g.id} onClick={() => setGroup(g)} className="card-soft p-4 text-start transition hover:border-primary">
              <div className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" /><div className="font-semibold">{g.name}</div></div>
              <div className="mt-1 text-xs text-muted-foreground">{g.endpoints.length} endpoints</div>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="integ" className="mt-4">
          <div className="card-soft p-4">
            <ul className="divide-y">
              {INTEGRATION_REQS.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{lang === "ar" ? r.ar : r.en}</span>
                  <Badge variant="outline">{lang === "ar" ? "مطلوب" : "Required"}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="check" className="mt-4">
          <div className="card-soft p-4">
            <ul className="space-y-2">
              {BACKEND_CHECKLIST.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span>{lang === "ar" ? c.ar : c.en}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!model} onOpenChange={(o) => !o && setModel(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{model?.id}</SheetTitle><SheetDescription>{model?.purpose}</SheetDescription></SheetHeader>
          {model && (
            <div className="mt-4 space-y-3 text-sm">
              <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "الوحدات المرتبطة" : "Related modules"}</div><div className="mt-1 flex flex-wrap gap-1">{model.related.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div></div>
              <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "الحالة" : "Status"}</div><Badge>planned</Badge></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={!!group} onOpenChange={(o) => !o && setGroup(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{group?.name} API</SheetTitle><SheetDescription>{group?.endpoints.length} planned endpoints</SheetDescription></SheetHeader>
          {group && (
            <ul className="mt-4 space-y-1.5">
              {group.endpoints.map((e) => (
                <li key={e} className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs">{e}</li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </ManagerLayout>
  );
}
