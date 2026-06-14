
-- ============================================================
-- 1. ORDERS: switch to VAT-inclusive amount columns + new statuses
-- ============================================================

-- Add new VAT-inclusive columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal_before_discount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount         numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_including_vat     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_included_amount     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_excluding_vat numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate                numeric(5,4)  NOT NULL DEFAULT 0.15;

-- Backfill from old columns where present (total already VAT-inclusive in current data? assume yes)
UPDATE public.orders
SET
  subtotal_before_discount = COALESCE(NULLIF(subtotal_before_discount,0), subtotal + discount),
  discount_amount          = COALESCE(NULLIF(discount_amount,0), discount),
  total_including_vat      = COALESCE(NULLIF(total_including_vat,0), total),
  vat_included_amount      = COALESCE(NULLIF(vat_included_amount,0), ROUND(total - (total / 1.15), 2)),
  net_amount_excluding_vat = COALESCE(NULLIF(net_amount_excluding_vat,0), ROUND(total / 1.15, 2))
WHERE TRUE;

-- Drop old columns
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS discount,
  DROP COLUMN IF EXISTS tax,
  DROP COLUMN IF EXISTS total;

-- Extend order_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.order_status'::regtype AND enumlabel = 'held') THEN
    ALTER TYPE public.order_status ADD VALUE 'held';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.order_status'::regtype AND enumlabel = 'partially_refunded') THEN
    ALTER TYPE public.order_status ADD VALUE 'partially_refunded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.order_status'::regtype AND enumlabel = 'refunded') THEN
    ALTER TYPE public.order_status ADD VALUE 'refunded';
  END IF;
END$$;

-- ============================================================
-- 2. PAYMENTS: remove 'transfer' from payment_method enum
-- ============================================================
DO $$
DECLARE
  has_transfer boolean;
  in_use boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.payment_method'::regtype AND enumlabel = 'transfer'
  ) INTO has_transfer;

  IF has_transfer THEN
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE method::text = 'transfer') INTO in_use;
    IF in_use THEN
      UPDATE public.payments SET method = 'card' WHERE method::text = 'transfer';
    END IF;

    -- Rebuild enum without 'transfer'
    ALTER TYPE public.payment_method RENAME TO payment_method_old;
    CREATE TYPE public.payment_method AS ENUM ('cash','card','mada','apple_pay');
    ALTER TABLE public.payments
      ALTER COLUMN method TYPE public.payment_method
      USING method::text::public.payment_method;
    DROP TYPE public.payment_method_old;
  END IF;
END$$;

-- ============================================================
-- 3. HELD ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.held_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id  uuid NOT NULL,
  shift_id    uuid,
  customer_id uuid,
  order_type  public.order_type NOT NULL DEFAULT 'dine_in',
  cart_json   jsonb NOT NULL,
  note        text,
  held_at     timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "held_orders own select"
  ON public.held_orders FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "held_orders own insert"
  ON public.held_orders FOR INSERT TO authenticated
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "held_orders own update"
  ON public.held_orders FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "held_orders own delete"
  ON public.held_orders FOR DELETE TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER touch_held_orders BEFORE UPDATE ON public.held_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_held_orders_cashier ON public.held_orders(cashier_id, held_at DESC);

-- ============================================================
-- 4. CASH DRAWER MOVEMENTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_movement_type') THEN
    CREATE TYPE public.cash_movement_type AS ENUM ('pay_in','pay_out');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.cash_drawer_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL,
  cashier_id  uuid NOT NULL,
  type        public.cash_movement_type NOT NULL,
  amount      numeric(10,2) NOT NULL CHECK (amount > 0),
  reason      text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_drawer_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_mv select scoped"
  ON public.cash_drawer_movements FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));

CREATE POLICY "cash_mv insert by cashier"
  ON public.cash_drawer_movements FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = shift_id AND s.cashier_id = auth.uid() AND s.status = 'open'
    )
  );

CREATE INDEX IF NOT EXISTS idx_cash_mv_shift ON public.cash_drawer_movements(shift_id);

-- ============================================================
-- 5. REFUNDS extensions
-- ============================================================
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method,
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- Allow cashier to insert refunds for own orders (in addition to admin policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='refunds insert by cashier own order'
  ) THEN
    CREATE POLICY "refunds insert by cashier own order"
      ON public.refunds FOR INSERT TO authenticated
      WITH CHECK (
        cashier_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.cashier_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='refunds select own'
  ) THEN
    CREATE POLICY "refunds select own"
      ON public.refunds FOR SELECT TO authenticated
      USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='refund_items' AND policyname='refund_items insert by cashier'
  ) THEN
    CREATE POLICY "refund_items insert by cashier"
      ON public.refund_items FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.refunds r
          WHERE r.id = refund_id AND r.cashier_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Also allow cashier to insert negative payment rows (already allowed via existing "payments insert by cashier")
-- (Existing policy already checks order.cashier_id = auth.uid(), so refund payments work.)

-- ============================================================
-- 6. INDEXES for recent-order search
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_created_desc ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_shift        ON public.orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number     ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order      ON public.payments(order_id);
