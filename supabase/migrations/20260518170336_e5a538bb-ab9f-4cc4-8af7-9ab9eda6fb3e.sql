
-- Replace permissive customers policies
DROP POLICY IF EXISTS "customers insertable by authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers updatable by authenticated" ON public.customers;

CREATE POLICY "customers insert by staff" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(),'finance')
    OR public.has_role(auth.uid(),'cashier')
  );

CREATE POLICY "customers update by staff" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(),'finance')
    OR public.has_role(auth.uid(),'cashier')
  );

-- Convert number generators to SECURITY INVOKER + grant sequence usage
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'YC-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.order_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'INV-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.invoice_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.next_order_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

GRANT USAGE ON SEQUENCE public.order_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.invoice_seq TO authenticated;
