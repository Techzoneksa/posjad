
-- Helper: admin (owner/manager) OR finance
CREATE OR REPLACE FUNCTION public.is_admin_or_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner','manager','finance')
  )
$$;

-- inventory_items: explicit SELECT for admin+finance
DROP POLICY IF EXISTS "inv items read admin+finance" ON public.inventory_items;
CREATE POLICY "inv items read admin+finance" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (public.is_admin_or_finance(auth.uid()));

-- stock_adjustments: explicit SELECT for admin+finance
DROP POLICY IF EXISTS "adjustments read admin+finance" ON public.stock_adjustments;
CREATE POLICY "adjustments read admin+finance" ON public.stock_adjustments
  FOR SELECT TO authenticated
  USING (public.is_admin_or_finance(auth.uid()));

-- waste_records: explicit SELECT for admin+finance
DROP POLICY IF EXISTS "waste read admin+finance" ON public.waste_records;
CREATE POLICY "waste read admin+finance" ON public.waste_records
  FOR SELECT TO authenticated
  USING (public.is_admin_or_finance(auth.uid()));

-- recipe_ingredients: remove permissive read, restrict to admin+finance
DROP POLICY IF EXISTS "recipe ing readable" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe ing read admin+finance" ON public.recipe_ingredients;
CREATE POLICY "recipe ing read admin+finance" ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (public.is_admin_or_finance(auth.uid()));

-- product_recipes: remove permissive read, restrict to admin+finance
DROP POLICY IF EXISTS "recipes readable" ON public.product_recipes;
DROP POLICY IF EXISTS "recipes read admin+finance" ON public.product_recipes;
CREATE POLICY "recipes read admin+finance" ON public.product_recipes
  FOR SELECT TO authenticated
  USING (public.is_admin_or_finance(auth.uid()));
