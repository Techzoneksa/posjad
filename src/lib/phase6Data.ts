// Phase 6 — Readiness, Logs, QA, Backend prep (frontend-only seed data)

export type ReadinessStatus = "ready" | "missing" | "review" | "n/a";
export type ReadinessItem = {
  id: string;
  ar: string;
  en: string;
  status: ReadinessStatus;
  note?: string;
};
export type ReadinessSection = {
  id: string;
  ar: string;
  en: string;
  items: ReadinessItem[];
};

export const READINESS_SECTIONS: ReadinessSection[] = [
  {
    id: "pos", ar: "جاهزية الكاشير", en: "POS Readiness",
    items: [
      { id: "pos_products", ar: "اكتمال المنتجات", en: "Products completed", status: "ready" },
      { id: "pos_categories", ar: "اكتمال الفئات", en: "Categories completed", status: "ready" },
      { id: "pos_addons", ar: "ربط الإضافات", en: "Addons linked correctly", status: "ready" },
      { id: "pos_payments", ar: "طرق الدفع", en: "Payment methods configured", status: "ready" },
      { id: "pos_shift", ar: "تدفق الورديات", en: "Shift flow configured", status: "ready" },
      { id: "pos_receipt", ar: "إعدادات الفاتورة", en: "Receipt settings configured", status: "review" },
    ],
  },
  {
    id: "dash", ar: "جاهزية لوحة الإدارة", en: "Dashboard Readiness",
    items: [
      { id: "d_users", ar: "إنشاء المستخدمين", en: "Users created", status: "ready" },
      { id: "d_roles", ar: "تهيئة الأدوار", en: "Roles configured", status: "ready" },
      { id: "d_cashiers", ar: "إنشاء الكاشير", en: "Cashiers created", status: "ready" },
      { id: "d_branch", ar: "إعدادات الفرع", en: "Branch settings completed", status: "review", note: "Al-Shawqiyyah" },
      { id: "d_reports", ar: "مراجعة التقارير", en: "Reports UI reviewed", status: "review" },
    ],
  },
  {
    id: "inv", ar: "جاهزية المخزون", en: "Inventory Readiness",
    items: [
      { id: "i_items", ar: "إضافة عناصر المخزون", en: "Inventory items added", status: "ready" },
      { id: "i_recipes", ar: "ربط الوصفات بالمنتجات", en: "Recipes linked to products", status: "missing", note: "زنجر عربي بدون وصفة" },
      { id: "i_low", ar: "حدود الحد الأدنى", en: "Low stock limits configured", status: "ready" },
      { id: "i_waste", ar: "أسباب الهدر", en: "Waste reasons configured", status: "ready" },
      { id: "i_adjust", ar: "أسباب التسوية", en: "Stock adjustment reasons configured", status: "ready" },
    ],
  },
  {
    id: "fin", ar: "جاهزية المالية", en: "Finance Readiness",
    items: [
      { id: "f_exp", ar: "فئات المصاريف", en: "Expense categories configured", status: "ready" },
      { id: "f_banks", ar: "البنوك والصناديق", en: "Bank/cashbox accounts configured", status: "ready" },
      { id: "f_coa", ar: "دليل الحسابات", en: "Chart of accounts configured", status: "ready" },
      { id: "f_journal", ar: "قواعد القيود", en: "Journal entry rules previewed", status: "review" },
      { id: "f_supp", ar: "دفعات الموردين", en: "Supplier payments flow reviewed", status: "ready" },
      { id: "f_sal", ar: "تدفق الرواتب", en: "Salary flow reviewed", status: "review" },
    ],
  },
  {
    id: "be", ar: "جاهزية الباك إند", en: "Backend Readiness",
    items: [
      { id: "b_models", ar: "نماذج البيانات", en: "Data models prepared", status: "ready" },
      { id: "b_api", ar: "تخطيط واجهات API", en: "API endpoints planned", status: "ready" },
      { id: "b_auth", ar: "أدوار المصادقة", en: "Auth roles defined", status: "ready" },
      { id: "b_files", ar: "متطلبات رفع الملفات", en: "File upload requirements listed", status: "review" },
      { id: "b_offline", ar: "متطلبات المزامنة دون اتصال", en: "Offline sync requirements listed", status: "review" },
    ],
  },
];

