"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PRODUCTS, VAT_RATE, type Product, type Modifier } from "./data";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentSessionUser, signOut as authSignOut } from "./authConfig";
import { getAccessToken, useApiAction } from "@/lib/api-client";
import { openShift as openShiftFn, getOpenShift } from "./shifts.functions";
import { createOrder as createOrderFn, holdOrder as holdOrderFn, listHeldOrders as listHeldOrdersFn, resumeHeldOrder as resumeHeldOrderFn, discardHeldOrder as discardHeldOrderFn, findOrCreateCustomerByPhone } from "./pos.functions";
import { toast } from "sonner";


export type Lang = "ar" | "en";
export type Theme = "light" | "dark";

export type CartItem = {
  uid: string;
  product: Product;
  qty: number;
  spice?: Modifier;
  removals: Modifier[];
  addons: Modifier[];
  note?: string;
};

export type HeldOrder = {
  id: string;
  number: string;
  time: number;
  orderType: string;
  items: CartItem[];
};

export type CompletedOrder = {
  id: string;
  number: string;
  invoice: string;
  invoiceId?: string;
  time: number;
  orderType: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment: string;
  cashier: string;
  customerPhone?: string;
  refunded?: boolean;
};

export type UserRole = "cashier" | "manager" | "owner" | "finance";
export const ADMIN_ROLES: UserRole[] = ["manager", "owner", "finance"];
export const isAdminRole = (r?: UserRole | null) => !!r && ADMIN_ROLES.includes(r);

export type Screen =
  | "login_selector"
  | "pos_login"
  | "dashboard_login"
  | "access_denied"
  | "reset_password"
  | "login"
  | "open_shift"
  | "pos"
  | "invoice"
  | "held"
  | "orders"
  | "refund"
  | "close_shift"
  | "dashboard"
  | "m_products"
  | "m_categories"
  | "m_addons"
  | "m_users"
  | "m_cashiers"
  | "m_shifts"
  | "m_orders"
  | "m_customers"
  | "m_reports"
  | "settings"
  | "m_suppliers"
  | "m_purchases"
  | "m_inventory"
  | "m_recipes"
  | "m_adjustments"
  | "m_waste"
  | "m_expenses"
  | "m_banks"
  | "m_chart"
  | "m_journal"
  | "m_supplier_payments"
  | "m_employees"
  | "m_payroll"
  | "m_finreports"
  | "m_zatca"
  | "m_readiness"
  | "m_activity"
  | "m_audit"
  | "m_notifications"
  | "m_import"
  | "m_export"
  | "m_backup"
  | "m_permissions"
  | "m_qa"
  | "m_backend";

export const POS_SCREENS: Screen[] = ["open_shift","pos","invoice","held","orders","refund","close_shift"];
export const ADMIN_SCREENS: Screen[] = [
  "dashboard","m_products","m_categories","m_addons","m_users","m_cashiers","m_shifts",
  "m_orders","m_customers","m_reports","settings","m_suppliers","m_purchases","m_inventory",
  "m_recipes","m_adjustments","m_waste","m_expenses","m_banks","m_chart","m_journal",
  "m_supplier_payments","m_employees","m_payroll","m_finreports","m_zatca","m_readiness",
  "m_activity","m_audit","m_notifications","m_import","m_export","m_backup","m_permissions",
  "m_qa","m_backend",
];

