-- Tighten EXECUTE privileges on SECURITY DEFINER functions.

-- Trigger-only functions: no caller should be able to invoke them directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()   FROM PUBLIC, anon, authenticated;

-- RLS helper functions: keep executable for authenticated (needed by policies),
-- but remove from PUBLIC/anon.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin(uuid)                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;