/* ───────── Activity logs ───────── */
export type ActivityAction =
  | "login" | "create" | "update" | "delete" | "print"
  | "refund" | "shift_open" | "shift_close" | "payment" | "adjust";
export type ActivityLog = {
  id: string;
  ts: number;
  user: string;
  role: string;
  module: string;
  action: ActivityAction;
  description: string;
  device: string;
  ip: string;
  status: "success" | "failed";
};

const now = Date.now();
export const ACTIVITY_LOGS: ActivityLog[] = [
  { id: "A-1001", ts: now - 1000*60*5, user: "أحمد", role: "Cashier", module: "Shift", action: "shift_open", description: "فتح الوردية برصيد 500 ر.س", device: "Tablet-01", ip: "192.168.1.21", status: "success" },
  { id: "A-1002", ts: now - 1000*60*12, user: "أحمد", role: "Cashier", module: "Orders", action: "payment", description: "إتمام الطلب #42 — 87.50 ر.س", device: "Tablet-01", ip: "192.168.1.21", status: "success" },
  { id: "A-1003", ts: now - 1000*60*30, user: "محمد", role: "Restaurant Manager", module: "Orders", action: "refund", description: "استرجاع فاتورة INV-1021", device: "Web", ip: "192.168.1.10", status: "success" },
  { id: "A-1004", ts: now - 1000*60*60, user: "خالد", role: "Cafe Manager", module: "Products", action: "update", description: "تعديل المنتج: لاتيه ساخن", device: "Web", ip: "192.168.1.10", status: "success" },
  { id: "A-1005", ts: now - 1000*60*90, user: "فهد", role: "Financial Manager", module: "Expenses", action: "create", description: "إضافة مصروف: كهرباء", device: "Web", ip: "192.168.1.11", status: "success" },
  { id: "A-1006", ts: now - 1000*60*120, user: "فهد", role: "Financial Manager", module: "SupplierPayments", action: "create", description: "دفعة لمورد البن", device: "Web", ip: "192.168.1.11", status: "success" },
  { id: "A-1007", ts: now - 1000*60*180, user: "خالد", role: "Cafe Manager", module: "Inventory", action: "adjust", description: "تسوية: حبوب بن -1 كرتون", device: "Web", ip: "192.168.1.10", status: "success" },
  { id: "A-1008", ts: now - 1000*60*240, user: "أحمد", role: "Cashier", module: "Auth", action: "login", description: "تسجيل دخول ناجح", device: "Tablet-01", ip: "192.168.1.21", status: "success" },
  { id: "A-1009", ts: now - 1000*60*300, user: "محمد", role: "Restaurant Manager", module: "Receipt", action: "print", description: "طباعة فاتورة INV-1019", device: "Tablet-02", ip: "192.168.1.22", status: "success" },
];

