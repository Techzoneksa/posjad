"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_SUPPLIERS, INITIAL_INVENTORY, INITIAL_PURCHASES, INITIAL_MOVEMENTS,
  INITIAL_RECIPES, INITIAL_ADJUSTMENTS, INITIAL_WASTE,
  type Supplier, type InventoryItem, type PurchaseInvoice, type PurchaseItem,
  type InventoryMovement, type Recipe, type RecipeIngredient,
  type StockAdjustment, type WasteRecord,
} from "./phase3Data";

const uid = () => Math.random().toString(36).slice(2, 10);

type Ctx = {
  suppliers: Supplier[];
  inventory: InventoryItem[];
  purchases: PurchaseInvoice[];
  movements: InventoryMovement[];
  recipes: Recipe[];
  adjustments: StockAdjustment[];
  waste: WasteRecord[];

  addSupplier: (s: Omit<Supplier, "id" | "outstanding">) => void;
  updateSupplier: (id: string, s: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addInventoryItem: (i: Omit<InventoryItem, "id" | "updatedAt">) => void;
  updateInventoryItem: (id: string, i: Partial<InventoryItem>) => void;

  addPurchase: (p: Omit<PurchaseInvoice, "id" | "number">) => PurchaseInvoice;

  saveRecipe: (productId: string, ingredients: RecipeIngredient[]) => void;

  recordAdjustment: (a: { inventoryId: string; newQty: number; reason: StockAdjustment["reason"]; notes?: string; user: string }) => void;
  recordWaste: (w: { inventoryId: string; qty: number; reason: WasteRecord["reason"]; notes?: string; user: string }) => void;
};

const C = createContext<Ctx | null>(null);

export function Phase3Provider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(INITIAL_PURCHASES);
  const [movements, setMovements] = useState<InventoryMovement[]>(INITIAL_MOVEMENTS);
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(INITIAL_ADJUSTMENTS);
  const [waste, setWaste] = useState<WasteRecord[]>(INITIAL_WASTE);
  const [adjCounter, setAdjCounter] = useState(502);
  const [wasteCounter, setWasteCounter] = useState(2002);
  const [purchCounter, setPurchCounter] = useState(1005);

  const value = useMemo<Ctx>(() => ({
    suppliers, inventory, purchases, movements, recipes, adjustments, waste,

    addSupplier: (s) => setSuppliers(arr => [
      ...arr,
      { ...s, id: `sup_${uid()}`, outstanding: s.openingBalance },
    ]),
    updateSupplier: (id, patch) =>
      setSuppliers(arr => arr.map(s => s.id === id ? { ...s, ...patch } : s)),
    deleteSupplier: (id) => setSuppliers(arr => arr.filter(s => s.id !== id)),

    addInventoryItem: (i) => setInventory(arr => [
      ...arr,
      { ...i, id: `inv_${uid()}`, updatedAt: Date.now() },
    ]),
    updateInventoryItem: (id, patch) =>
      setInventory(arr => arr.map(it => it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it)),

    addPurchase: (p) => {
      const number = `P-${purchCounter}`;
      setPurchCounter(n => n + 1);
      const inv: PurchaseInvoice = { ...p, id: number, number };
      setPurchases(arr => [inv, ...arr]);

      // bump inventory + add movements
      setInventory(prev => {
        const next = prev.map(it => ({ ...it }));
        p.items.forEach((line) => {
          const idx = next.findIndex(x => x.id === line.inventoryId);
          if (idx >= 0) {
            const it = next[idx];
            if (!it) return;
            const newQty = it.qty + line.qty;
            const totalCost = it.qty * it.avgCost + line.qty * line.unitCost;
            const newAvg = newQty > 0 ? totalCost / newQty : it.avgCost;
            next[idx] = { ...it, qty: newQty, avgCost: +newAvg.toFixed(2), updatedAt: Date.now() };
          }
        });
        return next;
      });
      setMovements(prev => {
        const adds: InventoryMovement[] = [];
        p.items.forEach((line) => {
          adds.push({
            id: `mv_${uid()}`, inventoryId: line.inventoryId, date: p.date,
            type: "purchase", ref: number, qtyIn: line.qty, qtyOut: 0,
            balance: 0, user: "خالد الحربي",
          });
        });
        return [...adds, ...prev];
      });

      // bump supplier outstanding for credit invoices
      if (p.paymentMethod === "credit") {
        setSuppliers(prev => prev.map(s =>
          s.id === p.supplierId
            ? { ...s, outstanding: s.outstanding + (p.total - p.paid), lastPurchaseAt: p.date }
            : s,
        ));
      } else {
        setSuppliers(prev => prev.map(s =>
          s.id === p.supplierId ? { ...s, lastPurchaseAt: p.date } : s,
        ));
      }
      return inv;
    },

    saveRecipe: (productId, ingredients) =>
      setRecipes(arr => {
        const exists = arr.find(r => r.productId === productId);
        if (exists) return arr.map(r => r.productId === productId ? { ...r, ingredients } : r);
        return [...arr, { productId, ingredients }];
      }),

    recordAdjustment: ({ inventoryId, newQty, reason, notes, user }) => {
      const item = inventory.find(i => i.id === inventoryId);
      if (!item) return;
      const oldQty = item.qty;
      const diff = newQty - oldQty;
      const number = `A-${adjCounter}`;
      setAdjCounter(n => n + 1);
      setAdjustments(arr => [{
        id: number, number, date: Date.now(),
        inventoryId, oldQty, newQty, diff, reason, notes, user,
      }, ...arr]);
      setInventory(arr => arr.map(it => it.id === inventoryId
        ? { ...it, qty: newQty, updatedAt: Date.now() } : it));
      setMovements(arr => [{
        id: `mv_${uid()}`, inventoryId, date: Date.now(),
        type: "adjustment", ref: number,
        qtyIn: diff > 0 ? diff : 0, qtyOut: diff < 0 ? -diff : 0,
        balance: newQty, user, notes,
      }, ...arr]);
    },

    recordWaste: ({ inventoryId, qty, reason, notes, user }) => {
      const item = inventory.find(i => i.id === inventoryId);
      if (!item) return;
      const number = `W-${wasteCounter}`;
      setWasteCounter(n => n + 1);
      const estCost = +(qty * item.avgCost).toFixed(2);
      setWaste(arr => [{
        id: number, number, date: Date.now(),
        inventoryId, qty, unit: item.unit, reason, estCost, notes, user,
      }, ...arr]);
      const newQty = Math.max(0, item.qty - qty);
      setInventory(arr => arr.map(it => it.id === inventoryId
        ? { ...it, qty: newQty, updatedAt: Date.now() } : it));
      setMovements(arr => [{
        id: `mv_${uid()}`, inventoryId, date: Date.now(),
        type: "waste", ref: number, qtyIn: 0, qtyOut: qty,
        balance: newQty, user, notes,
      }, ...arr]);
    },
  }), [suppliers, inventory, purchases, movements, recipes, adjustments, waste, adjCounter, wasteCounter, purchCounter]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const usePhase3 = () => {
  const c = useContext(C);
  if (!c) throw new Error("Phase3Provider missing");
  return c;
};
