/* Phase 3 — Suppliers, Purchases, Inventory, Recipes, Adjustments, Waste.
   Frontend / local-state only. No backend, no DB, no accounting posting. */

export type Supplier = {
  id: string;
  name: string;
  mobile: string;
  rep: string;
  vat: string;
  email: string;
  address: string;
  terms: "cash" | "net15" | "net30";
  openingBalance: number;
  outstanding: number;
  lastPurchaseAt?: number;
};

export type PurchaseItem = {
  id: string;
  inventoryId: string;
  qty: number;
  unit: string;
  unitCost: number;
  vat: number; // line vat amount
  total: number; // line total inc vat
};

export type PurchaseInvoice = {
  id: string;
  number: string; // internal
  supplierInvoiceNo: string;
  supplierId: string;
  date: number;
  items: PurchaseItem[];
  subtotal: number;
  vat: number;
  total: number;
  paymentMethod: "cash" | "bank" | "credit";
  status: "paid" | "partial" | "unpaid";
  paid: number;
  attachment?: string; // local filename label only
};

export type InventoryCategory =
  | "coffee" | "milk" | "syrups" | "bakery" | "tea"
  | "drinks" | "packaging" | "other";

export const INVENTORY_CATEGORIES: { id: InventoryCategory; ar: string; en: string }[] = [
  { id: "coffee", ar: "بن وحبوب", en: "Coffee beans" },
  { id: "milk", ar: "حليب", en: "Milk" },
  { id: "syrups", ar: "نكهات وصوصات", en: "Syrups & sauces" },
  { id: "bakery", ar: "مخبوزات وكيك", en: "Bakery & cakes" },
  { id: "tea", ar: "شاي", en: "Tea" },
  { id: "drinks", ar: "مشروبات", en: "Drinks" },
  { id: "packaging", ar: "تغليف", en: "Packaging" },
  { id: "other", ar: "أخرى", en: "Other" },
];

export const UNITS: { id: string; ar: string; en: string }[] = [
  { id: "carton", ar: "كرتون", en: "Carton" },
  { id: "liter", ar: "لتر", en: "Liter" },
  { id: "tin", ar: "تنكة", en: "Tin" },
  { id: "bag", ar: "كيس", en: "Bag" },
  { id: "pack", ar: "علبة", en: "Pack" },
  { id: "piece", ar: "حبة", en: "Piece" },
];

export type InventoryItem = {
  id: string;
  ar: string;
  en: string;
  category: InventoryCategory;
  unit: string; // unit id
  qty: number;
  minLevel: number;
  avgCost: number;
  notes?: string;
  updatedAt: number;
};

export type MovementType = "purchase" | "sale" | "adjustment" | "waste" | "manual";
export type InventoryMovement = {
  id: string;
  inventoryId: string;
  date: number;
  type: MovementType;
  ref: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  user: string;
  notes?: string;
};

export type RecipeIngredient = {
  inventoryId: string;
  qty: number;
  unit: string;
};
export type Recipe = {
  productId: string;
  ingredients: RecipeIngredient[];
};

export type StockAdjustment = {
  id: string;
  number: string;
  date: number;
  inventoryId: string;
  oldQty: number;
  newQty: number;
  diff: number;
  reason: "count" | "damage" | "loss" | "entry_error" | "other";
  notes?: string;
  user: string;
};

export type WasteRecord = {
  id: string;
  number: string;
  date: number;
  inventoryId: string;
  qty: number;
  unit: string;
  reason: "damage" | "expired" | "prep_error" | "daily_waste" | "broken" | "other";
  estCost: number;
  notes?: string;
  user: string;
};

/* ───── Seeds ───── */

const now = Date.now();
const hours = (h: number) => now - h * 3600 * 1000;
const days = (d: number) => now - d * 86400 * 1000;

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_INVENTORY: InventoryItem[] = [];

export const INITIAL_PURCHASES: PurchaseInvoice[] = [];

export const INITIAL_MOVEMENTS: InventoryMovement[] = [];

export const INITIAL_RECIPES: Recipe[] = [];

export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [];

export const INITIAL_WASTE: WasteRecord[] = [];