/* ───────── Audit logs ───────── */
export type AuditLog = {
  id: string;
  ts: number;
  user: string;
  role: string;
  entity: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  note?: string;
};
export const AUDIT_LOGS: AuditLog[] = [
  { id: "AUD-001", ts: now - 1000*60*60, user: "خالد", role: "Cafe Manager", entity: "Product: لاتيه ساخن", field: "السعر", oldValue: "16.00 ر.س", newValue: "17.00 ر.س", reason: "تحديث قائمة الأسعار" },
  { id: "AUD-002", ts: now - 1000*60*180, user: "خالد", role: "Cafe Manager", entity: "Inventory: حبوب بن", field: "الكمية", oldValue: "10 كرتون", newValue: "9 كرتون", reason: "هدر" },
  { id: "AUD-003", ts: now - 1000*60*60*5, user: "الأونر", role: "Owner", entity: "User: محمد", field: "الدور", oldValue: "Cashier", newValue: "Restaurant Manager" },
  { id: "AUD-004", ts: now - 1000*60*60*6, user: "فهد", role: "Financial Manager", entity: "Journal Entry JE-2031", field: "إنشاء يدوي", oldValue: "—", newValue: "قيد يومي يدوي بمبلغ 1,200 ر.س" },
  { id: "AUD-005", ts: now - 1000*60*60*8, user: "محمد", role: "Restaurant Manager", entity: "Invoice INV-1044", field: "الحالة", oldValue: "مكتملة", newValue: "مستردة", reason: "خطأ في الطلب" },
  { id: "AUD-006", ts: now - 1000*60*60*24, user: "خالد", role: "Restaurant Manager", entity: "Discount Settings", field: "أقصى خصم", oldValue: "10%", newValue: "15%" },
  { id: "AUD-007", ts: now - 1000*60*60*30, user: "فهد", role: "Financial Manager", entity: "Supplier: محمصة الرياض", field: "الرصيد الافتتاحي", oldValue: "0", newValue: "4,500 ر.س" },
];

/* ───────── Notifications ───────── */
export type NotifPriority = "low" | "medium" | "high" | "critical";
export type NotifStatus = "unread" | "read" | "resolved" | "snoozed";
export type NotifCategory =
  | "low_stock" | "sync" | "shift" | "supplier" | "expense"
  | "payroll" | "system" | "backup" | "qa";
export type Notification = {
  id: string;
  title: string;
  message: string;
  category: NotifCategory;
  priority: NotifPriority;
  ts: number;
  status: NotifStatus;
  assignee: string;
};
export const NOTIFICATIONS: Notification[] = [
  { id: "N-01", title: "حبوب البن وصلت للحد الأدنى", message: "الكمية الحالية 9 كرتون — الحد الأدنى 10", category: "low_stock", priority: "high", ts: now - 1000*60*10, status: "unread", assignee: "خالد" },
  { id: "N-02", title: "وردية أحمد ما زالت مفتوحة", message: "مر أكثر من 8 ساعات على فتح الوردية", category: "shift", priority: "medium", ts: now - 1000*60*40, status: "unread", assignee: "محمد" },
  { id: "N-03", title: "فاتورة مورد البن مستحقة", message: "رصيد مستحق 4,500 ر.س — تاريخ الاستحقاق اليوم", category: "supplier", priority: "high", ts: now - 1000*60*60, status: "unread", assignee: "فهد" },
  { id: "N-04", title: "لم يتم ضبط وصفة منتج زنجر عربي", message: "المنتج غير مربوط بأي وصفة في المخزون", category: "qa", priority: "medium", ts: now - 1000*60*120, status: "read", assignee: "خالد" },
  { id: "N-05", title: "يوجد 3 منتجات بدون سعرات", message: "راجع المنتجات الناقصة في صفحة المنتجات", category: "qa", priority: "low", ts: now - 1000*60*240, status: "read", assignee: "خالد" },
  { id: "N-06", title: "إعداد النسخ الاحتياطي غير مفعّل", message: "Backup setup not configured", category: "backup", priority: "critical", ts: now - 1000*60*60*2, status: "unread", assignee: "الأونر" },
  { id: "N-07", title: "تذكير: تجهيز رواتب الشهر", message: "موعد الرواتب خلال 5 أيام", category: "payroll", priority: "medium", ts: now - 1000*60*60*4, status: "snoozed", assignee: "فهد" },
];

