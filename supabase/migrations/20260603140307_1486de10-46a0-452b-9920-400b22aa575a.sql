-- Promote abanurcreate@gmail.com to owner (full permissions)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM auth.users WHERE email='abanurcreate@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove other (lesser) roles to make 'owner' the sole role
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email='abanurcreate@gmail.com')
  AND role <> 'owner';