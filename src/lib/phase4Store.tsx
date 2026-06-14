"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_ACCOUNTS, INITIAL_MOVEMENTS, INITIAL_EXPENSES, INITIAL_CHART,
  INITIAL_JOURNAL, INITIAL_SUPPLIER_PAYMENTS, INITIAL_EMPLOYEES, INITIAL_SALARIES,
  EXPENSE_CATEGORIES,
  type FinanceAccount, type BankMovement, type Expense, type ChartAccount,
  type JournalEntry, type JournalLine, type SupplierPayment,
  type Employee, type EmployeeAdjustment, type SalaryRecord,
} from "./phase4Data";
import { usePhase3 } from "./phase3Store";

const uid = () => Math.random().toString(36).slice(2, 10);

type Ctx = {
  accounts: FinanceAccount[];
  movements: BankMovement[];
  expenses: Expense[];
  chart: ChartAccount[];
  journal: JournalEntry[];
  supplierPayments: SupplierPayment[];
  employees: Employee[];
  salaries: SalaryRecord[];

  addExpense: (e: Omit<Expense, "id" | "number">) => Expense;
  addTransfer: (p: { fromId: string; toId: string; amount: number; date: number; notes?: string; user: string }) => void;
  addManualMovement: (m: Omit<BankMovement, "id" | "balance">) => void;

  addChartAccount: (a: Omit<ChartAccount, "balance">) => void;
  updateChartAccount: (code: string, patch: Partial<ChartAccount>) => void;

  addJournalEntry: (j: Omit<JournalEntry, "id" | "number">) => JournalEntry;
  reverseJournalEntry: (id: string, user: string) => void;

  addSupplierPayment: (p: Omit<SupplierPayment, "id" | "number">) => SupplierPayment;

  addEmployee: (e: Omit<Employee, "id" | "advances" | "deductions">) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  addAdvance: (employeeId: string, amount: number, notes?: string) => void;
  addDeduction: (employeeId: string, amount: number, notes?: string) => void;

  paySalary: (id: string, paidFromAccountId: string, paidDate: number, notes?: string) => void;
  regeneratePayrollMonth: (month: string) => void;
};

const C = createContext<Ctx | null>(null);

let expCounter = 1007;
let jeCounter = 2007;
let spCounter = 503;
let empCounter = 6;
let prCounter = 11;

