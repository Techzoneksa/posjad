-- ===== Sprint D — Finance & HR backend =====

-- Enums
DO $$ BEGIN
  CREATE TYPE public.finance_account_type AS ENUM ('cashbox','bank','network');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_movement_type AS ENUM
    ('sale','expense','supplier_payment','salary','cash_in','cash_out','transfer','manual','opening');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.chart_account_type AS ENUM ('asset','liability','revenue','expense','equity');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_source AS ENUM
    ('pos','purchase','supplier_payment','expense','salary','waste','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_status AS ENUM ('draft','posted','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM
    ('salary','electricity','water','internet','rent','ads','license','maintenance','advance','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employee_status AS ENUM ('active','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.salary_status AS ENUM ('unpaid','partial','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adjustment_kind AS ENUM ('advance','deduction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequences for numbering
CREATE SEQUENCE IF NOT EXISTS public.expense_seq         START 1001;
CREATE SEQUENCE IF NOT EXISTS public.supplier_payment_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS public.journal_entry_seq    START 1001;
CREATE SEQUENCE IF NOT EXISTS public.salary_record_seq    START 1001;

-- Numbering helpers (Riyadh date prefix)
CREATE OR REPLACE FUNCTION public.next_expense_number()
RETURNS text LANGUAGE sql SET search_path TO 'public' AS $$
  SELECT 'EXP-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.expense_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_supplier_payment_number()
RETURNS text LANGUAGE sql SET search_path TO 'public' AS $$
  SELECT 'SP-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.supplier_payment_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_journal_number()
RETURNS text LANGUAGE sql SET search_path TO 'public' AS $$
  SELECT 'JE-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.journal_entry_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.next_expense_number()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_supplier_payment_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_journal_number()         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_expense_number()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_supplier_payment_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_journal_number()         TO authenticated;

-- =================== Tables ===================

-- finance_accounts
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  type public.finance_account_type NOT NULL,
  account_code text,
  opening_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- account_movements
CREATE TABLE IF NOT EXISTS public.account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  type public.account_movement_type NOT NULL,
  reference text,
  description text,
  amount_in numeric NOT NULL DEFAULT 0,
  amount_out numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_mv_account_date
  ON public.account_movements(account_id, occurred_at DESC);

-- expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT public.next_expense_number(),
  expense_date timestamptz NOT NULL DEFAULT now(),
  category public.expense_category NOT NULL,
  description text NOT NULL,
  paid_from_account_id uuid NOT NULL REFERENCES public.finance_accounts(id),
  amount numeric NOT NULL,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  attachment_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

-- chart_accounts (simple COA)
CREATE TABLE IF NOT EXISTS public.chart_accounts (
  code text PRIMARY KEY,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  type public.chart_account_type NOT NULL,
  parent_code text REFERENCES public.chart_accounts(code) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- journal_entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT public.next_journal_number(),
  entry_date timestamptz NOT NULL DEFAULT now(),
  source public.journal_source NOT NULL DEFAULT 'manual',
  description text NOT NULL,
  status public.journal_status NOT NULL DEFAULT 'posted',
  attachment_url text,
  reversed_by uuid REFERENCES public.journal_entries(id),
  reverses uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- journal_lines
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_code text NOT NULL REFERENCES public.chart_accounts(code),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry  ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_acct   ON public.journal_lines(account_code);

-- Validation: lines of a posted JE must balance
CREATE OR REPLACE FUNCTION public.assert_journal_balanced(_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d numeric; c numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO d, c
  FROM public.journal_lines WHERE journal_entry_id = _entry_id;
  IF round(d::numeric, 2) <> round(c::numeric, 2) THEN
    RAISE EXCEPTION 'Journal entry % is not balanced (debit=% credit=%)', _entry_id, d, c;
  END IF;
END $$;

-- supplier_payments
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT public.next_supplier_payment_number(),
  paid_at timestamptz NOT NULL DEFAULT now(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  paid_from_account_id uuid NOT NULL REFERENCES public.finance_accounts(id),
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  reference text,
  attachment_url text,
  notes text,
  applied_invoice_id uuid REFERENCES public.purchase_invoices(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sp_supplier_date
  ON public.supplier_payments(supplier_id, paid_at DESC);

-- employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  job_title text NOT NULL,
  mobile text,
  monthly_salary numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Riyadh')::date),
  status public.employee_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- employee_adjustments (advances/deductions, scoped to a payroll month)
CREATE TABLE IF NOT EXISTS public.employee_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind public.adjustment_kind NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  month text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_adj_emp_month
  ON public.employee_adjustments(employee_id, month);

-- salary_records (one per employee per month)
CREATE TABLE IF NOT EXISTS public.salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month text NOT NULL,
  basic numeric NOT NULL DEFAULT 0,
  advances numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  status public.salary_status NOT NULL DEFAULT 'unpaid',
  paid_from_account_id uuid REFERENCES public.finance_accounts(id),
  paid_at timestamptz,
  paid_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month)
);
CREATE INDEX IF NOT EXISTS idx_salary_month ON public.salary_records(month);

-- ===== updated_at triggers =====
DO $$ BEGIN
  CREATE TRIGGER finance_accounts_touch BEFORE UPDATE ON public.finance_accounts
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER expenses_touch BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER chart_accounts_touch BEFORE UPDATE ON public.chart_accounts
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER journal_entries_touch BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER salary_records_touch BEFORE UPDATE ON public.salary_records
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== RLS =====
ALTER TABLE public.finance_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records        ENABLE ROW LEVEL SECURITY;

-- finance_accounts: admin manage; admin+finance read
CREATE POLICY "fa admin manage" ON public.finance_accounts
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "fa finance read" ON public.finance_accounts
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- account_movements: admin+finance read (writes via server fn only)
CREATE POLICY "am admin+finance read" ON public.account_movements
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- expenses: admin manage, finance read
CREATE POLICY "expenses admin manage" ON public.expenses
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "expenses finance read" ON public.expenses
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- chart_accounts: admin manage; everyone authenticated read (used by JE form)
CREATE POLICY "coa admin manage" ON public.chart_accounts
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "coa readable" ON public.chart_accounts
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- journal_entries / lines: admin manage; finance read
CREATE POLICY "je admin manage" ON public.journal_entries
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "je finance read" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "jl admin manage" ON public.journal_lines
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "jl finance read" ON public.journal_lines
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- supplier_payments: admin manage, finance read
CREATE POLICY "sp admin manage" ON public.supplier_payments
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "sp finance read" ON public.supplier_payments
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

-- employees & adjustments & payroll: admin manage; finance read
CREATE POLICY "emp admin manage" ON public.employees
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "emp finance read" ON public.employees
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "emp adj admin manage" ON public.employee_adjustments
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "emp adj finance read" ON public.employee_adjustments
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "salary admin manage" ON public.salary_records
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "salary finance read" ON public.salary_records
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance'::app_role));