/* ───────── Import templates ───────── */
export type ImportTemplate = {
  id: string;
  ar: string;
  en: string;
  fields: string[];
  sample: Record<string, string>[];
  validations: { row: number; field: string; issue: string }[];
};
export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "products", ar: "المنتجات", en: "Products",
    fields: ["name_ar", "name_en", "category", "price_inc_vat", "calories", "size"],
    sample: [
      { name_ar: "لاتيه ساخن", name_en: "Hot Latte", category: "Hot Coffee", price_inc_vat: "17.00", calories: "190", size: "Regular" },
      { name_ar: "زنجر عربي", name_en: "Arabic Zinger", category: "Sandwich", price_inc_vat: "12.00", calories: "", size: "Regular" },
    ],
    validations: [
      { row: 5, field: "price_inc_vat", issue: "Missing price" },
      { row: 7, field: "category", issue: "Unknown category 'Drinks2'" },
      { row: 9, field: "name_ar", issue: "Duplicate product name" },
      { row: 11, field: "vat", issue: "Invalid VAT setting" },
    ],
  },
  { id: "categories", ar: "الفئات", en: "Categories", fields: ["name_ar", "name_en", "order"], sample: [{ name_ar: "قهوة ساخنة", name_en: "Hot Coffee", order: "1" }], validations: [] },
  { id: "addons", ar: "الإضافات", en: "Addons", fields: ["group", "name_ar", "name_en", "price", "required"], sample: [{ group: "Spice", name_ar: "حار", name_en: "Spicy", price: "0", required: "yes" }], validations: [] },
  {
    id: "inventory", ar: "عناصر المخزون", en: "Inventory items",
    fields: ["name_ar", "name_en", "category", "unit", "current_qty", "min_stock", "avg_cost"],
    sample: [{ name_ar: "حبوب بن", name_en: "Coffee beans", category: "Coffee", unit: "كرتون", current_qty: "10", min_stock: "10", avg_cost: "120.00" }],
    validations: [{ row: 3, field: "unit", issue: "Missing unit" }],
  },
  { id: "suppliers", ar: "الموردون", en: "Suppliers", fields: ["name", "phone", "vat", "opening_balance"], sample: [{ name: "محمصة الرياض", phone: "0500000000", vat: "300...", opening_balance: "0" }], validations: [] },
  { id: "employees", ar: "الموظفون", en: "Employees", fields: ["name", "role", "salary", "national_id"], sample: [{ name: "أحمد", role: "Cashier", salary: "3500", national_id: "1xxxxxxxxx" }], validations: [] },
  { id: "customers", ar: "العملاء", en: "Customers", fields: ["name", "phone", "city"], sample: [{ name: "ضيف", phone: "0555555555", city: "مكة" }], validations: [] },
];

/* ───────── Export options ───────── */
export const EXPORT_MODULES = [
  { id: "products", ar: "المنتجات", en: "Products" },
  { id: "categories", ar: "الفئات", en: "Categories" },
  { id: "addons", ar: "الإضافات", en: "Addons" },
  { id: "orders", ar: "الطلبات", en: "Orders" },
  { id: "customers", ar: "العملاء", en: "Customers" },
  { id: "shifts", ar: "الورديات", en: "Shifts" },
  { id: "inventory", ar: "المخزون", en: "Inventory" },
  { id: "suppliers", ar: "الموردون", en: "Suppliers" },
  { id: "purchases", ar: "المشتريات", en: "Purchases" },
  { id: "expenses", ar: "المصاريف", en: "Expenses" },
  { id: "journal", ar: "القيود", en: "Journal entries" },
  { id: "employees", ar: "الموظفون", en: "Employees" },
  { id: "payroll", ar: "الرواتب", en: "Payroll" },
  { id: "activity", ar: "سجل النشاط", en: "Activity logs" },
  { id: "audit", ar: "سجل التدقيق", en: "Audit logs" },
];

