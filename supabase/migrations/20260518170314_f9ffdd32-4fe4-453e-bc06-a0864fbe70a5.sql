
-- ============================================================
-- Yellow Chicken POS — Backend Phase 1 Schema
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM ('broasted','sandwich','burger','side','drink','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_type AS ENUM ('dine_in','takeaway','delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('new','preparing','ready','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','card','transfer','mada','apple_pay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_type AS ENUM ('full','partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  color text,
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "categories readable by authenticated" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories managed by admins" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  sku text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0.15,
  active boolean NOT NULL DEFAULT true,
  product_type public.product_type NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category_active ON public.products(category_id, active);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "products readable by authenticated" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "products managed by admins" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- ADDON GROUPS
-- ============================================================
CREATE TABLE public.addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_addon_groups_updated BEFORE UPDATE ON public.addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "addon_groups readable" ON public.addon_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "addon_groups managed by admins" ON public.addon_groups
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- ADDONS
-- ============================================================
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_addons_group ON public.addons(group_id);
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_addons_updated BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "addons readable" ON public.addons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "addons managed by admins" ON public.addons
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- PRODUCT <-> ADDON GROUPS
-- ============================================================
CREATE TABLE public.product_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, group_id)
);
CREATE INDEX idx_pag_product ON public.product_addon_groups(product_id);
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pag readable" ON public.product_addon_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pag managed by admins" ON public.product_addon_groups
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text UNIQUE,
  notes text,
  loyalty_points int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "customers readable by authenticated" ON public.customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers insertable by authenticated" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers updatable by authenticated" ON public.customers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "customers deletable by admins" ON public.customers
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_float numeric(10,2) NOT NULL DEFAULT 0,
  closing_cash numeric(10,2),
  expected_cash numeric(10,2),
  variance numeric(10,2),
  status public.shift_status NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_open_shift_per_cashier
  ON public.shifts(cashier_id) WHERE status = 'open';
CREATE INDEX idx_shifts_cashier ON public.shifts(cashier_id);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "shifts own select" ON public.shifts
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "shifts own insert" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "shifts own update" ON public.shifts
  FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================================================
-- ORDER NUMBER SEQUENCE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.order_seq;
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'YC-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.order_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'INV-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.invoice_seq')::text, 4, '0');
$$;

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT public.next_order_number(),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_type public.order_type NOT NULL DEFAULT 'dine_in',
  status public.order_status NOT NULL DEFAULT 'new',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_shift ON public.orders(shift_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_cashier ON public.orders(cashier_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "orders select scoped" ON public.orders
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "orders insert by cashier" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "orders update scoped" ON public.orders
  FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  line_total numeric(10,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items follow order select" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance')))
  );
CREATE POLICY "order_items insert by cashier" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.cashier_id = auth.uid())
  );

-- ============================================================
-- ORDER ITEM ADDONS
-- ============================================================
CREATE TABLE public.order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.addons(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  price_delta_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oia_item ON public.order_item_addons(order_item_id);
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oia follow order select" ON public.order_item_addons
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id
      AND (o.cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance')))
  );
CREATE POLICY "oia insert by cashier" ON public.order_item_addons
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id AND o.cashier_id = auth.uid())
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method public.payment_method NOT NULL,
  amount numeric(10,2) NOT NULL,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON public.payments(order_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments follow order select" ON public.payments
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance')))
  );
CREATE POLICY "payments insert by cashier" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.cashier_id = auth.uid())
  );

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE DEFAULT public.next_invoice_number(),
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  zatca_uuid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "invoices follow order select" ON public.invoices
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance')))
  );
CREATE POLICY "invoices insert by cashier" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.cashier_id = auth.uid())
  );

-- ============================================================
-- REFUNDS
-- ============================================================
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  amount numeric(10,2) NOT NULL,
  type public.refund_type NOT NULL,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refunds_order ON public.refunds(order_id);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds select admins+finance" ON public.refunds
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "refunds insert admins" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refund_items_refund ON public.refund_items(refund_id);
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_items follow refund select" ON public.refund_items
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "refund_items insert admins" ON public.refund_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