const t = {
  ar: {
    login: "تسجيل الدخول", username: "اسم المستخدم", password: "كلمة المرور / PIN",
    signIn: "دخول", openShift: "فتح الوردية", openingCash: "الرصيد الافتتاحي (نقدًا)", start: "بدء الوردية",
    cart: "الطلب الحالي", subtotal: "المجموع الفرعي", discount: "الخصم", vatIncluded: "شامل ضريبة القيمة المضافة 15%",
    total: "الإجمالي", pay: "الدفع", hold: "تعليق الطلب", cancel: "إلغاء", checkout: "إتمام الدفع",
    items: "أصناف", item: "صنف", addNote: "ملاحظة", customerPhone: "جوال العميل (اختياري)",
    addToCart: "إضافة للسلة", chooseSpice: "اختر الحرارة", removals: "حذف الإضافات", paidAddons: "إضافات إضافية",
    noOrder: "لا يوجد طلب حالي. اختر صنفًا للبدء.", category: "الفئة", orderType: "نوع الطلب",
    newOrder: "طلب جديد", print: "طباعة", invoice: "الفاتورة", recentOrders: "الطلبات الحديثة",
    heldOrders: "الطلبات المعلقة", refund: "استرجاع", closeShift: "إغلاق الوردية", dashboard: "لوحة التحكم",
    settings: "الإعدادات", language: "اللغة", theme: "المظهر", light: "فاتح", dark: "داكن",
    cashier: "الكاشير", logout: "تسجيل الخروج", resume: "استئناف", delete: "حذف",
    search: "بحث", today: "اليوم", reprint: "إعادة طباعة", fullRefund: "استرجاع كامل",
    partialRefund: "استرجاع جزئي", confirm: "تأكيد", expected: "المتوقع", actual: "الفعلي",
    difference: "الفرق", fixed: "مبلغ ثابت", percent: "نسبة %", note: "ملاحظة",
    products: "المنتجات", categories: "الفئات", addons: "الإضافات", shifts: "الورديات",
    orderNo: "رقم الطلب", invoiceNo: "رقم الفاتورة", time: "الوقت", qty: "الكمية",
    completed: "تم بنجاح", demo: "فاتورة تجريبية لمرحلة التصميم فقط",
  },
  en: {
    login: "Sign in", username: "Username", password: "Password / PIN",
    signIn: "Sign in", openShift: "Open Shift", openingCash: "Opening cash balance", start: "Start shift",
    cart: "Current Order", subtotal: "Subtotal", discount: "Discount", vatIncluded: "VAT 15% included",
    total: "Total", pay: "Payment", hold: "Hold order", cancel: "Cancel", checkout: "Checkout",
    items: "items", item: "item", addNote: "Note", customerPhone: "Customer mobile (optional)",
    addToCart: "Add to cart", chooseSpice: "Choose spice level", removals: "Removals", paidAddons: "Paid add-ons",
    noOrder: "No active order. Pick an item to start.", category: "Category", orderType: "Order type",
    newOrder: "New order", print: "Print", invoice: "Invoice", recentOrders: "Recent Orders",
    heldOrders: "Held Orders", refund: "Refund", closeShift: "Close Shift", dashboard: "Dashboard",
    settings: "Settings", language: "Language", theme: "Theme", light: "Light", dark: "Dark",
    cashier: "Cashier", logout: "Sign out", resume: "Resume", delete: "Delete",
    search: "Search", today: "Today", reprint: "Reprint", fullRefund: "Full refund",
    partialRefund: "Partial refund", confirm: "Confirm", expected: "Expected", actual: "Actual",
    difference: "Difference", fixed: "Fixed amount", percent: "Percentage %", note: "Note",
    products: "Products", categories: "Categories", addons: "Add-ons", shifts: "Shifts",
    orderNo: "Order #", invoiceNo: "Invoice #", time: "Time", qty: "Qty",
    completed: "Completed", demo: "Design-phase preview invoice only",
  },
};
export type Dict = typeof t.ar;

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void;
  theme: Theme; setTheme: (th: Theme) => void;
  t: Dict;
  user: { name: string; role: UserRole } | null;
  signIn: (name: string, role: UserRole) => void;
  signOut: () => void;
  shift: { open: boolean; id?: string; openedAt?: number; openingCash: number };
  openShift: (cash: number) => Promise<void>;
  closeShift: () => void;

  screen: Screen; setScreen: (s: Screen) => void;
  orderType: string; setOrderType: (o: string) => void;
  cart: CartItem[];
  addToCart: (i: Omit<CartItem, "uid">) => void;
  updateQty: (uid: string, qty: number) => void;
  removeItem: (uid: string) => void;
  clearCart: () => void;
  discount: { type: "fixed" | "percent"; value: number };
  setDiscount: (d: { type: "fixed" | "percent"; value: number }) => void;
  customerPhone: string; setCustomerPhone: (s: string) => void;
  heldOrders: HeldOrder[];
  heldLoading: boolean;
  refreshHeld: () => Promise<void>;
  holdOrder: () => Promise<void>;
  resumeHeld: (id: string) => Promise<void>;
  deleteHeld: (id: string) => Promise<void>;

  completedOrders: CompletedOrder[];
  lastOrder: CompletedOrder | null;
  setLastOrder: (o: CompletedOrder | null) => void;
  refundOrderId: string | null;
  setRefundOrderId: (id: string | null) => void;
  completeOrder: (payment: string) => Promise<CompletedOrder | null>;
  refundOrder: (id: string, itemUids?: string[]) => void;
  totals: { subtotal: number; discountAmt: number; total: number; vatPortion: number; net: number };
  fmtMoney: (n: number) => string;
  name: (m: { ar: string; en: string }) => string;
};

