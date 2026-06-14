create table if not exists public.zatca_invoice_queue (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  zatca_invoice_id uuid null references public.zatca_invoices(id) on delete set null,
  doc_type text not null default 'invoice' check (doc_type in ('invoice','credit_note','debit_note')),
  status text not null default 'queued' check (status in ('queued','processing','submitted','failed','skipped')),
  priority integer not null default 0,
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id)
);

create index if not exists zatca_invoice_queue_poll_idx
  on public.zatca_invoice_queue (status, run_after, priority desc, created_at asc);

create index if not exists zatca_invoice_queue_zatca_invoice_idx
  on public.zatca_invoice_queue (zatca_invoice_id);

grant select on public.zatca_invoice_queue to authenticated;
grant all on public.zatca_invoice_queue to service_role;

alter table public.zatca_invoice_queue enable row level security;

drop policy if exists "zatca_invoice_queue: finance read" on public.zatca_invoice_queue;
create policy "zatca_invoice_queue: finance read"
  on public.zatca_invoice_queue
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public.has_role(auth.uid(), 'finance'::public.app_role)
  );

drop trigger if exists trg_zatca_invoice_queue_touch on public.zatca_invoice_queue;
create trigger trg_zatca_invoice_queue_touch
  before update on public.zatca_invoice_queue
  for each row execute function public.touch_updated_at();