/* ───────── Backup ───────── */
export type RestorePoint = {
  id: string;
  date: string;
  size: string;
  status: "success" | "failed" | "partial";
  type: "auto" | "manual";
};
export const RESTORE_POINTS: RestorePoint[] = [
  { id: "BK-2026-05-18", date: "2026-05-18 03:00", size: "42.1 MB", status: "success", type: "auto" },
  { id: "BK-2026-05-17", date: "2026-05-17 03:00", size: "41.8 MB", status: "success", type: "auto" },
  { id: "BK-2026-05-16", date: "2026-05-16 14:22", size: "41.3 MB", status: "success", type: "manual" },
  { id: "BK-2026-05-15", date: "2026-05-15 03:00", size: "—", status: "failed", type: "auto" },
];

/* ───────── Permissions matrix ───────── */
export type PermAction = "view" | "create" | "edit" | "delete" | "approve" | "export";
export const PERM_ROLES = [
  { id: "owner", ar: "الأونر", en: "Owner" },
  { id: "fin", ar: "المدير المالي", en: "Financial Manager" },
  { id: "mgr", ar: "مدير المطعم", en: "Restaurant Manager" },
  { id: "cashier", ar: "الكاشير", en: "Cashier" },
] as const;
export type PermRoleId = typeof PERM_ROLES[number]["id"];

export const PERM_MODULES = [
  { id: "pos", ar: "الكاشير", en: "POS", group: "ops" },
  { id: "orders", ar: "الطلبات", en: "Orders", group: "ops" },
  { id: "refunds", ar: "المرتجعات", en: "Refunds", group: "ops" },
  { id: "shifts", ar: "الورديات", en: "Shifts", group: "ops" },
  { id: "products", ar: "المنتجات", en: "Products", group: "menu" },
  { id: "categories", ar: "الفئات", en: "Categories", group: "menu" },
  { id: "addons", ar: "الإضافات", en: "Addons", group: "menu" },
  { id: "customers", ar: "العملاء", en: "Customers", group: "ops" },
  { id: "suppliers", ar: "الموردون", en: "Suppliers", group: "inv" },
  { id: "purchases", ar: "المشتريات", en: "Purchases", group: "inv" },
  { id: "inventory", ar: "المخزون", en: "Inventory", group: "inv" },
  { id: "waste", ar: "الهدر", en: "Waste", group: "inv" },
  { id: "expenses", ar: "المصاريف", en: "Expenses", group: "fin" },
  { id: "banks", ar: "البنوك", en: "Banks", group: "fin" },
  { id: "journal", ar: "القيود", en: "Journal entries", group: "fin" },
  { id: "employees", ar: "الموظفون", en: "Employees", group: "fin" },
  { id: "salaries", ar: "الرواتب", en: "Salaries", group: "fin" },
  { id: "reports", ar: "التقارير", en: "Reports", group: "fin" },
  { id: "settings", ar: "الإعدادات", en: "Settings", group: "sys" },
  { id: "activity", ar: "سجل النشاط", en: "Activity logs", group: "sys" },
  { id: "audit", ar: "سجل التدقيق", en: "Audit logs", group: "sys" },
] as const;

export const PERM_ACTIONS: PermAction[] = ["view", "create", "edit", "delete", "approve", "export"];

export type PermMatrix = Record<PermRoleId, Record<string, Record<PermAction, boolean>>>;

