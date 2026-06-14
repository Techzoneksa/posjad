
-- 1) New table for device keys / certs
CREATE TABLE IF NOT EXISTS public.zatca_device_keys (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- Encrypted blobs (AES-GCM, base64 ciphertext + iv prefix). Never returned to client.
  private_key_encrypted text,
  private_key_iv text,
  public_key_pem text,
  csr_pem text,
  compliance_request_id text,
  compliance_csid_token_encrypted text,
  compliance_csid_iv text,
  compliance_csid_secret_encrypted text,
  compliance_csid_secret_iv text,
  production_csid_token_encrypted text,
  production_csid_iv text,
  production_csid_secret_encrypted text,
  production_csid_secret_iv text,
  csid_serial_number text,
  csid_issued_at timestamptz,
  csid_expires_at timestamptz,
  last_pih_b64 text, -- previous invoice hash (last successfully reported)
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.zatca_device_keys ENABLE ROW LEVEL SECURITY;
-- Read policy: admin only (private key fields stay server-side; functions return redacted view).
CREATE POLICY "zatca_device_keys_read_admin" ON public.zatca_device_keys
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "zatca_device_keys_write_admin" ON public.zatca_device_keys
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS tg_zatca_device_keys_touch ON public.zatca_device_keys;
CREATE TRIGGER tg_zatca_device_keys_touch BEFORE UPDATE ON public.zatca_device_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.zatca_device_keys (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 2) Extend zatca_settings with sandbox endpoints + CSR identity fields
ALTER TABLE public.zatca_settings
  ADD COLUMN IF NOT EXISTS sandbox_base_url text NOT NULL DEFAULT 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  ADD COLUMN IF NOT EXISTS production_base_url text NOT NULL DEFAULT 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
  ADD COLUMN IF NOT EXISTS compliance_csid_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_csid_at timestamptz,
  ADD COLUMN IF NOT EXISTS csr_common_name text DEFAULT 'Yellow Chicken POS 01',
  ADD COLUMN IF NOT EXISTS csr_serial_number text DEFAULT '1-YC|2-POS|3-01',
  ADD COLUMN IF NOT EXISTS csr_organization_unit text DEFAULT 'Yellow Chicken Branch',
  ADD COLUMN IF NOT EXISTS csr_organization_name text DEFAULT 'Sultan Al-Abdali Restaurants Co.',
  ADD COLUMN IF NOT EXISTS csr_country text DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS csr_invoice_type text DEFAULT '0100',
  ADD COLUMN IF NOT EXISTS csr_location_address text DEFAULT 'Makkah - Al Shawqiya',
  ADD COLUMN IF NOT EXISTS csr_business_category text DEFAULT 'Restaurant';

-- 3) Extend zatca_invoices for PIH chain + signed XML
ALTER TABLE public.zatca_invoices
  ADD COLUMN IF NOT EXISTS invoice_hash_b64 text,
  ADD COLUMN IF NOT EXISTS previous_invoice_hash_b64 text,
  ADD COLUMN IF NOT EXISTS icv integer,
  ADD COLUMN IF NOT EXISTS signed_xml_b64 text,
  ADD COLUMN IF NOT EXISTS cleared_xml_b64 text,
  ADD COLUMN IF NOT EXISTS submitted_endpoint text;

ALTER TABLE public.zatca_credit_notes
  ADD COLUMN IF NOT EXISTS invoice_hash_b64 text,
  ADD COLUMN IF NOT EXISTS previous_invoice_hash_b64 text,
  ADD COLUMN IF NOT EXISTS icv integer,
  ADD COLUMN IF NOT EXISTS signed_xml_b64 text,
  ADD COLUMN IF NOT EXISTS cleared_xml_b64 text,
  ADD COLUMN IF NOT EXISTS submitted_endpoint text;

-- 4) ICV (Invoice Counter Value) sequence — strictly monotonic across docs
CREATE SEQUENCE IF NOT EXISTS public.zatca_icv_seq START 1;

CREATE OR REPLACE FUNCTION public.next_zatca_icv()
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  SELECT nextval('public.zatca_icv_seq')::integer;
$$;
