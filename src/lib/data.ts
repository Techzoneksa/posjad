export type Modifier = { id: string; ar: string; en: string; price?: number };
export type Product = {
  id: string;
  ar: string;
  en: string;
  price: number;
  cal?: number;
  size?: string;
  category: string;
  image_url?: string | null;
  requiresSpice?: boolean;
};

export const COMPANY = {
  brandAr: "غُرزة",
  brandEn: "Ghurza",
  branchAr: "الفرع الرئيسي",
  branchEn: "Main Branch",
  vatNumber: "300000000000003",
};

export const CASHIERS = [
  { id: "u1", username: "cashier1", pin: "1234", name: "الكاشير", role: "cashier" as const },
  { id: "u2", username: "manager", pin: "9999", name: "المدير", role: "manager" as const },
];

export const CATEGORIES = [
  { id: "hot_drinks", ar: "مشروبات ساخنة", en: "Hot Drinks" },
  { id: "cold_drinks", ar: "مشروبات باردة", en: "Cold Drinks" },
  { id: "bakery_sweets", ar: "المخبوزات والحلويات", en: "Bakery & Sweets" },
];

export const ORDER_TYPES = [
  { id: "dine_in", ar: "داخل المحل", en: "Dine-in" },
  { id: "takeaway", ar: "سفري", en: "Takeaway" },
  { id: "delivery", ar: "توصيل", en: "Delivery" },
] as const;
export type OrderTypeId = (typeof ORDER_TYPES)[number]["id"];

export const PAYMENT_METHODS = [
  { id: "cash", ar: "نقدي", en: "Cash" },
  { id: "mada", ar: "مدى / شبكة", en: "Mada / Network" },
  { id: "apple_pay", ar: "Apple Pay", en: "Apple Pay" },
  { id: "visa", ar: "Visa / Mastercard", en: "Visa / Mastercard" },
  { id: "mixed", ar: "دفع مختلط", en: "Mixed Payment" },
] as const;
export type PaymentId = (typeof PAYMENT_METHODS)[number]["id"];

export const SPICE_OPTIONS: Modifier[] = [];

export const REMOVALS_COFFEE: Modifier[] = [];
export const REMOVALS_CAKE: Modifier[] = [];
export const ADDONS_COFFEE: Modifier[] = [];
export const ADDONS_TEA: Modifier[] = [];
export const ADDONS_CAKE: Modifier[] = [];

export const ALL_REMOVALS: Modifier[] = [];
export const ALL_ADDONS: Modifier[] = [];

export const REMOVALS = ALL_REMOVALS;
export const PAID_ADDONS = ALL_ADDONS;

export function getModifierGroups(_category: string): {
  removals: Modifier[];
  addons: Modifier[];
} {
  return { removals: [], addons: [] };
}

export const PRODUCTS: Product[] = [
  { id: "gh_hot_tea_small", ar: "شاي", en: "Tea", price: 4, cal: 2, size: "صغير", category: "hot_drinks" },
  { id: "gh_hot_tea_large", ar: "شاي", en: "Tea", price: 6, cal: 2, size: "كبير", category: "hot_drinks" },
  { id: "gh_hot_milk_tea", ar: "شاي بلبن", en: "Milk Tea", price: 5, cal: 50, category: "hot_drinks" },
  { id: "gh_hot_green_tea", ar: "شاي أخضر", en: "Green Tea", price: 4, cal: 2, category: "hot_drinks" },
  { id: "gh_hot_turkish_coffee", ar: "قهوة تركي", en: "Turkish Coffee", price: 11, cal: 5, category: "hot_drinks" },
  { id: "gh_cold_hibiscus", ar: "كركديه", en: "Hibiscus", price: 10, cal: 5, category: "cold_drinks" },
  { id: "gh_cold_flavored_iced_tea", ar: "ايس تي نكهات", en: "Flavored Iced Tea", price: 12, cal: 10, category: "cold_drinks" },
  { id: "gh_cold_water", ar: "مويه", en: "Water", price: 1, cal: 1, category: "cold_drinks" },
  { id: "gh_bakery_napoli_pizza", ar: "بيتزا نابولي", en: "Napoli Pizza", price: 18, cal: 600, category: "bakery_sweets" },
  { id: "gh_bakery_mixed_cheese_pie", ar: "فطيرة مكس أجبان", en: "Mixed Cheese Pie", price: 8, cal: 400, category: "bakery_sweets" },
  { id: "gh_bakery_liquid_cheese_pie", ar: "فطيرة جبنة سايل", en: "Liquid Cheese Pie", price: 9, cal: 350, category: "bakery_sweets" },
  { id: "gh_bakery_labneh_honey_pie", ar: "فطيرة لبنة عسل", en: "Labneh Honey Pie", price: 8, cal: 350, category: "bakery_sweets" },
  { id: "gh_bakery_labneh_zaatar_pie", ar: "فطيرة لبنة زعتر", en: "Labneh Zaatar Pie", price: 9, cal: 300, category: "bakery_sweets" },
  { id: "gh_bakery_tuna_pie", ar: "فطيرة تونة", en: "Tuna Pie", price: 8, cal: 250, category: "bakery_sweets" },
  { id: "gh_bakery_honeycomb", ar: "خلية نحل", en: "Honeycomb Bread", price: 15, cal: 465, category: "bakery_sweets" },
  { id: "gh_bakery_nuts", ar: "مكسرات", en: "Nuts", price: 4, cal: 618, category: "bakery_sweets" },
];

export const VAT_RATE = 0.15;