function buildDefaultMatrix(): PermMatrix {
  const make = (fn: (mod: string, group: string) => Partial<Record<PermAction, boolean>>) =>
    Object.fromEntries(PERM_MODULES.map((m) => {
      const perms = fn(m.id, m.group);
      return [m.id, Object.fromEntries(PERM_ACTIONS.map((a) => [a, !!perms[a]])) as Record<PermAction, boolean>];
    }));
  const allTrue = () => Object.fromEntries(PERM_ACTIONS.map((a) => [a, true])) as Record<PermAction, boolean>;
  return {
    owner: Object.fromEntries(PERM_MODULES.map((m) => [m.id, allTrue()])) as Record<string, Record<PermAction, boolean>>,
    fin: make((_id, g) => g === "fin" ? { view: true, create: true, edit: true, delete: true, approve: true, export: true }
      : g === "sys" || g === "ops" || g === "inv" || g === "menu" ? { view: true, export: g === "sys" } : {}),
    mgr: make((_id, g) => g === "ops" || g === "inv" || g === "menu" ? { view: true, create: true, edit: true, delete: true, approve: true, export: true }
      : g === "sys" ? { view: true } : g === "fin" ? { view: true } : {}),
    cashier: make((id) => id === "pos" || id === "orders" ? { view: true, create: true } : id === "shifts" || id === "customers" ? { view: true, create: true } : {}),
  };
}
export const DEFAULT_PERMISSIONS: PermMatrix = buildDefaultMatrix();

/* ───────── QA checklist ───────── */
export type QAItem = {
  id: string;
  ar: string;
  en: string;
  done: boolean;
  priority: "low" | "med" | "high" | "critical";
  assignee?: string;
  notes?: string;
};
export type QASection = { id: string; ar: string; en: string; items: QAItem[] };

export const QA_SECTIONS: QASection[] = [
  { id: "pos", ar: "اختبار الكاشير", en: "POS QA", items: [
    { id: "q_login", ar: "تسجيل الدخول يعمل", en: "Login works", done: true, priority: "critical" },
    { id: "q_openshift", ar: "فتح الوردية يعمل", en: "Open shift works", done: true, priority: "high" },
    { id: "q_addprod", ar: "إضافة منتج للسلة", en: "Add product works", done: true, priority: "high" },
    { id: "q_reqmod", ar: "ظهور المعدّل الإجباري", en: "Required modifier appears correctly", done: true, priority: "high" },
    { id: "q_removebroast", ar: "ظهور خيارات الحليب لمشروبات القهوة فقط", en: "Milk options only for coffee items", done: true, priority: "high" },
    { id: "q_cart", ar: "إجمالي السلة صحيح", en: "Cart total is correct", done: true, priority: "critical" },
    { id: "q_disc", ar: "الخصم يعمل", en: "Discount works", done: true, priority: "med" },
    { id: "q_pay", ar: "الدفع يعمل", en: "Payment works", done: true, priority: "critical" },
    { id: "q_inv", ar: "معاينة الفاتورة", en: "Invoice preview works", done: true, priority: "high" },
    { id: "q_hold", ar: "تعليق الطلب", en: "Hold order works", done: true, priority: "med" },
    { id: "q_recent", ar: "الطلبات الأخيرة", en: "Recent orders works", done: true, priority: "med" },
    { id: "q_refund", ar: "الاسترجاع يعمل", en: "Refund works", done: true, priority: "high" },
    { id: "q_closeshift", ar: "إغلاق الوردية", en: "Close shift works", done: true, priority: "critical" },
  ]},
  { id: "dash", ar: "اختبار لوحة الإدارة", en: "Dashboard QA", items: [
    { id: "q_dp", ar: "صفحة المنتجات", en: "Products page works", done: true, priority: "high" },
    { id: "q_dc", ar: "صفحة الفئات", en: "Categories page works", done: true, priority: "high" },
    { id: "q_da", ar: "صفحة الإضافات", en: "Addons page works", done: true, priority: "high" },
    { id: "q_du", ar: "صفحة المستخدمين", en: "Users page works", done: true, priority: "high" },
    { id: "q_ds", ar: "صفحة الورديات", en: "Shifts page works", done: true, priority: "high" },
    { id: "q_do", ar: "صفحة الطلبات", en: "Orders page works", done: true, priority: "high" },
    { id: "q_dcu", ar: "صفحة العملاء", en: "Customers page works", done: true, priority: "med" },
    { id: "q_dr", ar: "صفحة التقارير", en: "Reports page works", done: true, priority: "high" },
  ]},
  { id: "inv", ar: "اختبار المخزون", en: "Inventory QA", items: [
    { id: "q_isup", ar: "صفحة الموردين", en: "Suppliers page works", done: true, priority: "high" },
    { id: "q_ipu", ar: "صفحة المشتريات", en: "Purchases page works", done: true, priority: "high" },
    { id: "q_iin", ar: "صفحة المخزون", en: "Inventory page works", done: true, priority: "high" },
    { id: "q_ire", ar: "صفحة الوصفات", en: "Recipes page works", done: false, priority: "high", notes: "ربط وصفة زنجر ناقص" },
    { id: "q_ilow", ar: "تنبيهات الحد الأدنى", en: "Low stock alerts work", done: true, priority: "high" },
    { id: "q_iadj", ar: "تسوية المخزون", en: "Stock adjustment works", done: true, priority: "med" },
    { id: "q_iwaste", ar: "صفحة الهدر", en: "Waste page works", done: true, priority: "med" },
  ]},
  { id: "fin", ar: "اختبار المالية", en: "Finance QA", items: [
    { id: "q_fexp", ar: "صفحة المصاريف", en: "Expenses page works", done: true, priority: "high" },
    { id: "q_fbk", ar: "صفحة البنوك", en: "Banks page works", done: true, priority: "high" },
    { id: "q_fcoa", ar: "دليل الحسابات", en: "Chart of accounts works", done: true, priority: "med" },
    { id: "q_fje", ar: "توازن القيود", en: "Journal balance validation works", done: true, priority: "critical" },
    { id: "q_fsp", ar: "دفعة مورد", en: "Supplier payment works", done: true, priority: "high" },
    { id: "q_femp", ar: "صفحة الموظفين", en: "Employee page works", done: true, priority: "med" },
    { id: "q_fsal", ar: "صفحة الرواتب", en: "Salary page works", done: true, priority: "high" },
  ]},
  { id: "resp", ar: "اختبار التجاوب", en: "Responsive QA", items: [
    { id: "q_tab", ar: "تخطيط التابلت", en: "Tablet layout", done: true, priority: "critical" },
    { id: "q_mob", ar: "تخطيط الجوال", en: "Mobile layout", done: true, priority: "high" },
    { id: "q_desk", ar: "تخطيط سطح المكتب", en: "Desktop layout", done: true, priority: "high" },
    { id: "q_rtl", ar: "RTL", en: "RTL", done: true, priority: "critical" },
    { id: "q_ltr", ar: "LTR", en: "LTR", done: true, priority: "high" },
    { id: "q_light", ar: "الوضع الفاتح", en: "Light mode", done: true, priority: "high" },
    { id: "q_dark", ar: "الوضع الداكن", en: "Dark mode", done: true, priority: "high" },
  ]},
];

