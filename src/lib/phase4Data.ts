/* Phase 4 — Expenses, Banks, Chart of Accounts, Journal Entries,
   Supplier Payments, Employees, Payroll, Financial Reports.
   Frontend / local-state only. No backend, no DB, no real accounting engine. */

export type ExpenseCategoryId =
  | "salary" | "electricity" | "water" | "internet" | "rent"
  | "ads" | "license" | "maintenance" | "advance" | "other";

export const EXPENSE_CATEGORIES: { id: ExpenseCategoryId; ar: string; en: string; accountCode: string }[] = [
  { id: "salary", ar: "رواتب", en: "Salaries", accountCode: "5020" },
  { id: "electricity", ar: "كهرباء", en: "Electricity", accountCode: "5030" },
  { id: "water", ar: "ماء", en: "Water", accountCode: "5030" },
  { id: "internet", ar: "إنترنت", en: "Internet", accountCode: "5030" },
  { id: "rent", ar: "إيجار", en: "Rent", accountCode: "5040" },
  { id: "ads", ar: "إعلانات", en: "Advertising", accountCode: "5050" },
  { id: "license", ar: "تراخيص", en: "Licenses", accountCode: "5060" },
  { id: "maintenance", ar: "صيانة", en: "Maintenance", accountCode: "5070" },
  { id: "advance", ar: "سلفة عامل", en: "Employee Advance", accountCode: "1110" },
  { id: "other", ar: "مصاريف أخرى", en: "Other Expenses", accountCode: "5090" },
];

export type AccountType = "cashbox" | "bank" | "network";

export type FinanceAccount = {
  id: string;
  ar: string;
  en: string;
  type: AccountType;
  accountCode: string; // links to chart of accounts
  openingBalance: number;
  balance: number;
  lastMovementAt?: number;
};

export type BankMovementType =
  | "sale" | "expense" | "supplier_payment" | "salary"
  | "cash_in" | "cash_out" | "transfer" | "manual";

export type BankMovement = {
  id: string;
  date: number;
  accountId: string;
  type: BankMovementType;
  ref: string;
  description: string;
  in: number;
  out: number;
  balance: number;
  user: string;
  notes?: string;
  attachment?: string;
};

export type Expense = {
  id: string;
  number: string;
  date: number;
  categoryId: ExpenseCategoryId;
  description: string;
  paidFromAccountId: string;
  amount: number;
  vat: number;
  total: number;
  attachment?: string;
  createdBy: string;
  notes?: string;
};

export type ChartAccountType = "asset" | "liability" | "revenue" | "expense" | "equity";

export type ChartAccount = {
  code: string;
  ar: string;
  en: string;
  type: ChartAccountType;
  parent?: string;
  balance: number;
  active: boolean;
};

export type JournalSource =
  | "pos" | "purchase" | "supplier_payment"
  | "expense" | "salary" | "waste" | "manual";

export type JournalStatus = "posted" | "draft" | "reversed";

export type JournalLine = {
  accountCode: string;
  debit: number;
  credit: number;
  notes?: string;
};

export type JournalEntry = {
  id: string;
  number: string;
  date: number;
  source: JournalSource;
  description: string;
  lines: JournalLine[];
  status: JournalStatus;
  attachment?: string;
  createdBy: string;
};

export type SupplierPayment = {
  id: string;
  number: string;
  date: number;
  supplierId: string;
  paidFromAccountId: string;
  amount: number;
  method: "cash" | "bank";
  reference?: string;
  attachment?: string;
  notes?: string;
  createdBy: string;
};

export type EmployeeStatus = "active" | "disabled";

export type EmployeeAdjustment = {
  id: string;
  date: number;
  amount: number;
  notes?: string;
};

export type Employee = {
  id: string;
  name: string;
  jobTitle: string;
  mobile: string;
  monthlySalary: number;
  startDate: number;
  status: EmployeeStatus;
  notes?: string;
  advances: EmployeeAdjustment[];
  deductions: EmployeeAdjustment[];
};

export const JOB_TITLES: { id: string; ar: string; en: string }[] = [
  { id: "cashier", ar: "كاشير", en: "Cashier" },
  { id: "manager", ar: "مدير مطعم", en: "Restaurant Manager" },
  { id: "accountant", ar: "محاسب", en: "Accountant" },
  { id: "prep", ar: "عامل تحضير", en: "Prep Worker" },
  { id: "cleaner", ar: "عامل نظافة", en: "Cleaner" },
  { id: "chef", ar: "شيف", en: "Chef" },
];

export type SalaryStatus = "unpaid" | "paid" | "partial";

export type SalaryRecord = {
  id: string;
  month: string; // "YYYY-MM"
  employeeId: string;
  basic: number;
  advances: number;
  deductions: number;
  net: number;
  status: SalaryStatus;
  paidFromAccountId?: string;
  paidDate?: number;
  paidAmount?: number;
  notes?: string;
};

/* ───── Seeds ───── */
const now = Date.now();
const hours = (h: number) => now - h * 3600 * 1000;
const days = (d: number) => now - d * 86400 * 1000;

const monthKey = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const CUR_MONTH = monthKey(0);
export const PREV_MONTH = monthKey(1);

export const INITIAL_ACCOUNTS: FinanceAccount[] = [];

