ALTER TABLE public.zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_http_status integer,
  ADD COLUMN IF NOT EXISTS zatca_response_code text,
  ADD COLUMN IF NOT EXISTS zatca_response_message text,
  ADD COLUMN IF NOT EXISTS zatca_validation_errors jsonb,
  ADD COLUMN IF NOT EXISTS zatca_warnings jsonb,
  ADD COLUMN IF NOT EXISTS zatca_raw_response jsonb,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE public.zatca_credit_notes
  ADD COLUMN IF NOT EXISTS zatca_http_status integer,
  ADD COLUMN IF NOT EXISTS zatca_response_code text,
  ADD COLUMN IF NOT EXISTS zatca_response_message text,
  ADD COLUMN IF NOT EXISTS zatca_validation_errors jsonb,
  ADD COLUMN IF NOT EXISTS zatca_warnings jsonb,
  ADD COLUMN IF NOT EXISTS zatca_raw_response jsonb,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

CREATE INDEX IF NOT EXISTS zatca_invoices_last_error_at_idx
  ON public.zatca_invoices(last_error_at desc)
  WHERE last_error_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS zatca_credit_notes_last_error_at_idx
  ON public.zatca_credit_notes(last_error_at desc)
  WHERE last_error_at IS NOT NULL;