export function Phase4Provider({ children }: { children: ReactNode }) {
  const phase3 = usePhase3();
  const [accounts, setAccounts] = useState<FinanceAccount[]>(INITIAL_ACCOUNTS);
  const [movements, setMovements] = useState<BankMovement[]>(INITIAL_MOVEMENTS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [chart, setChart] = useState<ChartAccount[]>(INITIAL_CHART);
  const [journal, setJournal] = useState<JournalEntry[]>(INITIAL_JOURNAL);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(INITIAL_SUPPLIER_PAYMENTS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [salaries, setSalaries] = useState<SalaryRecord[]>(INITIAL_SALARIES);

  const value = useMemo<Ctx>(() => {
    const adjustAccount = (id: string, deltaIn: number, deltaOut: number, when: number) => {
      setAccounts((arr) => arr.map((a) =>
        a.id === id
          ? { ...a, balance: a.balance + deltaIn - deltaOut, lastMovementAt: when }
          : a,
      ));
    };
    const acctCodeOf = (id: string) => accounts.find((a) => a.id === id)?.accountCode || "1010";
    const acctLabel = (id: string) => accounts.find((a) => a.id === id);

    const pushMovement = (m: Omit<BankMovement, "id" | "balance">) => {
      setMovements((arr) => {
        const last = arr.find((x) => x.accountId === m.accountId);
        const baseBal = last ? last.balance : (accounts.find((a) => a.id === m.accountId)?.balance ?? 0);
        const balance = baseBal + m.in - m.out;
        return [{ ...m, id: `bm_${uid()}`, balance }, ...arr];
      });
    };

    const pushJournal = (j: Omit<JournalEntry, "id" | "number">): JournalEntry => {
      const number = `JE-${jeCounter++}`;
      const je: JournalEntry = { ...j, id: number, number };
      setJournal((arr) => [je, ...arr]);
      return je;
    };

    return {
      accounts, movements, expenses, chart, journal,
      supplierPayments, employees, salaries,

      addExpense: (e) => {
        const number = `EXP-${expCounter++}`;
        const exp: Expense = { ...e, id: number, number };
        setExpenses((arr) => [exp, ...arr]);
        adjustAccount(e.paidFromAccountId, 0, e.total, e.date);
        pushMovement({
          accountId: e.paidFromAccountId, date: e.date, type: "expense", ref: number,
          description: e.description, in: 0, out: e.total, user: e.createdBy,
          notes: e.notes, attachment: e.attachment,
        });
        const cat = EXPENSE_CATEGORIES.find((c) => c.id === e.categoryId);
        const lines: JournalLine[] = [
          { accountCode: cat?.accountCode || "5090", debit: e.amount, credit: 0 },
        ];
        if (e.vat > 0) lines.push({ accountCode: "2020", debit: e.vat, credit: 0, notes: "ضريبة مدخلات" });
        lines.push({ accountCode: acctCodeOf(e.paidFromAccountId), debit: 0, credit: e.total });
        pushJournal({
          date: e.date, source: "expense",
          description: `قيد مصروف ${cat ? cat.ar : ""} - ${number}`,
          lines, status: "posted", attachment: e.attachment, createdBy: e.createdBy,
        });
        return exp;
      },

      addTransfer: ({ fromId, toId, amount, date, notes, user }) => {
        const ref = `TRF-${uid().slice(0, 6).toUpperCase()}`;
        const fromLabel = acctLabel(fromId);
        const toLabel = acctLabel(toId);
        adjustAccount(fromId, 0, amount, date);
        adjustAccount(toId, amount, 0, date);
        pushMovement({
          accountId: fromId, date, type: "transfer", ref,
          description: `تحويل إلى ${toLabel?.ar ?? ""}`, in: 0, out: amount, user, notes,
        });
        pushMovement({
          accountId: toId, date, type: "transfer", ref,
          description: `تحويل من ${fromLabel?.ar ?? ""}`, in: amount, out: 0, user, notes,
        });
        pushJournal({
          date, source: "manual", description: `تحويل بين الحسابات - ${ref}`,
          lines: [
            { accountCode: acctCodeOf(toId), debit: amount, credit: 0 },
            { accountCode: acctCodeOf(fromId), debit: 0, credit: amount },
          ],
          status: "posted", createdBy: user,
        });
      },

      addManualMovement: (m) => {
        const delta = m.in - m.out;
        adjustAccount(m.accountId, m.in, m.out, m.date);
        pushMovement(m);
        if (delta !== 0) {
          pushJournal({
            date: m.date, source: "manual", description: `${m.description} (تسوية يدوية)`,
            lines: delta > 0
              ? [
                  { accountCode: acctCodeOf(m.accountId), debit: delta, credit: 0 },
                  { accountCode: "3010", debit: 0, credit: delta, notes: "تسوية رصيد" },
                ]
              : [
                  { accountCode: "3010", debit: -delta, credit: 0, notes: "تسوية رصيد" },
                  { accountCode: acctCodeOf(m.accountId), debit: 0, credit: -delta },
                ],
            status: "posted", createdBy: m.user, attachment: m.attachment,
          });
        }
      },

      addChartAccount: (a) =>
        setChart((arr) => [...arr, { ...a, balance: 0 }]),
      updateChartAccount: (code, patch) =>
        setChart((arr) => arr.map((c) => (c.code === code ? { ...c, ...patch } : c))),

      addJournalEntry: (j) => pushJournal(j),
      reverseJournalEntry: (id, user) => {
        const orig = journal.find((j) => j.id === id);
        if (!orig) return;
        setJournal((arr) => arr.map((j) => (j.id === id ? { ...j, status: "reversed" } : j)));
        const number = `JE-${jeCounter++}`;
        const reversed: JournalEntry = {
          id: number, number, date: Date.now(), source: "manual",
          description: `عكس القيد ${orig.number}`,
          lines: orig.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit, notes: l.notes })),
          status: "posted", createdBy: user,
        };
        setJournal((arr) => [reversed, ...arr]);
      },

      addSupplierPayment: (p) => {
        const number = `SP-${spCounter++}`;
        const sp: SupplierPayment = { ...p, id: number, number };
        setSupplierPayments((arr) => [sp, ...arr]);
        adjustAccount(p.paidFromAccountId, 0, p.amount, p.date);
        const supplier = phase3.suppliers.find((s) => s.id === p.supplierId);
        if (supplier) {
          phase3.updateSupplier(supplier.id, {
            outstanding: Math.max(0, supplier.outstanding - p.amount),
          });
        }
        pushMovement({
          accountId: p.paidFromAccountId, date: p.date, type: "supplier_payment",
          ref: number, description: `دفعة - ${supplier?.name ?? ""}`,
          in: 0, out: p.amount, user: p.createdBy, notes: p.notes, attachment: p.attachment,
        });
        pushJournal({
          date: p.date, source: "supplier_payment",
          description: `قيد دفعة لمورد ${supplier?.name ?? ""} - ${number}`,
          lines: [
            { accountCode: "2010", debit: p.amount, credit: 0, notes: supplier?.name },
            { accountCode: acctCodeOf(p.paidFromAccountId), debit: 0, credit: p.amount },
          ],
          status: "posted", attachment: p.attachment, createdBy: p.createdBy,
        });
        return sp;
      },

      addEmployee: (e) => {
        const id = `EMP-${empCounter++}`;
        setEmployees((arr) => [...arr, { ...e, id, advances: [], deductions: [] }]);
      },
      updateEmployee: (id, patch) =>
        setEmployees((arr) => arr.map((e) => (e.id === id ? { ...e, ...patch } : e))),

      addAdvance: (employeeId, amount, notes) => {
        const adj: EmployeeAdjustment = { id: uid(), date: Date.now(), amount, notes };
        setEmployees((arr) =>
          arr.map((e) => (e.id === employeeId ? { ...e, advances: [adj, ...e.advances] } : e)),
        );
      },
      addDeduction: (employeeId, amount, notes) => {
        const adj: EmployeeAdjustment = { id: uid(), date: Date.now(), amount, notes };
        setEmployees((arr) =>
          arr.map((e) => (e.id === employeeId ? { ...e, deductions: [adj, ...e.deductions] } : e)),
        );
      },

      paySalary: (id, paidFromAccountId, paidDate, notes) => {
        const rec = salaries.find((s) => s.id === id);
        if (!rec) return;
        setSalaries((arr) =>
          arr.map((s) =>
            s.id === id
              ? { ...s, status: "paid", paidFromAccountId, paidDate, paidAmount: s.net, notes }
              : s,
          ),
        );
        adjustAccount(paidFromAccountId, 0, rec.net, paidDate);
        const employee = employees.find((e) => e.id === rec.employeeId);
        pushMovement({
          accountId: paidFromAccountId, date: paidDate, type: "salary",
          ref: rec.id, description: `راتب ${employee?.name ?? ""} - ${rec.month}`,
          in: 0, out: rec.net, user: "فهد ناصر", notes,
        });
        pushJournal({
          date: paidDate, source: "salary",
          description: `قيد راتب ${employee?.name ?? ""} - ${rec.month}`,
          lines: [
            { accountCode: "5020", debit: rec.basic, credit: 0, notes: "أساسي" },
            ...(rec.deductions > 0
              ? [{ accountCode: "4020", debit: 0, credit: rec.deductions, notes: "استقطاعات" } as JournalLine]
              : []),
            ...(rec.advances > 0
              ? [{ accountCode: "1110", debit: 0, credit: rec.advances, notes: "تسوية سلفة" } as JournalLine]
              : []),
            { accountCode: acctCodeOf(paidFromAccountId), debit: 0, credit: rec.net },
          ],
          status: "posted", createdBy: "فهد ناصر",
        });
      },

      regeneratePayrollMonth: (month) => {
        setSalaries((arr) => {
          const existing = arr.filter((s) => s.month === month);
          if (existing.length > 0) return arr; // don't regenerate over existing
          const fresh = employees
            .filter((e) => e.status === "active")
            .map<SalaryRecord>((e) => {
              const adv = e.advances.reduce((s, a) => s + a.amount, 0);
              const ded = e.deductions.reduce((s, a) => s + a.amount, 0);
              return {
                id: `PR-${String(prCounter++).padStart(3, "0")}`,
                month, employeeId: e.id, basic: e.monthlySalary,
                advances: adv, deductions: ded,
                net: Math.max(0, e.monthlySalary - adv - ded),
                status: "unpaid",
              };
            });
          return [...fresh, ...arr];
        });
      },
    };
  }, [accounts, movements, expenses, chart, journal, supplierPayments, employees, salaries, phase3]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const usePhase4 = () => {
  const c = useContext(C);
  if (!c) throw new Error("Phase4Provider missing");
  return c;
};
