create extension if not exists pgcrypto;

create table if not exists public.cashiers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  username text not null,
  full_name text not null default '',
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cashiers_username_lower_key
  on public.cashiers (lower(username));

alter table public.cashiers enable row level security;

revoke all on public.cashiers from anon, authenticated;

create or replace function public.upsert_cashier_pin(
  p_profile_id uuid,
  p_username text,
  p_full_name text,
  p_pin text default null,
  p_active boolean default true
)
returns public.cashiers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cashiers;
  v_pin_hash text;
begin
  if p_profile_id is null or nullif(trim(p_username), '') is null then
    raise exception 'profile_id and username are required';
  end if;

  if p_pin is not null and length(trim(p_pin)) < 4 then
    raise exception 'PIN must be at least 4 characters';
  end if;

  select pin_hash
  into v_pin_hash
  from public.cashiers
  where profile_id = p_profile_id;

  v_pin_hash := case
    when p_pin is not null then crypt(trim(p_pin), gen_salt('bf'))
    when v_pin_hash is not null then v_pin_hash
    else crypt(gen_random_uuid()::text, gen_salt('bf'))
  end;

  insert into public.cashiers (profile_id, username, full_name, pin_hash, active)
  values (
    p_profile_id,
    lower(trim(p_username)),
    coalesce(nullif(trim(p_full_name), ''), trim(p_username)),
    v_pin_hash,
    coalesce(p_active, true)
  )
  on conflict (profile_id) do update
  set
    username = excluded.username,
    full_name = excluded.full_name,
    pin_hash = excluded.pin_hash,
    active = excluded.active,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.verify_cashier_pin(
  p_username text,
  p_pin text
)
returns table (
  cashier_id uuid,
  profile_id uuid,
  username text,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as cashier_id,
    c.profile_id,
    c.username,
    c.full_name
  from public.cashiers c
  where lower(c.username) = lower(trim(p_username))
    and c.active = true
    and c.pin_hash = crypt(trim(p_pin), c.pin_hash)
  limit 1;
$$;

revoke execute on function public.upsert_cashier_pin(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.verify_cashier_pin(text, text) from public, anon, authenticated;

grant execute on function public.upsert_cashier_pin(uuid, text, text, text, boolean) to service_role;
grant execute on function public.verify_cashier_pin(text, text) to service_role;

notify pgrst, 'reload schema';
