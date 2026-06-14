
-- Switch sequence helpers from SECURITY DEFINER to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT 'YC-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.order_seq')::text, 4, '0');
$function$;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT 'INV-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYYMMDD') || '-'
         || lpad(nextval('public.invoice_seq')::text, 4, '0');
$function$;

GRANT USAGE ON SEQUENCE public.order_seq   TO authenticated;
GRANT USAGE ON SEQUENCE public.invoice_seq TO authenticated;
