// Trusted server-only helpers for Sprint C (inventory side-effects).
// Imported by server functions and POS createOrder.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MovementType = "purchase" | "sale_deduction" | "adjustment" | "waste" | "manual_correction";

/** Apply a stock delta to an item and record a movement row. Non-blocking caller should try/catch. */
export async function applyMovement(opts: {
  inventory_item_id: string;
  delta: number; // positive = in, negative = out
  movement_type: MovementType;
  reference_type?: string | null;
  reference_id?: string | null;
  unit_cost?: number | null;
  notes?: string | null;
  created_by?: string | null;
}) {
  const { data: item, error } = await supabaseAdmin
    .from("inventory_items")
    .select("id, current_quantity, unit, average_cost")
    .eq("id", opts.inventory_item_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error("Inventory item not found");

  const current = Number(item.current_quantity);
  const next = current + opts.delta;

  // Update average cost on purchase (weighted)
  let nextAvgCost: number | null = null;
  if (opts.movement_type === "purchase" && opts.delta > 0 && opts.unit_cost != null) {
    const prevValue = current * Number(item.average_cost ?? 0);
    const addValue = opts.delta * opts.unit_cost;
    const newQty = current + opts.delta;
    nextAvgCost = newQty > 0 ? (prevValue + addValue) / newQty : Number(item.average_cost ?? 0);
  }

  const updatePayload: any = { current_quantity: next };
  if (nextAvgCost != null) updatePayload.average_cost = nextAvgCost;

  const { error: uErr } = await supabaseAdmin
    .from("inventory_items")
    .update(updatePayload)
    .eq("id", opts.inventory_item_id);
  if (uErr) throw new Error(uErr.message);

  const { error: mErr } = await supabaseAdmin.from("inventory_movements").insert({
    inventory_item_id: opts.inventory_item_id,
    movement_type: opts.movement_type,
    reference_type: opts.reference_type ?? null,
    reference_id: opts.reference_id ?? null,
    quantity_in: opts.delta > 0 ? opts.delta : 0,
    quantity_out: opts.delta < 0 ? -opts.delta : 0,
    balance_after: next,
    unit: item.unit,
    unit_cost: opts.unit_cost ?? null,
    notes: opts.notes ?? null,
    created_by: opts.created_by ?? null,
  });
  if (mErr) throw new Error(mErr.message);
}

/** Deduct inventory for a completed order based on recipes. Non-blocking: errors are caught by caller. */
export async function deductOrderInventory(orderId: string, items: { product_id: string; quantity: number }[]) {
  if (!items.length) return;
  const productIds = Array.from(new Set(items.map(i => i.product_id)));
  const { data: recipes } = await supabaseAdmin
    .from("product_recipes")
    .select("id, product_id, active")
    .in("product_id", productIds)
    .eq("active", true);
  if (!recipes || recipes.length === 0) return;

  const recipeIds = recipes.map(r => r.id);
  const { data: ings } = await supabaseAdmin
    .from("recipe_ingredients")
    .select("recipe_id, inventory_item_id, quantity_used")
    .in("recipe_id", recipeIds);
  if (!ings) return;

  const byRecipe = new Map<string, { product_id: string }>();
  recipes.forEach(r => byRecipe.set(r.id, { product_id: r.product_id }));

  // qty by product
  const qtyByProduct = new Map<string, number>();
  items.forEach(i => qtyByProduct.set(i.product_id, (qtyByProduct.get(i.product_id) || 0) + i.quantity));

  for (const ing of ings) {
    const r = byRecipe.get(ing.recipe_id);
    if (!r) continue;
    const soldQty = qtyByProduct.get(r.product_id) || 0;
    if (!soldQty) continue;
    const totalUsed = Number(ing.quantity_used) * soldQty;
    try {
      await applyMovement({
        inventory_item_id: ing.inventory_item_id,
        delta: -totalUsed,
        movement_type: "sale_deduction",
        reference_type: "order",
        reference_id: orderId,
      });
    } catch (e) {
      // non-blocking
      console.error("sale deduction failed", ing.inventory_item_id, e);
    }
  }
}
