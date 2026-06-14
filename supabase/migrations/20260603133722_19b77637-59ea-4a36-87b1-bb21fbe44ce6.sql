
-- Revoke public/anon EXECUTE on SECURITY DEFINER helper; restrict to authenticated callers used by RLS
REVOKE EXECUTE ON FUNCTION public.is_admin_or_finance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_finance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_finance(uuid) TO authenticated, service_role;

-- Allow finance role to read product images (parity with finance read access to products)
DROP POLICY IF EXISTS product_images_read_staff ON storage.objects;
CREATE POLICY product_images_read_staff ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'finance'::public.app_role)
      OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    )
  );
