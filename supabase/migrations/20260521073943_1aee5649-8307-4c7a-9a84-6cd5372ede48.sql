ALTER TYPE zatca_invoice_status ADD VALUE IF NOT EXISTS 'local_validation_failed';
ALTER TABLE public.zatca_invoices ADD COLUMN IF NOT EXISTS local_validation_errors jsonb;
ALTER TABLE public.zatca_credit_notes ADD COLUMN IF NOT EXISTS local_validation_errors jsonb;