const Ctx = createContext<Ctx | null>(null);

function uid() { return Math.random().toString(36).slice(2, 10); }

function isUnauthorizedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("unauthorized") || message.includes("401");
}


export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");
  const [theme, setTheme] = useState<Theme>("dark");
  const [user, setUser] = useState<Ctx["user"]>(null);
  const [shift, setShift] = useState({ open: false, openingCash: 0 } as Ctx["shift"]);
  const [screen, setScreen] = useState<Screen>("login_selector");
  const [orderType, setOrderType] = useState<string>("dine_in");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<Ctx["discount"]>({ type: "fixed", value: 0 });
  const [customerPhone, setCustomerPhone] = useState("");
  const [heldOrders, setHeld] = useState<HeldOrder[]>([]);
  const [heldLoading, setHeldLoading] = useState(false);
  const [completedOrders, setCompleted] = useState<CompletedOrder[]>([]);
  const [lastOrder, setLastOrder] = useState<CompletedOrder | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [orderCounter, setOrderCounter] = useState(1001);

  const openShiftCall = useApiAction(openShiftFn);
  const getOpenShiftCall = useApiAction(getOpenShift);
  const createOrderCall = useApiAction(createOrderFn);
  const holdOrderCall = useApiAction(holdOrderFn);
  const findOrCreateCustomer = useApiAction(findOrCreateCustomerByPhone);
  const listHeldCall = useApiAction(listHeldOrdersFn);
  const resumeHeldCall = useApiAction(resumeHeldOrderFn);
  const discardHeldCall = useApiAction(discardHeldOrderFn);

  const refreshHeld = async (shiftId?: string) => {
    setHeldLoading(true);
    try {
      if (!(await getAccessToken())) {
        setHeld([]);
        return;
      }
      const rows: any[] = await listHeldCall();
      const activeShiftId = shiftId ?? shift.id;
      const mapped: HeldOrder[] = (rows || [])
        .filter(r => !activeShiftId || r.shift_id === activeShiftId)
        .map(r => ({
          id: r.id,
          number: `H-${String(r.id).slice(0, 4).toUpperCase()}`,
          time: new Date(r.held_at).getTime(),
          orderType: r.order_type,
          items: (r.cart_json?.items ?? []) as CartItem[],
        }));
      setHeld(mapped);
    } catch (e: any) {
      if (!isUnauthorizedError(e)) toast.error(e?.message || "Failed to load held orders");
    } finally {
      setHeldLoading(false);
    }
  };


  // Hydrate from Supabase session + listen for auth changes
  useEffect(() => {
    const hydrateShift = async (role: UserRole): Promise<boolean> => {
      try {
        if (!(await getAccessToken())) return false;
        const s: any = await getOpenShiftCall();
        if (s) {
          setShift({ open: true, id: s.id, openedAt: new Date(s.opened_at).getTime(), openingCash: Number(s.opening_float) });
          await refreshHeld(s.id);
          return true;
        }
      } catch { /* ignore */ }
      return false;
    };

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        const hadUser = !!user;
        setUser(null);
        setShift({ open: false, openingCash: 0 });
        setScreen("login_selector");
        if (event === "SIGNED_OUT" && hadUser) {
          toast.error(lang === "ar" ? "انتهت الجلسة، يرجى تسجيل الدخول مجددًا" : "Session expired, please sign in again");
        }
        return;
      }
      setTimeout(async () => {
        const u = await getCurrentSessionUser();
        if (u) {
          setUser({ name: u.fullName || u.username, role: u.role });
          const hasOpen = await hydrateShift(u.role);
          if (u.role === "cashier") {
            setLang("en");
            setScreen(hasOpen ? "pos" : "open_shift");
          }
        } else setUser(null);
      }, 0);
    });
    // Initial check
    (async () => {
      const u = await getCurrentSessionUser();
      if (u) {
        setUser({ name: u.fullName || u.username, role: u.role });
        const hasOpen = await hydrateShift(u.role);
        if (u.role === "cashier") setLang("en");
        setScreen(u.role === "cashier" ? (hasOpen ? "pos" : "open_shift") : "dashboard");
      }
    })();
    return () => sub.subscription.unsubscribe();
  }, []);



  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const fmtMoney = (n: number) => `${n.toFixed(2)} ${lang === "ar" ? "ر.س" : "SAR"}`;
  const name = (m: { ar: string; en: string }) => (lang === "ar" ? m.ar : m.en);

  const subtotal = cart.reduce((s, i) => {
    const addons = i.addons.reduce((a, x) => a + (x.price || 0), 0);
    return s + (i.product.price + addons) * i.qty;
  }, 0);
  const discountAmt = Math.min(
    subtotal,
    discount.type === "fixed" ? discount.value : (subtotal * discount.value) / 100,
  );
  const total = Math.max(0, subtotal - discountAmt);
  const vatPortion = total - total / (1 + VAT_RATE);
  const net = total - vatPortion;

  const value: Ctx = {
    lang, setLang, theme, setTheme,
    t: t[lang], user,
    signIn: (n, r) => {
      setUser({ name: n, role: r });
      if (r === "cashier") {
        setLang("en");
        setScreen(shift.open ? "pos" : "open_shift");
      } else {
        setScreen("dashboard");
      }
    },
    signOut: () => {
      const wasCashier = user?.role === "cashier";
      if (wasCashier && shift.open) {
        const msg = lang === "ar"
          ? "يجب إغلاق الوردية قبل تسجيل الخروج. هل تريد تأكيد الخروج المؤقت؟"
          : "Shift must be closed before logout. Confirm temporary logout?";
        if (typeof window !== "undefined" && !window.confirm(msg)) return;
      }
      const dest: Screen = user ? (wasCashier ? "pos_login" : "dashboard_login") : "login_selector";
      void authSignOut();
      setUser(null);
      setScreen(dest);
    },
    shift,
    openShift: async (cash) => {
      try {
        if (!(await getAccessToken())) {
          setUser(null);
          setScreen("login_selector");
          toast.error(lang === "ar" ? "انتهت الجلسة، يرجى تسجيل الدخول مجددًا" : "Session expired, please sign in again");
          return;
        }
        const s: any = await openShiftCall({ data: { opening_float: Number(cash) || 0 } });
        setShift({ open: true, id: s.id, openedAt: new Date(s.opened_at).getTime(), openingCash: Number(s.opening_float) });
        await refreshHeld(s.id);
        setScreen("pos");
      } catch (e: any) {
        const msg: string = e?.message || "Failed to open shift";
        // Recover gracefully if the cashier already has an open shift on the server.
        if (/already have an open shift/i.test(msg)) {
          try {
            const s: any = await getOpenShiftCall();
            if (s) {
              setShift({ open: true, id: s.id, openedAt: new Date(s.opened_at).getTime(), openingCash: Number(s.opening_float) });
              await refreshHeld(s.id);
              setScreen("pos");
              return;
            }
          } catch { /* fall through */ }
        }
        toast.error(msg);
      }
    },

    closeShift: () => { setShift({ open: false, openingCash: 0 }); setScreen("pos_login"); setUser(null); },

    screen, setScreen,
    orderType, setOrderType,
    cart,
    addToCart: (i) => setCart(c => [...c, { ...i, uid: uid() }]),
    updateQty: (u, q) => setCart(c => c.map(it => it.uid === u ? { ...it, qty: Math.max(1, q) } : it)),
    removeItem: (u) => setCart(c => c.filter(it => it.uid !== u)),
    clearCart: () => { setCart([]); setDiscount({ type: "fixed", value: 0 }); setCustomerPhone(""); },
    discount, setDiscount,
    customerPhone, setCustomerPhone,
    heldOrders, heldLoading,
    refreshHeld: () => refreshHeld(),
    holdOrder: async () => {
      if (!cart.length) return;
      try {
        if (!(await getAccessToken())) {
          toast.error(lang === "ar" ? "انتهت الجلسة، يرجى تسجيل الدخول مجددًا" : "Session expired, please sign in again");
          setScreen("login_selector");
          return;
        }
        await holdOrderCall({ data: {
          order_type: (["dine_in","takeaway","delivery_app"].includes(orderType) ? orderType : "dine_in") as any,
          cart: { items: cart, discount, customerPhone, orderType },
        }});
        setCart([]); setDiscount({ type: "fixed", value: 0 }); setCustomerPhone("");
        await refreshHeld();
        toast.success(lang === "ar" ? "تم تعليق الطلب" : "Order held");
      } catch (e: any) {
        toast.error(e?.message || "Failed to hold order");
      }
    },
    resumeHeld: async (id) => {
      try {
        const row: any = await resumeHeldCall({ data: { id } });
        const cj = row?.cart_json || {};
        setCart((cj.items ?? []) as CartItem[]);
        setOrderType(cj.orderType || row.order_type || "dine_in");
        if (cj.discount) setDiscount(cj.discount);
        if (cj.customerPhone) setCustomerPhone(cj.customerPhone);
        await refreshHeld();
        setScreen("pos");
      } catch (e: any) {
        toast.error(e?.message || "Failed to resume order");
      }
    },
    deleteHeld: async (id) => {
      try {
        await discardHeldCall({ data: { id } });
        await refreshHeld();
      } catch (e: any) {
        toast.error(e?.message || "Failed to delete held order");
      }
    },

    completedOrders, lastOrder, setLastOrder, refundOrderId, setRefundOrderId,
    completeOrder: async (payment) => {
      if (!cart.length) return null;
      if (!(await getAccessToken())) {
        toast.error(lang === "ar" ? "انتهت الجلسة، يرجى تسجيل الدخول مجددًا" : "Session expired, please sign in again");
        setScreen("login_selector");
        return null;
      }
      if (!shift.open) {
        // Auto-open a shift with zero opening float so admins/managers can complete the payment.
        try {
          const s: any = await openShiftCall({ data: { opening_float: 0 } });
          setShift({ open: true, id: s.id, openedAt: new Date(s.opened_at).getTime(), openingCash: Number(s.opening_float) });
        } catch (e: any) {
          // If server says one already exists, hydrate from it.
          try {
            const s: any = await getOpenShiftCall();
            if (s) {
              setShift({ open: true, id: s.id, openedAt: new Date(s.opened_at).getTime(), openingCash: Number(s.opening_float) });
            } else {
              toast.error(e?.message || (lang === "ar" ? "تعذر فتح الوردية" : "Failed to open shift"));
              setScreen("open_shift");
              return null;
            }
          } catch {
            toast.error(e?.message || (lang === "ar" ? "تعذر فتح الوردية" : "Failed to open shift"));
            setScreen("open_shift");
            return null;
          }
        }
      }
      const methodMap: Record<string, "cash"|"card"|"mada"|"apple_pay"|"visa"|"mastercard"|"mixed"> = {
        cash:"cash", card:"card", mada:"mada", apple_pay:"apple_pay",
        visa:"visa", mastercard:"mastercard", mixed:"mixed",
      };
      const orderTypeMap: Record<string, "dine_in"|"takeaway"|"delivery_app"> = {
        dine_in:"dine_in", takeaway:"takeaway", delivery:"delivery_app", delivery_app:"delivery_app",
      };
      const items = cart.map(ci => ({
        product_id: ci.product.id,
        quantity: ci.qty,
        notes: ci.note || undefined,
        addon_ids: [
          ...(ci.spice?.id ? [ci.spice.id] : []),
          ...ci.addons.map(a => a.id),
          ...ci.removals.map(r => r.id),
        ].filter(Boolean) as string[],
      }));
      try {
        // Auto-create customer if phone provided
        let customer_id: string | undefined;
        if (customerPhone?.trim()) {
          try {
            const c: any = await findOrCreateCustomer({ data: { phone: customerPhone.trim() } });
            customer_id = c?.id;
          } catch (err: any) {
            toast.error(err?.message || "Invalid customer phone");
          }
        }
        const res: any = await createOrderCall({ data: {
          order_type: orderTypeMap[orderType] || "dine_in",
          discount: discountAmt,
          items,
          payments: [{ method: methodMap[payment] || "cash", amount: total }],
          customer_id,
        }});
        const order: CompletedOrder = {
          id: res.order.id,
          number: res.order.order_number || `#${orderCounter}`,
          invoice: res.invoice?.invoice_number || `INV-${2026000 + orderCounter}`,
          invoiceId: res.invoice?.id,
          time: new Date(res.order.created_at).getTime(),
          orderType, items: cart, subtotal,
          discount: discountAmt, total, payment,
          cashier: user?.name || "—",
          customerPhone: customerPhone || undefined,
        };
        setOrderCounter(n => n + 1);
        setCompleted(c => [order, ...c]);
        setLastOrder(order);
        setCart([]); setDiscount({ type: "fixed", value: 0 }); setCustomerPhone("");
        setScreen("invoice");
        return order;
      } catch (e: any) {
        toast.error(e?.message || "Failed to create order");
        return null;
      }
    },

    refundOrder: (id) => setCompleted(c => c.map(o => o.id === id ? { ...o, refunded: true } : o)),
    totals: { subtotal, discountAmt, total, vatPortion, net },
    fmtMoney, name,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppProvider missing");
  return c;
};

export { t as translations };
