
-- Enums
do $$ begin
  create type public.zatca_environment as enum ('simulation','production');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zatca_onboarding_status as enum
    ('not_started','settings_missing','ready_for_otp','otp_entered','onboarding_pending','onboarded','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zatca_invoice_status as enum
    ('pending_generation','generated','pending_sync','synced','failed','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.zatca_doc_type as enum ('invoice','credit_note');
exception when duplicate_object then null; end $$;

-- Settings singleton
create table if not exists public.zatca_settings (
  id boolean primary key default true check (id),
  environment public.zatca_environment not null default 'simulation',
  device_name text not null default 'Yellow Chicken POS 01',
  device_serial text not null default 'YC-POS-01',
  onboarding_status public.zatca_onboarding_status not null default 'not_started',
  csid_reference text,
  csid_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.zatca_settings (id) values (true) on conflict (id) do nothing;

alter table public.zatca_settings enable row level security;

drop policy if exists zatca_settings_read on public.zatca_settings;
create policy zatca_settings_read on public.zatca_settings
  for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'finance'));

drop policy if exists zatca_settings_write on public.zatca_settings;
create policy zatca_settings_write on public.zatca_settings
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Per-invoice ZATCA tracking
create table if not exists public.zatca_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique,
  order_id uuid not null,
  doc_type public.zatca_doc_type not null default 'invoice',
  status public.zatca_invoice_status not null default 'pending_generation',
  environment public.zatca_environment not null default 'simulation',
  qr_payload text,
  xml_hash text,
  zatca_uuid text,
  submitted_at timestamptz,
  response_payload jsonb,
  error_message text,
  retry_count integer not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zatca_invoices_status_idx on public.zatca_invoices(status);
create index if not exists zatca_invoices_order_idx on public.zatca_invoices(order_id);
create index if not exists zatca_invoices_created_idx on public.zatca_invoices(created_at desc);

alter table public.zatca_invoices enable row level security;
drop policy if exists zatca_invoices_read on public.zatca_invoices;
create policy zatca_invoices_read on public.zatca_invoices
  for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'finance'));
-- No client INSERT/UPDATE/DELETE; service role only.

-- Credit notes (refund documents)
create table if not exists public.zatca_credit_notes (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null unique,
  original_invoice_id uuid not null,
  order_id uuid not null,
  amount numeric not null,
  vat_amount numeric not null default 0,
  status public.zatca_invoice_status not null default 'pending_generation',
  environment public.zatca_environment not null default 'simulation',
  qr_payload text,
  xml_hash text,
  zatca_uuid text,
  submitted_at timestamptz,
  response_payload jsonb,
  error_message text,
  retry_count integer not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zatca_credit_notes_status_idx on public.zatca_credit_notes(status);
create index if not exists zatca_credit_notes_orig_idx on public.zatca_credit_notes(original_invoice_id);

alter table public.zatca_credit_notes enable row level security;
drop policy if exists zatca_credit_notes_read on public.zatca_credit_notes;
create policy zatca_credit_notes_read on public.zatca_credit_notes
  for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'finance'));

-- Logs (append-only)
create table if not exists public.zatca_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  event text not null,
  reference_type text,
  reference_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists zatca_logs_created_idx on public.zatca_logs(created_at desc);

alter table public.zatca_logs enable row level security;
drop policy if exists zatca_logs_read on public.zatca_logs;
create policy zatca_logs_read on public.zatca_logs
  for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'finance'));

-- Touch triggers
drop trigger if exists tg_zatca_settings_touch on public.zatca_settings;
create trigger tg_zatca_settings_touch before update on public.zatca_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists tg_zatca_invoices_touch on public.zatca_invoices;
create trigger tg_zatca_invoices_touch before update on public.zatca_invoices
  for each row execute function public.touch_updated_at();

drop trigger if exists tg_zatca_credit_notes_touch on public.zatca_credit_notes;
create trigger tg_zatca_credit_notes_touch before update on public.zatca_credit_notes
  for each row execute function public.touch_updated_at();
