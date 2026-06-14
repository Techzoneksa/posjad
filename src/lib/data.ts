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
  brandAr: "JAAD",
  brandEn: "JAAD",
  branchAr: "---",
  branchEn: "Main Branch",
  vatNumber: "300000000000003",
};

export const CASHIERS = [
  { id: "u1", username: "cashier1", pin: "1234", name: "أحمد العتيبي", role: "cashier" as const },
  { id: "u2", username: "manager", pin: "9999", name: "المالك", role: "manager" as const },
];

export const CATEGORIES = [
  { id: "hot", ar: "قهوة ساخنة", en: "Hot Coffee" },
  { id: "cold", ar: "قهوة باردة", en: "Cold Coffee" },
  { id: "tea", ar: "شاي ومشروبات", en: "Tea & Drinks" },
  { id: "cakes", ar: "كيكات", en: "Cakes" },
  { id: "pastry", ar: "معجنات وحلويات", en: "Pastries & Sweets" },
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

/* Kept for backwards-compat (cafe has no spice). */
export const SPICE_OPTIONS: Modifier[] = [];

/* Coffee removals — common "no X" preferences */
export const REMOVALS_COFFEE: Modifier[] = [
  { id: "no_sugar", ar: "بدون سكر", en: "No sugar" },
  { id: "no_milk", ar: "بدون حليب", en: "No milk" },
  { id: "no_foam", ar: "بدون رغوة", en: "No foam" },
  { id: "no_ice", ar: "بدون ثلج", en: "No ice" },
];

/* Cake / pastry removals */
export const REMOVALS_CAKE: Modifier[] = [
  { id: "no_cream", ar: "بدون كريمة", en: "No cream" },
  { id: "no_syrup", ar: "بدون صوص", en: "No syrup" },
];

/* Coffee paid add-ons */
export const ADDONS_COFFEE: Modifier[] = [
  { id: "extra_shot", ar: "شوت إضافي", en: "Extra espresso shot", price: 3 },
  { id: "vanilla", ar: "نكهة فانيليا", en: "Vanilla syrup", price: 2 },
  { id: "caramel", ar: "نكهة كراميل", en: "Caramel syrup", price: 2 },
  { id: "hazelnut", ar: "نكهة بندق", en: "Hazelnut syrup", price: 2 },
  { id: "oat_milk", ar: "حليب شوفان", en: "Oat milk", price: 3 },
  { id: "almond_milk", ar: "حليب لوز", en: "Almond milk", price: 3 },
  { id: "whipped", ar: "كريمة مخفوقة", en: "Whipped cream", price: 2 },
];

/* Tea & cold drinks add-ons */
export const ADDONS_TEA: Modifier[] = [
  { id: "extra_mint", ar: "زيادة نعناع", en: "Extra mint", price: 1 },
  { id: "lemon", ar: "ليمون", en: "Lemon", price: 1 },
  { id: "honey", ar: "عسل", en: "Honey", price: 2 },
];

/* Cake / pastry add-ons */
export const ADDONS_CAKE: Modifier[] = [
  { id: "extra_cream", ar: "كريمة إضافية", en: "Extra cream", price: 3 },
  { id: "chocolate_sauce", ar: "صوص شوكولاتة", en: "Chocolate sauce", price: 2 },
  { id: "ice_cream", ar: "كرة آيس كريم", en: "Ice cream scoop", price: 5 },
];

/* Master list — used by cart/order serialization to resolve any modifier by id */
export const ALL_REMOVALS: Modifier[] = [
  ...REMOVALS_COFFEE,
  ...REMOVALS_CAKE,
];
export const ALL_ADDONS: Modifier[] = [
  ...ADDONS_COFFEE,
  ...ADDONS_TEA,
  ...ADDONS_CAKE,
];

/* Backwards-compat aliases (older imports) */
export const REMOVALS = ALL_REMOVALS;
export const PAID_ADDONS = ALL_ADDONS;

export function getModifierGroups(category: string): {
  removals: Modifier[];
  addons: Modifier[];
} {
  switch (category) {
    case "hot":
    case "cold":
      return { removals: REMOVALS_COFFEE, addons: ADDONS_COFFEE };
    case "tea":
      return { removals: REMOVALS_COFFEE, addons: ADDONS_TEA };
    case "cakes":
    case "pastry":
      return { removals: REMOVALS_CAKE, addons: ADDONS_CAKE };
    default:
      return { removals: [], addons: [] };
  }
}

export const PRODUCTS: Product[] = [
  // Hot Coffee
  { id: "h_esp", ar: "إسبريسو", en: "Espresso", price: 9, cal: 5, size: "سنجل", category: "hot" },
  { id: "h_esp_d", ar: "إسبريسو دبل", en: "Double Espresso", price: 12, cal: 10, size: "دبل", category: "hot" },
  { id: "h_amer", ar: "أمريكانو", en: "Americano", price: 12, cal: 10, category: "hot" },
  { id: "h_macc", ar: "ماكياتو", en: "Macchiato", price: 13, cal: 25, category: "hot" },
  { id: "h_corta", ar: "كورتادو", en: "Cortado", price: 14, cal: 50, category: "hot" },
  { id: "h_flat", ar: "فلات وايت", en: "Flat White", price: 16, cal: 120, category: "hot" },
  { id: "h_latte", ar: "لاتيه ساخن", en: "Hot Latte", price: 17, cal: 190, category: "hot" },
  { id: "h_cap", ar: "كابتشينو", en: "Cappuccino", price: 16, cal: 150, category: "hot" },
  { id: "h_moca", ar: "موكا ساخنة", en: "Hot Mocha", price: 19, cal: 290, category: "hot" },
  { id: "h_spv60", ar: "في 60", en: "V60 Pour Over", price: 22, cal: 5, category: "hot" },
  { id: "h_spchem", ar: "كيمكس", en: "Chemex", price: 24, cal: 5, category: "hot" },
  { id: "h_turk", ar: "قهوة تركية", en: "Turkish Coffee", price: 14, cal: 10, category: "hot" },
  { id: "h_saudi", ar: "قهوة سعودية", en: "Saudi Coffee", price: 12, cal: 10, category: "hot" },
  { id: "h_choc", ar: "هوت شوكليت", en: "Hot Chocolate", price: 18, cal: 320, category: "hot" },
  // Cold Coffee
  { id: "c_iced_amer", ar: "آيس أمريكانو", en: "Iced Americano", price: 14, cal: 10, category: "cold" },
  { id: "c_iced_latte", ar: "آيس لاتيه", en: "Iced Latte", price: 18, cal: 180, category: "cold" },
  { id: "c_iced_spv", ar: "آيس سبانش لاتيه", en: "Iced Spanish Latte", price: 21, cal: 260, category: "cold" },
  { id: "c_iced_moca", ar: "آيس موكا", en: "Iced Mocha", price: 20, cal: 290, category: "cold" },
  { id: "c_iced_carml", ar: "آيس كراميل ماكياتو", en: "Iced Caramel Macchiato", price: 22, cal: 270, category: "cold" },
  { id: "c_cold_brew", ar: "كولد برو", en: "Cold Brew", price: 19, cal: 5, category: "cold" },
  { id: "c_nitro", ar: "نيترو كولد برو", en: "Nitro Cold Brew", price: 23, cal: 5, category: "cold" },
  { id: "c_frapp", ar: "فرابتشينو", en: "Frappuccino", price: 22, cal: 380, category: "cold" },
  { id: "c_iced_choc", ar: "آيس شوكليت", en: "Iced Chocolate", price: 19, cal: 310, category: "cold" },
  // Tea & Drinks
  { id: "t_blk", ar: "شاي أحمد", en: "Black Tea", price: 8, cal: 5, category: "tea" },
  { id: "t_mint", ar: "شاي نعناع", en: "Mint Tea", price: 9, cal: 5, category: "tea" },
  { id: "t_green", ar: "شاي أخضر", en: "Green Tea", price: 10, cal: 5, category: "tea" },
  { id: "t_karak", ar: "كرك", en: "Karak", price: 9, cal: 90, category: "tea" },
  { id: "t_zhourat", ar: "زهورات", en: "Herbal Infusion", price: 10, cal: 5, category: "tea" },
  { id: "t_matcha", ar: "ماتشا لاتيه", en: "Matcha Latte", price: 20, cal: 180, category: "tea" },
  { id: "t_lemon_mint", ar: "ليمون بالنعناع", en: "Lemon Mint", price: 14, cal: 90, category: "tea" },
  { id: "t_water", ar: "ماء", en: "Water", price: 2, cal: 0, category: "tea" },
  // Cakes
  { id: "k_choc", ar: "كيكة شوكولاتة", en: "Chocolate Cake", price: 18, cal: 420, category: "cakes" },
  { id: "k_cheese", ar: "تشيز كيك", en: "Cheesecake", price: 22, cal: 450, category: "cakes" },
  { id: "k_red", ar: "ريد فيلفت", en: "Red Velvet", price: 22, cal: 440, category: "cakes" },
  { id: "k_carrot", ar: "كيكة جزر", en: "Carrot Cake", price: 19, cal: 380, category: "cakes" },
  { id: "k_lotus", ar: "كيكة لوتس", en: "Lotus Cake", price: 22, cal: 460, category: "cakes" },
  { id: "k_pista", ar: "كيكة فستق", en: "Pistachio Cake", price: 24, cal: 470, category: "cakes" },
  { id: "k_tira", ar: "تيراميسو", en: "Tiramisu", price: 23, cal: 410, category: "cakes" },
  // Pastry & Sweets
  { id: "p_croi", ar: "كرواسون سادة", en: "Plain Croissant", price: 10, cal: 270, category: "pastry" },
  { id: "p_croi_choc", ar: "كرواسون شوكولاتة", en: "Chocolate Croissant", price: 13, cal: 340, category: "pastry" },
  { id: "p_croi_cheese", ar: "كرواسون جبن", en: "Cheese Croissant", price: 13, cal: 320, category: "pastry" },
  { id: "p_muffin_choc", ar: "مافن شوكولاتة", en: "Chocolate Muffin", price: 12, cal: 360, category: "pastry" },
  { id: "p_muffin_bb", ar: "مافن بلوبيري", en: "Blueberry Muffin", price: 12, cal: 340, category: "pastry" },
  { id: "p_cookie", ar: "كوكيز", en: "Cookie", price: 8, cal: 220, category: "pastry" },
  { id: "p_brownie", ar: "براوني", en: "Brownie", price: 14, cal: 380, category: "pastry" },
  { id: "p_donut", ar: "دونات", en: "Donut", price: 9, cal: 280, category: "pastry" },
  { id: "p_cinnamon", ar: "سينابون", en: "Cinnamon Roll", price: 15, cal: 420, category: "pastry" },
  { id: "p_date", ar: "معمول تمر", en: "Date Maamoul", price: 6, cal: 150, category: "pastry" },
];

export const VAT_RATE = 0.15;
