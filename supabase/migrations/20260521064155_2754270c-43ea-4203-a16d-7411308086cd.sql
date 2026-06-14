ALTER TYPE public.zatca_invoice_status ADD VALUE IF NOT EXISTS 'signed';
ALTER TYPE public.zatca_invoice_status ADD VALUE IF NOT EXISTS 'submitting';
ALTER TYPE public.zatca_invoice_status ADD VALUE IF NOT EXISTS 'sent';