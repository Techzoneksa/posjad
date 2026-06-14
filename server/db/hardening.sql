-- JAAD CLOUD database hardening layer.
-- Apply this after the historical Supabase migrations on a clean instance.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('owner'::public.app_role, 'manager'::public.app_role)
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

comment on function public.has_role(uuid, public.app_role)
  is 'SECURITY DEFINER role helper used by RLS policies without recursive reads against user_roles.';
comment on function public.is_admin(uuid)
  is 'SECURITY DEFINER admin helper used by RLS policies without recursive reads against user_roles.';

do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
      and tablename <> '_jaad_migration_history'
  loop
    execute format('alter table %I.%I enable row level security', table_record.schemaname, table_record.tablename);
  end loop;
end $$;
