
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'admin@jaadsa.com'
  )
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products','categories','addons','addon_groups','product_addon_groups',
    'customers','suppliers','employees','inventory_items','expenses',
    'purchase_invoices','purchase_items','waste_records','stock_adjustments',
    'finance_accounts','chart_accounts','supplier_payments','salary_records',
    'employee_adjustments','recipe_ingredients','product_recipes',
    'orders','order_items','order_item_addons','refunds','refund_items',
    'held_orders','shifts','cash_drawer_movements','inventory_movements',
    'journal_entries','journal_lines','payments','invoices',
    'restaurant_settings','user_roles','profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super admin only delete" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "super admin only delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));',
      t
    );
  END LOOP;
END $$;