/* ───────── Backend readiness ───────── */
export const BACKEND_MODELS = [
  { id: "User", purpose: "حسابات النظام", related: ["Auth", "Permissions"] },
  { id: "Role", purpose: "أدوار النظام", related: ["User"] },
  { id: "Permission", purpose: "صلاحيات الموارد", related: ["Role"] },
  { id: "Product", purpose: "عناصر القائمة", related: ["Category", "ModifierGroup"] },
  { id: "Category", purpose: "تصنيفات المنتجات", related: ["Product"] },
  { id: "ModifierGroup", purpose: "مجموعات الإضافات/الحذف", related: ["Product"] },
  { id: "ModifierOption", purpose: "خيار داخل المجموعة", related: ["ModifierGroup"] },
  { id: "Order", purpose: "طلب POS", related: ["OrderItem", "Payment", "Shift"] },
  { id: "OrderItem", purpose: "صنف داخل الطلب", related: ["Order", "Product"] },
  { id: "Payment", purpose: "دفعة طلب", related: ["Order"] },
  { id: "Shift", purpose: "وردية كاشير", related: ["User", "Order"] },
  { id: "Customer", purpose: "عملاء", related: ["Order"] },
  { id: "Supplier", purpose: "موردون", related: ["PurchaseInvoice"] },
  { id: "PurchaseInvoice", purpose: "فاتورة شراء", related: ["Supplier", "InventoryMovement"] },
  { id: "InventoryItem", purpose: "صنف مخزون", related: ["Recipe", "InventoryMovement"] },
  { id: "InventoryMovement", purpose: "حركة مخزون", related: ["InventoryItem"] },
  { id: "Recipe", purpose: "وصفة منتج", related: ["Product", "InventoryItem"] },
  { id: "Expense", purpose: "مصروف", related: ["BankAccount"] },
  { id: "BankAccount", purpose: "بنك/صندوق", related: ["JournalEntry"] },
  { id: "JournalEntry", purpose: "قيد محاسبي", related: ["BankAccount"] },
  { id: "Employee", purpose: "موظف", related: ["SalaryRecord"] },
  { id: "SalaryRecord", purpose: "كشف راتب", related: ["Employee"] },
  { id: "AuditLog", purpose: "سجل تدقيق", related: ["User"] },
];

