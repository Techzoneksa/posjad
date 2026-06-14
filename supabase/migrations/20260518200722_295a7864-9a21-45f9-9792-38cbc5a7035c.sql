
-- =========================================================
-- Sprint A: restaurant settings + product calories/size
-- =========================================================

-- 1) Restaurant Settings (singleton row, id = true)
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id boolean PRIMARY KEY DEFAULT true,
  legal_name_ar text NOT NULL DEFAULT 'شركة مطاعم سلطان العبدلي لتقديم الوجبات',
  legal_name_en text NOT NULL DEFAULT 'Sultan Al-Abdali Restaurants Co.',
  brand_name_ar text NOT NULL DEFAULT 'يلو تشكن',
  brand_name_en text NOT NULL DEFAULT 'Yellow Chicken',
  branch_ar text NOT NULL DEFAULT 'مكة المكرمة - حي الشوقية',
  branch_en text NOT NULL DEFAULT 'Makkah - Al Shawqiya',
  vat_number text NOT NULL DEFAULT '',
  commercial_registration text NOT NULL DEFAULT '',
  national_address text NOT NULL DEFAULT '',
  vat_rate numeric NOT NULL DEFAULT 0.15,
  prices_include_vat boolean NOT NULL DEFAULT true,
  receipt_width text NOT NULL DEFAULT '80mm',
  printer_type text NOT NULL DEFAULT 'USB',
  print_method text NOT NULL DEFAULT 'browser',
  print_copies integer NOT NULL DEFAULT 2,
  logo_url text,
  footer_note_ar text NOT NULL DEFAULT 'شكرًا لزيارتكم',
  footer_note_en text NOT NULL DEFAULT 'Thank you for your visit',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_settings_singleton CHECK (id = true)
);

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users (cashiers + admins) need to read settings (POS, receipt)
CREATE POLICY "restaurant_settings readable"
  ON public.restaurant_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can write
CREATE POLICY "restaurant_settings write admin"
  ON public.restaurant_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER restaurant_settings_touch
  BEFORE UPDATE ON public.restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the single row
INSERT INTO public.restaurant_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 2) Product extras: calories + size
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS size text;
