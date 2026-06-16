-- Replace demo cafe catalog with Ghurza menu from the supplied workbook.
-- Existing products/categories are deactivated instead of hard-deleted so
-- historical orders and invoice references remain intact.

DELETE FROM public.product_addon_groups;
DELETE FROM public.addons;
DELETE FROM public.addon_groups;

UPDATE public.products
SET active = false,
    updated_at = now();

UPDATE public.categories
SET active = false,
    updated_at = now();

INSERT INTO public.categories (id, name_ar, name_en, sort_order, color, icon, active)
VALUES
  ('90000000-0000-4000-8000-000000000001', 'مشروبات ساخنة', 'Hot Drinks', 10, '#b45309', 'Coffee', true),
  ('90000000-0000-4000-8000-000000000002', 'مشروبات باردة', 'Cold Drinks', 20, '#0284c7', 'CupSoda', true),
  ('90000000-0000-4000-8000-000000000003', 'المخبوزات والحلويات', 'Bakery & Sweets', 30, '#c026d3', 'Croissant', true)
ON CONFLICT (id) DO UPDATE
SET name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    active = true,
    updated_at = now();

INSERT INTO public.products (
  id,
  category_id,
  name_ar,
  name_en,
  sku,
  price,
  tax_rate,
  active,
  product_type,
  calories,
  size
)
VALUES
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'شاي', 'Tea', 'GH-HOT-TEA-S', 4, 0.15, true, 'drink', 2, 'صغير'),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'شاي', 'Tea', 'GH-HOT-TEA-L', 6, 0.15, true, 'drink', 2, 'كبير'),
  ('91000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', 'شاي بلبن', 'Milk Tea', 'GH-HOT-MILK-TEA', 5, 0.15, true, 'drink', 50, null),
  ('91000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', 'شاي أخضر', 'Green Tea', 'GH-HOT-GREEN-TEA', 4, 0.15, true, 'drink', 2, null),
  ('91000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', 'قهوة تركي', 'Turkish Coffee', 'GH-HOT-TURKISH-COFFEE', 11, 0.15, true, 'drink', 5, null),
  ('91000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000002', 'كركديه', 'Hibiscus', 'GH-COLD-HIBISCUS', 10, 0.15, true, 'drink', 5, null),
  ('91000000-0000-4000-8000-000000000007', '90000000-0000-4000-8000-000000000002', 'ايس تي نكهات', 'Flavored Iced Tea', 'GH-COLD-FLAVORED-ICED-TEA', 12, 0.15, true, 'drink', 10, null),
  ('91000000-0000-4000-8000-000000000008', '90000000-0000-4000-8000-000000000002', 'مويه', 'Water', 'GH-COLD-WATER', 1, 0.15, true, 'drink', 1, null),
  ('91000000-0000-4000-8000-000000000009', '90000000-0000-4000-8000-000000000003', 'بيتزا نابولي', 'Napoli Pizza', 'GH-BAKERY-NAPOLI-PIZZA', 18, 0.15, true, 'other', 600, null),
  ('91000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000003', 'فطيرة مكس أجبان', 'Mixed Cheese Pie', 'GH-BAKERY-MIXED-CHEESE-PIE', 8, 0.15, true, 'other', 400, null),
  ('91000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000003', 'فطيرة جبنة سايل', 'Liquid Cheese Pie', 'GH-BAKERY-LIQUID-CHEESE-PIE', 9, 0.15, true, 'other', 350, null),
  ('91000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000003', 'فطيرة لبنة عسل', 'Labneh Honey Pie', 'GH-BAKERY-LABNEH-HONEY-PIE', 8, 0.15, true, 'other', 350, null),
  ('91000000-0000-4000-8000-000000000013', '90000000-0000-4000-8000-000000000003', 'فطيرة لبنة زعتر', 'Labneh Zaatar Pie', 'GH-BAKERY-LABNEH-ZAATAR-PIE', 9, 0.15, true, 'other', 300, null),
  ('91000000-0000-4000-8000-000000000014', '90000000-0000-4000-8000-000000000003', 'فطيرة تونة', 'Tuna Pie', 'GH-BAKERY-TUNA-PIE', 8, 0.15, true, 'other', 250, null),
  ('91000000-0000-4000-8000-000000000015', '90000000-0000-4000-8000-000000000003', 'خلية نحل', 'Honeycomb Bread', 'GH-BAKERY-HONEYCOMB', 15, 0.15, true, 'other', 465, null),
  ('91000000-0000-4000-8000-000000000016', '90000000-0000-4000-8000-000000000003', 'مكسرات', 'Nuts', 'GH-BAKERY-NUTS', 4, 0.15, true, 'other', 618, null)
ON CONFLICT (id) DO UPDATE
SET category_id = EXCLUDED.category_id,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    sku = EXCLUDED.sku,
    price = EXCLUDED.price,
    tax_rate = EXCLUDED.tax_rate,
    active = true,
    product_type = EXCLUDED.product_type,
    calories = EXCLUDED.calories,
    size = EXCLUDED.size,
    updated_at = now();

UPDATE public.restaurant_settings
SET brand_name_ar = 'غُرزة',
    brand_name_en = 'Ghurza',
    branch_ar = CASE WHEN trim(coalesce(branch_ar, '')) = '' THEN 'الفرع الرئيسي' ELSE branch_ar END,
    branch_en = CASE WHEN trim(coalesce(branch_en, '')) = '' THEN 'Main Branch' ELSE branch_en END,
    updated_at = now()
WHERE id = true;