export const INITIAL_MOVEMENTS: BankMovement[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_CHART: ChartAccount[] = [
  // Assets
  { code: "1000", ar: "الأصول", en: "Assets", type: "asset", balance: 0, active: true },
  { code: "1010", ar: "الصندوق / النقدية", en: "Cash on hand", type: "asset", parent: "1000", balance: 7340, active: true },
  { code: "1020", ar: "البنك الأهلي", en: "Al Ahli Bank", type: "asset", parent: "1000", balance: 28450, active: true },
  { code: "1030", ar: "بنك الراجحي", en: "Al Rajhi Bank", type: "asset", parent: "1000", balance: 9800, active: true },
  { code: "1040", ar: "جهاز الشبكة / مدى", en: "Mada Terminal", type: "asset", parent: "1000", balance: 1850, active: true },
  { code: "1100", ar: "المخزون", en: "Inventory", type: "asset", parent: "1000", balance: 6840, active: true },
  { code: "1110", ar: "سلف الموظفين", en: "Employee Advances", type: "asset", parent: "1000", balance: 500, active: true },
  // Liabilities
  { code: "2000", ar: "الخصوم", en: "Liabilities", type: "liability", balance: 0, active: true },
  { code: "2010", ar: "الموردون", en: "Accounts Payable", type: "liability", parent: "2000", balance: 7100, active: true },
  { code: "2020", ar: "ضريبة القيمة المضافة المستحقة", en: "VAT Payable", type: "liability", parent: "2000", balance: 2340, active: true },
  { code: "2030", ar: "رواتب مستحقة", en: "Salaries Payable", type: "liability", parent: "2000", balance: 18500, active: true },
  // Revenue
  { code: "4000", ar: "الإيرادات", en: "Revenue", type: "revenue", balance: 0, active: true },
  { code: "4010", ar: "المبيعات", en: "Sales", type: "revenue", parent: "4000", balance: 42830, active: true },
  { code: "4020", ar: "خصومات المبيعات", en: "Sales Discounts", type: "revenue", parent: "4000", balance: 640, active: true },
  { code: "4030", ar: "مردودات المبيعات", en: "Sales Returns", type: "revenue", parent: "4000", balance: 285, active: true },
  // Expenses
  { code: "5000", ar: "المصروفات", en: "Expenses", type: "expense", balance: 0, active: true },
  { code: "5010", ar: "المشتريات", en: "Purchases / COGS", type: "expense", parent: "5000", balance: 7066.75, active: true },
  { code: "5020", ar: "الرواتب", en: "Salaries", type: "expense", parent: "5000", balance: 0, active: true },
  { code: "5030", ar: "الكهرباء والمياه والإنترنت", en: "Utilities & Internet", type: "expense", parent: "5000", balance: 1800, active: true },
  { code: "5040", ar: "الإيجار", en: "Rent", type: "expense", parent: "5000", balance: 4500, active: true },
  { code: "5050", ar: "الإعلانات", en: "Advertising", type: "expense", parent: "5000", balance: 800, active: true },
  { code: "5060", ar: "التراخيص", en: "Licenses", type: "expense", parent: "5000", balance: 0, active: true },
  { code: "5070", ar: "الصيانة", en: "Maintenance", type: "expense", parent: "5000", balance: 320, active: true },
  { code: "5080", ar: "الهدر والتالف", en: "Waste / Damaged Goods", type: "expense", parent: "5000", balance: 840, active: true },
  { code: "5090", ar: "مصاريف أخرى", en: "Other Expenses", type: "expense", parent: "5000", balance: 0, active: true },
  // Equity
  { code: "3000", ar: "حقوق الملكية", en: "Equity", type: "equity", balance: 0, active: true },
  { code: "3010", ar: "رأس المال", en: "Capital", type: "equity", parent: "3000", balance: 50000, active: true },
  { code: "3020", ar: "مسحوبات المالك", en: "Owner Drawings", type: "equity", parent: "3000", balance: 0, active: true },
];

export const INITIAL_JOURNAL: JournalEntry[] = [];

export const INITIAL_SUPPLIER_PAYMENTS: SupplierPayment[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_SALARIES: SalaryRecord[] = [];

export const MOVEMENT_TYPE_LABEL: Record<BankMovementType, { ar: string; en: string }> = {
  sale: { ar: "مبيعات", en: "Sale" },
  expense: { ar: "مصروف", en: "Expense" },
  supplier_payment: { ar: "دفعة مورد", en: "Supplier Payment" },
  salary: { ar: "راتب", en: "Salary" },
  cash_in: { ar: "إيداع نقدي", en: "Cash Deposit" },
  cash_out: { ar: "سحب نقدي", en: "Cash Withdrawal" },
  transfer: { ar: "تحويل", en: "Transfer" },
  manual: { ar: "تسوية يدوية", en: "Manual Adjustment" },
};

export const JOURNAL_SOURCE_LABEL: Record<JournalSource, { ar: string; en: string }> = {
  pos: { ar: "مبيعات POS", en: "POS Sale" },
  purchase: { ar: "فاتورة شراء", en: "Purchase Invoice" },
  supplier_payment: { ar: "دفعة مورد", en: "Supplier Payment" },
  expense: { ar: "مصروف", en: "Expense" },
  salary: { ar: "راتب", en: "Salary Payment" },
  waste: { ar: "هدر", en: "Stock Waste" },
  manual: { ar: "قيد يدوي", en: "Manual Entry" },
};
