-- Ensure the existing Supabase Auth user can enter JAAD CLOUD with full access.
-- This does not create an auth user and does not set or change passwords.

DO $$
DECLARE
  v_user_id uuid;
  v_username text := 'pos';
BEGIN
  SELECT id
    INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('pos@jaadscloud.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Auth user pos@jaadscloud.com was not found; skipping profile/role seed.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = v_username
      AND id <> v_user_id
  ) THEN
    v_username := 'pos_' || substr(v_user_id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (id, full_name, username, active)
  VALUES (v_user_id, 'المدير المالي', v_username, true)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      username = EXCLUDED.username,
      active = true,
      updated_at = now();

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND role <> 'owner'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