export const API_GROUPS = [
  { id: "auth", name: "Auth", endpoints: ["POST /auth/login", "POST /auth/logout", "POST /auth/refresh"] },
  { id: "products", name: "Products", endpoints: ["GET /products", "POST /products", "PATCH /products/{id}", "DELETE /products/{id}"] },
  { id: "orders", name: "Orders", endpoints: ["POST /orders", "GET /orders", "POST /orders/{id}/refund", "POST /orders/{id}/hold"] },
  { id: "shifts", name: "Shifts", endpoints: ["POST /shifts/open", "POST /shifts/close", "GET /shifts/current"] },
  { id: "customers", name: "Customers", endpoints: ["GET /customers", "POST /customers"] },
  { id: "inventory", name: "Inventory", endpoints: ["GET /inventory", "POST /inventory/adjust", "POST /inventory/waste"] },
  { id: "suppliers", name: "Suppliers", endpoints: ["GET /suppliers", "POST /suppliers", "POST /suppliers/{id}/payment"] },
  { id: "purchases", name: "Purchases", endpoints: ["POST /purchases", "GET /purchases"] },
  { id: "finance", name: "Finance", endpoints: ["POST /expenses", "POST /journal", "GET /banks", "POST /payroll/run"] },
  { id: "reports", name: "Reports", endpoints: ["GET /reports/daily-sales", "GET /reports/inventory", "GET /reports/profit"] },
  { id: "settings", name: "Settings", endpoints: ["GET /settings", "PATCH /settings", "GET /permissions"] },
];

export const INTEGRATION_REQS = [
  { ar: "طباعة حرارية عبر المتصفح", en: "Thermal printer browser print" },
  { ar: "قائمة انتظار دون اتصال", en: "Offline queue" },
  { ar: "رفع الملفات", en: "File uploads" },
  { ar: "صلاحيات حسب الدور", en: "Role-based permissions" },
  { ar: "تصدير التقارير", en: "Export reports" },
  { ar: "النسخ الاحتياطي", en: "Backup" },
  { ar: "تكامل زاتكا (مرحلة لاحقة)", en: "Future ZATCA integration" },
];

export const BACKEND_CHECKLIST = [
  { ar: "مخطط قاعدة البيانات", en: "Database schema" },
  { ar: "بنية واجهات API", en: "API structure" },
  { ar: "المصادقة", en: "Authentication" },
  { ar: "وسيط الصلاحيات", en: "Permissions middleware" },
  { ar: "التحقق من المدخلات", en: "Validation" },
  { ar: "معالجة الأخطاء", en: "Error handling" },
  { ar: "سجل التدقيق", en: "Audit logging" },
  { ar: "استراتيجية النسخ", en: "Backup strategy" },
  { ar: "خطة النشر", en: "Deployment plan" },
];
