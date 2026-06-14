
DROP POLICY IF EXISTS "customers readable by authenticated" ON public.customers;
CREATE POLICY "customers readable by staff" ON public.customers
  FOR SELECT
  USING (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'cashier'::app_role)
  );

DROP POLICY IF EXISTS "products readable by authenticated" ON public.products;
CREATE POLICY "products readable by staff" ON public.products
  FOR SELECT
  USING (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'cashier'::app_role)
  );
