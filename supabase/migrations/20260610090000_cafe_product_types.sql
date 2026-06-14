-- Extend product_type enum with cafe categories so Maher Cafe POS can save
-- products under hot coffee / cold coffee / tea / cakes / pastry.
-- Keeps existing legacy values to avoid breaking historical rows.
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'hot';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'cold';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'tea';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'cakes';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'pastry';
