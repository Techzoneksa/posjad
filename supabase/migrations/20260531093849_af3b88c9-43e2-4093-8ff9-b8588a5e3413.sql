
-- These two are referenced inside RLS policies on profiles/user_roles/etc.
-- Without EXECUTE for the calling role, RLS evaluation fails and authenticated users
-- cannot read their own profile/role rows (which broke cashier login).
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
