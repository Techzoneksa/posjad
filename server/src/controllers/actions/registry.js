import { supabaseAdmin } from "../../lib/supabase.js";
import { httpError } from "../../lib/http-error.js";
import {
  generateAndSignInvoice,
  runQueueOnce,
  submitInvoiceToZatca,
} from "../../services/zatca/integration.js";
import {
  getAutoRunnerState,
  startZatcaAutoRunner,
  stopZatcaAutoRunner,
} from "../../services/zatca/auto-runner.js";
import { signingServiceConfigured } from "../../services/zatca/signing-client.js";
import { encryptSecret } from "../../services/zatca/crypto.js";
import { zatcaEndpoints } from "../../services/zatca/endpoints.js";

const ADMIN_ROLES = new Set(["owner", "manager"]);
const FINANCE_ROLES = new Set(["owner", "manager", "finance"]);

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round(asNumber(value) * 100) / 100;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function assertRoles(req, roles) {
  if (roles.some((role) => req.auth.roles.includes(role))) return;
  throw httpError(403, "Forbidden: insufficient role");
}

function assertAdmin(req) {
  if (req.auth.isAdmin) return;
  throw httpError(403, "Forbidden: admin role required");
}

function assertFinance(req) {
  assertRoles(req, [...FINANCE_ROLES]);
}

async function must(query) {
  const { data, error } = await query;
  if (error) throw httpError(400, error.message, error);
  return data;
}

async function maybe(query) {
  const { data, error } = await query;
  if (error) throw httpError(400, error.message, error);
  return data ?? null;
}

function activeDb(req, privileged = false) {
  return privileged ? req.supabaseAdmin : req.supabase;
}

function selectAll(table, opts = {}) {
  return async (_input, req) => {
    if (opts.roles) assertRoles(req, opts.roles);
    const db = activeDb(req, opts.privileged);
    let q = db.from(table).select(opts.select ?? "*");
    if (opts.activeOnly) q = q.eq("active", true);
    if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? true });
    return must(q);
  };
}

function upsertRow(table, opts = {}) {
  return async (input, req) => {
    if (opts.admin !== false) assertAdmin(req);
    const payload = { ...input };
    if (opts.createdBy && !payload.created_by) payload.created_by = req.auth.uid;
    const db = activeDb(req, true);
    return maybe(db.from(table).upsert(payload).select().single());
  };
}

function deleteById(table, opts = {}) {
  return async (input, req) => {
    if (opts.admin !== false) assertAdmin(req);
    const id = input?.id;
    if (!id) throw httpError(400, "id is required");
    await must(activeDb(req, true).from(table).delete().eq("id", id));
    return { ok: true };
  };
}

async function bootstrapStatus() {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error && !String(error.message).includes("does not exist")) throw httpError(400, error.message, error);
  return { hasUsers: (count ?? 0) > 0 };
}

async function bootstrapOwner(input) {
  const status = await bootstrapStatus();
  if (status.hasUsers) throw httpError(409, "Bootstrap is locked because users already exist");
  const { fullName, username, email, password } = input ?? {};
  if (!fullName || !username || !email || !password) {
    throw httpError(400, "fullName, username, email and password are required");
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      role: "owner",
    },
  });
  if (error) throw httpError(400, error.message, error);

  await must(
    supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      username,
      active: true,
    }),
  );
  await must(
    supabaseAdmin.from("user_roles").upsert({
      user_id: data.user.id,
      role: "owner",
    }),
  );

  return { ok: true, userId: data.user.id };
}

async function listCatalog(_input, req) {
  const db = req.supabase;
  const [categories, products, addonGroups, addons, productAddonGroups] = await Promise.all([
    must(db.from("categories").select("*").order("sort_order", { ascending: true })),
    must(db.from("products").select("*").order("name_ar", { ascending: true })),
    must(db.from("addon_groups").select("*").order("name_ar", { ascending: true })),
    must(db.from("addons").select("*").order("name_ar", { ascending: true })),
    must(db.from("product_addon_groups").select("*").order("sort_order", { ascending: true })),
  ]);
  return { categories, products, addonGroups, addons, productAddonGroups };
}

async function linkAddonGroup(input, req) {
  assertAdmin(req);
  const { product_id, group_id, sort_order = 0 } = input ?? {};
  if (!product_id || !group_id) throw httpError(400, "product_id and group_id are required");
  return maybe(
    req.supabaseAdmin
      .from("product_addon_groups")
      .upsert({ product_id, group_id, sort_order }, { onConflict: "product_id,group_id" })
      .select()
      .single(),
  );
}

async function unlinkAddonGroup(input, req) {
  assertAdmin(req);
  const { product_id, group_id } = input ?? {};
  if (!product_id || !group_id) throw httpError(400, "product_id and group_id are required");
  await must(req.supabaseAdmin.from("product_addon_groups").delete().eq("product_id", product_id).eq("group_id", group_id));
  return { ok: true };
}

async function getRestaurantSettings(_input, req) {
  const row = await maybe(req.supabase.from("restaurant_settings").select("*").eq("id", true).maybeSingle());
  return row;
}

async function updateRestaurantSettings(input, req) {
  assertAdmin(req);
  return maybe(
    req.supabaseAdmin
      .from("restaurant_settings")
      .upsert({ ...input, id: true, updated_by: req.auth.uid })
      .select()
      .single(),
  );
}

async function listUsers(_input, req) {
  assertAdmin(req);
  const profiles = await must(req.supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }));
  const roles = await must(req.supabaseAdmin.from("user_roles").select("user_id, role"));
  const roleByUser = new Map(roles.map((r) => [r.user_id, r.role]));
  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    username: p.username,
    email: null,
    role: roleByUser.get(p.id) ?? "cashier",
    active: p.active,
    last_login: p.last_login,
    created_at: p.created_at,
  }));
}

async function createUser(input, req) {
  assertAdmin(req);
  const { fullName, username, role, email, password, active = true } = input ?? {};
  if (!fullName || !username || !role || !password) throw httpError(400, "fullName, username, role and password are required");
  const userEmail = role === "cashier" && !email ? `${username.toLowerCase()}@pos.local` : email;
  if (!userEmail) throw httpError(400, "email is required for non-cashier users");

  const { data, error } = await req.supabaseAdmin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, role },
  });
  if (error) throw httpError(400, error.message, error);
  await must(req.supabaseAdmin.from("profiles").upsert({ id: data.user.id, full_name: fullName, username, active }));
  await must(req.supabaseAdmin.from("user_roles").upsert({ user_id: data.user.id, role }, { onConflict: "user_id,role" }));
  return { id: data.user.id };
}

async function updateUser(input, req) {
  assertAdmin(req);
  const { id, fullName, username, role, active } = input ?? {};
  if (!id) throw httpError(400, "id is required");
  await must(req.supabaseAdmin.from("profiles").update({ full_name: fullName, username, active }).eq("id", id));
  if (role) {
    await must(req.supabaseAdmin.from("user_roles").delete().eq("user_id", id));
    await must(req.supabaseAdmin.from("user_roles").insert({ user_id: id, role }));
    await req.supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { role, full_name: fullName, username } });
  }
  return { ok: true };
}

async function resetCredentials(input, req) {
  assertAdmin(req);
  const { id, password } = input ?? {};
  if (!id || !password) throw httpError(400, "id and password are required");
  const { error } = await req.supabaseAdmin.auth.admin.updateUserById(id, { password });
  if (error) throw httpError(400, error.message, error);
  return { ok: true };
}

async function setUserActive(input, req) {
  assertAdmin(req);
  await must(req.supabaseAdmin.from("profiles").update({ active: Boolean(input?.active) }).eq("id", input?.id));
  return { ok: true };
}

async function deleteUser(input, req) {
  assertAdmin(req);
  if (!input?.id) throw httpError(400, "id is required");
  const { error } = await req.supabaseAdmin.auth.admin.deleteUser(input.id);
  if (error) throw httpError(400, error.message, error);
  return { ok: true };
}

async function getOpenShift(_input, req) {
  return maybe(
    req.supabase
      .from("shifts")
      .select("*")
      .eq("cashier_id", req.auth.uid)
      .eq("status", "open")
      .maybeSingle(),
  );
}

async function openShift(input, req) {
  const existing = await getOpenShift(input, req);
  if (existing) throw httpError(409, "You already have an open shift");
  return maybe(
    req.supabase
      .from("shifts")
      .insert({ cashier_id: req.auth.uid, opening_float: round2(input?.opening_float ?? 0) })
      .select()
      .single(),
  );
}

async function getShiftSummary(input, req) {
  const shiftId = input?.shift_id;
  if (!shiftId) throw httpError(400, "shift_id is required");
  const shift = await maybe(req.supabase.from("shifts").select("*").eq("id", shiftId).single());
  if (!shift) throw httpError(404, "Shift not found");
  const [orders, payments, refunds, cashMovements] = await Promise.all([
    must(req.supabase.from("orders").select("*").eq("shift_id", shiftId)),
    must(req.supabase.from("payments").select("method, amount, orders!inner(shift_id)").eq("orders.shift_id", shiftId)),
    must(req.supabase.from("refunds").select("*").eq("cashier_id", shift.cashier_id)),
    must(req.supabase.from("cash_drawer_movements").select("*").eq("shift_id", shiftId)),
  ]);
  const sumPay = (method) => payments.filter((p) => p.method === method && Number(p.amount) > 0).reduce((s, p) => s + Number(p.amount), 0);
  const cashRefunds = payments.filter((p) => p.method === "cash" && Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0);
  const cashAdditions = cashMovements.filter((m) => m.type === "pay_in").reduce((s, m) => s + Number(m.amount), 0);
  const cashExpenses = cashMovements.filter((m) => m.type === "pay_out").reduce((s, m) => s + Number(m.amount), 0);
  const cashSales = sumPay("cash");
  return {
    openingCash: Number(shift.opening_float),
    cashSales,
    mada: sumPay("mada"),
    apple: sumPay("apple_pay"),
    visa: sumPay("visa") + sumPay("mastercard") + sumPay("card"),
    cashRefunds,
    cashExpenses,
    cashAdditions,
    expected: round2(Number(shift.opening_float) + cashSales + cashAdditions - cashRefunds - cashExpenses),
    refunded: refunds.reduce((s, r) => s + Number(r.amount), 0),
    discounts: orders.reduce((s, o) => s + Number(o.discount_amount ?? o.discount ?? 0), 0),
    net: orders.reduce((s, o) => s + Number(o.net_amount_excluding_vat ?? 0), 0),
  };
}

async function closeShift(input, req) {
  const summary = await getShiftSummary(input, req);
  const closing = round2(input?.closing_cash ?? 0);
  return maybe(
    req.supabase
      .from("shifts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_cash: closing,
        expected_cash: summary.expected,
        variance: round2(closing - summary.expected),
      })
      .eq("id", input.shift_id)
      .select()
      .single(),
  );
}

async function listShifts(input, req) {
  assertFinance(req);
  let q = req.supabase.from("shifts").select("*, profiles(full_name, username)").order("opened_at", { ascending: false });
  if (input?.status) q = q.eq("status", input.status);
  if (input?.from) q = q.gte("opened_at", input.from);
  if (input?.to) q = q.lte("opened_at", input.to);
  return must(q.limit(input?.limit ?? 100));
}

async function findOrCreateCustomerByPhone(input, req) {
  const phone = String(input?.phone ?? "").trim();
  if (!phone) return null;
  const existing = await maybe(req.supabase.from("customers").select("*").eq("phone", phone).maybeSingle());
  if (existing) return existing;
  return maybe(req.supabase.from("customers").insert({ name: phone, phone }).select().single());
}

async function createOrder(input, req) {
  const items = Array.isArray(input?.items) ? input.items : [];
  if (!items.length) throw httpError(400, "items are required");
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const addonIds = [...new Set(items.flatMap((i) => i.addon_ids ?? []).filter(Boolean))];
  const [products, addons, shift] = await Promise.all([
    productIds.length ? must(req.supabase.from("products").select("*").in("id", productIds)) : [],
    addonIds.length ? must(req.supabase.from("addons").select("*").in("id", addonIds)) : [],
    getOpenShift(input, req),
  ]);
  const productsById = new Map(products.map((p) => [p.id, p]));
  const addonsById = new Map(addons.map((a) => [a.id, a]));
  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productsById.get(item.product_id);
    if (!product) throw httpError(400, `Unknown product_id: ${item.product_id}`);
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    const itemAddons = (item.addon_ids ?? []).map((id) => addonsById.get(id)).filter(Boolean);
    const addonsTotal = itemAddons.reduce((s, a) => s + Number(a.price_delta ?? 0), 0);
    const unit = Number(product.price) + addonsTotal;
    const line = round2(unit * quantity);
    subtotal += line;
    orderItems.push({ source: item, product, itemAddons, quantity, unit, line });
  }

  subtotal = round2(subtotal);
  const discount = round2(input?.discount ?? 0);
  const total = round2(Math.max(0, subtotal - discount));
  const vat = round2(total - total / 1.15);
  const net = round2(total - vat);

  const order = await maybe(
    req.supabase
      .from("orders")
      .insert({
        shift_id: shift?.id ?? input?.shift_id ?? null,
        cashier_id: req.auth.uid,
        customer_id: input?.customer_id ?? null,
        order_type: input?.order_type ?? "dine_in",
        status: "completed",
        subtotal,
        discount,
        tax: vat,
        total,
        subtotal_before_discount: subtotal,
        discount_amount: discount,
        total_including_vat: total,
        vat_included_amount: vat,
        net_amount_excluding_vat: net,
        notes: input?.notes ?? null,
      })
      .select()
      .single(),
  );

  const insertedItems = [];
  for (const item of orderItems) {
    const row = await maybe(
      req.supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: item.product.id,
          name_snapshot: item.product.name_ar || item.product.name_en,
          unit_price: item.unit,
          quantity: item.quantity,
          line_total: item.line,
          notes: item.source.notes ?? null,
        })
        .select()
        .single(),
    );
    insertedItems.push(row);
    if (item.itemAddons.length) {
      await must(
        req.supabase.from("order_item_addons").insert(
          item.itemAddons.map((addon) => ({
            order_item_id: row.id,
            addon_id: addon.id,
            name_snapshot: addon.name_ar || addon.name_en,
            price_delta_snapshot: addon.price_delta ?? 0,
          })),
        ),
      );
    }
  }

  const payments = Array.isArray(input?.payments) && input.payments.length ? input.payments : [{ method: "cash", amount: total }];
  const paymentRows = await must(
    req.supabase.from("payments").insert(
      payments.map((p) => ({
        order_id: order.id,
        method: p.method ?? "cash",
        amount: round2(p.amount ?? total),
        reference: p.reference ?? null,
      })),
    ).select(),
  );
  const invoice = await maybe(req.supabase.from("invoices").insert({ order_id: order.id }).select().single());

  return { order, invoice, items: insertedItems, payments: paymentRows };
}

async function holdOrder(input, req) {
  const shift = await getOpenShift(input, req);
  return maybe(
    req.supabase
      .from("held_orders")
      .insert({
        cashier_id: req.auth.uid,
        shift_id: shift?.id ?? input?.shift_id ?? null,
        customer_id: input?.customer_id ?? null,
        order_type: input?.order_type ?? "dine_in",
        cart_json: input?.cart ?? {},
        note: input?.note ?? null,
      })
      .select()
      .single(),
  );
}

async function listHeldOrders(_input, req) {
  return must(req.supabase.from("held_orders").select("*").order("held_at", { ascending: false }).limit(100));
}

async function resumeHeldOrder(input, req) {
  const row = await maybe(req.supabase.from("held_orders").select("*").eq("id", input?.id).single());
  if (!row) throw httpError(404, "Held order not found");
  await must(req.supabase.from("held_orders").delete().eq("id", input.id));
  return row;
}

async function discardHeldOrder(input, req) {
  await must(req.supabase.from("held_orders").delete().eq("id", input?.id));
  return { ok: true };
}

async function listRecentOrders(input, req) {
  let q = req.supabase
    .from("orders")
    .select("*, invoices(invoice_number), payments(method, amount), profiles(full_name, username), customers(phone)")
    .order("created_at", { ascending: false });
  if (input?.today) {
    const { from, to } = todayRange();
    q = q.gte("created_at", from).lt("created_at", to);
  }
  if (input?.q) {
    const term = `%${input.q}%`;
    q = q.or(`order_number.ilike.${term}`);
  }
  const rows = await must(q.range(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 100) - 1));
  return rows.map((r) => ({
    id: r.id,
    order_number: r.order_number,
    invoice_number: r.invoices?.[0]?.invoice_number ?? null,
    order_type: r.order_type,
    status: r.status,
    subtotal_before_discount: Number(r.subtotal_before_discount ?? r.subtotal ?? 0),
    discount_amount: Number(r.discount_amount ?? r.discount ?? 0),
    total_including_vat: Number(r.total_including_vat ?? r.total ?? 0),
    vat_included_amount: Number(r.vat_included_amount ?? r.tax ?? 0),
    net_amount_excluding_vat: Number(r.net_amount_excluding_vat ?? 0),
    created_at: r.created_at,
    cashier_name: r.profiles?.full_name || r.profiles?.username || "",
    payment_method: r.payments?.length > 1 ? "mixed" : r.payments?.[0]?.method ?? null,
    customer_phone: r.customers?.phone ?? null,
  }));
}

async function getOrder(input, req) {
  const orderId = input?.order_id ?? input?.id;
  if (!orderId) throw httpError(400, "order_id is required");
  const [order, items, payments, invoice, refunds] = await Promise.all([
    maybe(req.supabase.from("orders").select("*, profiles(full_name, username), customers(*)").eq("id", orderId).single()),
    must(req.supabase.from("order_items").select("*, order_item_addons(*)").eq("order_id", orderId)),
    must(req.supabase.from("payments").select("*").eq("order_id", orderId)),
    maybe(req.supabase.from("invoices").select("*").eq("order_id", orderId).maybeSingle()),
    must(req.supabase.from("refunds").select("*, refund_items(*)").eq("order_id", orderId)),
  ]);
  if (!order) throw httpError(404, "Order not found");
  const refundedByItem = new Map();
  for (const refund of refunds) {
    for (const item of refund.refund_items ?? []) {
      refundedByItem.set(item.order_item_id, (refundedByItem.get(item.order_item_id) ?? 0) + Number(item.quantity));
    }
  }
  return {
    order,
    items: items.map((it) => {
      const already = refundedByItem.get(it.id) ?? 0;
      return {
        ...it,
        addons: it.order_item_addons ?? [],
        already_refunded_quantity: already,
        remaining_refundable_quantity: Math.max(0, Number(it.quantity) - already),
      };
    }),
    payments,
    invoice,
    customer: order.customers ?? null,
    cashier_name: order.profiles?.full_name || order.profiles?.username || "",
  };
}

async function createRefund(input, req) {
  const order = await maybe(req.supabase.from("orders").select("*").eq("id", input?.order_id).single());
  if (!order) throw httpError(404, "Order not found");
  const detail = await getOrder({ order_id: order.id }, req);
  const items = Array.isArray(input?.items) ? input.items : [];
  const isPartial = input?.type === "partial" && items.length > 0;
  let amount = Number(order.total_including_vat ?? order.total ?? 0);
  if (isPartial) {
    const byId = new Map(detail.items.map((it) => [it.id, it]));
    amount = round2(items.reduce((sum, item) => sum + Number(byId.get(item.order_item_id)?.unit_price ?? 0) * Number(item.quantity ?? 0), 0));
  }
  const refund = await maybe(
    req.supabase
      .from("refunds")
      .insert({
        order_id: order.id,
        cashier_id: req.auth.uid,
        reason: input?.reason ?? "POS refund",
        amount,
        type: isPartial ? "partial" : "full",
        payment_method: input?.payment_method ?? "cash",
        invoice_number: detail.invoice?.invoice_number ?? null,
      })
      .select()
      .single(),
  );
  if (isPartial) {
    await must(
      req.supabase.from("refund_items").insert(
        items.map((item) => ({
          refund_id: refund.id,
          order_item_id: item.order_item_id,
          quantity: item.quantity,
          amount: round2(Number(detail.items.find((it) => it.id === item.order_item_id)?.unit_price ?? 0) * Number(item.quantity)),
        })),
      ),
    );
  }
  await must(req.supabase.from("payments").insert({ order_id: order.id, method: input?.payment_method ?? "cash", amount: -amount }));
  await must(req.supabase.from("orders").update({ status: isPartial ? "partially_refunded" : "refunded" }).eq("id", order.id));
  return { ok: true, refund };
}

async function recordCashMovement(input, req) {
  return maybe(
    req.supabase
      .from("cash_drawer_movements")
      .insert({
        shift_id: input?.shift_id,
        cashier_id: req.auth.uid,
        type: input?.type,
        amount: round2(input?.amount),
        reason: input?.reason ?? null,
      })
      .select()
      .single(),
  );
}

async function listCashMovements(input, req) {
  let q = req.supabase.from("cash_drawer_movements").select("*").order("occurred_at", { ascending: false });
  if (input?.shift_id) q = q.eq("shift_id", input.shift_id);
  return must(q.limit(input?.limit ?? 100));
}

async function getDashboardSummary(_input, req) {
  assertFinance(req);
  const { from, to } = todayRange();
  const [orders, payments, shifts, held, items] = await Promise.all([
    must(req.supabase.from("orders").select("*").gte("created_at", from).lt("created_at", to)),
    must(req.supabase.from("payments").select("method, amount, orders!inner(created_at)").gte("orders.created_at", from).lt("orders.created_at", to)),
    must(req.supabase.from("shifts").select("*").gte("opened_at", from).lt("opened_at", to)),
    must(req.supabase.from("held_orders").select("id")),
    must(req.supabase.from("order_items").select("product_id, name_snapshot, quantity, line_total, orders!inner(created_at)").gte("orders.created_at", from).lt("orders.created_at", to)),
  ]);
  const gross = round2(orders.reduce((s, o) => s + Number(o.total_including_vat ?? o.total ?? 0), 0));
  const discounts = round2(orders.reduce((s, o) => s + Number(o.discount_amount ?? o.discount ?? 0), 0));
  const vatIncluded = round2(orders.reduce((s, o) => s + Number(o.vat_included_amount ?? o.tax ?? 0), 0));
  const refunds = round2(payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0));
  const byMethod = {};
  for (const p of payments) byMethod[p.method] = round2((byMethod[p.method] ?? 0) + Number(p.amount));
  const byTypeMap = new Map();
  for (const o of orders) byTypeMap.set(o.order_type, (byTypeMap.get(o.order_type) ?? 0) + 1);
  const topMap = new Map();
  for (const item of items) {
    const prev = topMap.get(item.product_id ?? item.name_snapshot) ?? { product_id: item.product_id, name: item.name_snapshot, qty: 0, value: 0 };
    prev.qty += Number(item.quantity);
    prev.value += Number(item.line_total);
    topMap.set(item.product_id ?? item.name_snapshot, prev);
  }
  return {
    gross,
    net: round2(gross - refunds),
    ordersCount: orders.length,
    aov: orders.length ? round2(gross / orders.length) : 0,
    byMethod,
    byOrderType: [...byTypeMap].map(([order_type, orders]) => ({ order_type, orders })),
    topProducts: [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    vatIncluded,
    discounts,
    refunds,
    activeShifts: shifts.filter((s) => s.status === "open").length,
    closedShiftsToday: shifts.filter((s) => s.status === "closed").length,
    heldOrders: held.length,
    mixedTotal: byMethod.mixed ?? 0,
  };
}

async function reportRows(input, req) {
  assertFinance(req);
  const date = input?.date ?? new Date().toISOString().slice(0, 10);
  const from = new Date(`${date}T00:00:00`).toISOString();
  const to = new Date(`${date}T00:00:00`);
  to.setDate(to.getDate() + 1);
  let q = req.supabase.from("orders").select("*, payments(method, amount), profiles(full_name, username)").gte("created_at", from).lt("created_at", to.toISOString());
  if (input?.cashier_id) q = q.eq("cashier_id", input.cashier_id);
  if (input?.order_type) q = q.eq("order_type", input.order_type);
  const rows = await must(q);
  return { date, rows, summary: await getDashboardSummary({}, req) };
}

async function listAuditLogs(input, req) {
  assertFinance(req);
  let q = req.supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
  if (input?.action) q = q.eq("action", input.action);
  if (input?.entity) q = q.eq("entity", input.entity);
  return must(q.limit(input?.limit ?? 200));
}

async function getReadinessSnapshot(_input, req) {
  assertFinance(req);
  const tables = ["profiles", "products", "orders", "restaurant_settings", "zatca_settings"];
  const checks = {};
  for (const table of tables) {
    const { count, error } = await req.supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    checks[table] = { ok: !error, count: count ?? 0, error: error?.message ?? null };
  }
  return { generatedAt: new Date().toISOString(), checks };
}

async function getZatcaSettings(_input, req) {
  assertFinance(req);
  return maybe(req.supabase.from("zatca_settings").select("*").eq("id", true).maybeSingle());
}

async function getZatcaDeviceKeys(req) {
  return maybe(req.supabaseAdmin.from("zatca_device_keys").select("*").eq("id", true).maybeSingle());
}

async function updateZatcaSettings(input, req) {
  assertAdmin(req);
  return maybe(req.supabaseAdmin.from("zatca_settings").upsert({ ...input, id: true, updated_by: req.auth.uid }).select().single());
}

async function listZatcaInvoices(input, req) {
  assertFinance(req);
  let q = req.supabase.from("zatca_invoices").select("*").order("created_at", { ascending: false });
  if (input?.status) q = q.eq("status", input.status);
  if (Array.isArray(input?.statuses)) q = q.in("status", input.statuses);
  return must(q.limit(input?.limit ?? 200));
}

async function getZatcaForInvoice(input, req) {
  const invoiceId = input?.invoice_id ?? input?.invoiceId;
  if (!invoiceId) throw httpError(400, "invoice_id is required");
  return maybe(req.supabase.from("zatca_invoices").select("*").eq("invoice_id", invoiceId).maybeSingle());
}

async function listZatcaCreditNotes(input, req) {
  assertFinance(req);
  return must(req.supabase.from("zatca_credit_notes").select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 200));
}

async function listZatcaLogs(input, req) {
  assertFinance(req);
  return must(req.supabase.from("zatca_logs").select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 200));
}

async function getZatcaLifecycleSummary(_input, req) {
  assertFinance(req);
  const rows = await must(req.supabase.from("zatca_invoices").select("status, created_at, id, invoice_id, order_id, environment, retry_count, updated_at, zatca_http_status").order("created_at", { ascending: false }).limit(500));
  const counts = { all: rows.length };
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { networkDisabled: false, counts, latest: rows[0] ?? null, autoRunner: getAutoRunnerState() };
}

async function getZatcaConnectionStatus(_input, req) {
  assertFinance(req);
  const settings = await getZatcaSettings({}, req);
  return {
    ok: Boolean(settings),
    environment: settings?.environment ?? "simulation",
    onboarding_status: settings?.onboarding_status ?? "not_started",
    last_error: settings?.last_error ?? null,
  };
}

async function getAutoRunnerStatus(_input, req) {
  assertFinance(req);
  const settings = await getZatcaSettings({}, req);
  return { ...getAutoRunnerState(), queue_enabled: Boolean(settings?.queue_enabled) };
}

async function setQueueEnabled(input, req) {
  assertAdmin(req);
  const enabled = Boolean(input?.enabled);
  const row = await maybe(req.supabaseAdmin.from("zatca_settings").update({ queue_enabled: enabled }).eq("id", true).select().single());
  return { ok: true, enabled, settings: row };
}

function inputInvoiceId(input) {
  return input?.invoice_id ?? input?.invoiceId ?? input?.id;
}

async function generateZatcaInvoiceAction(input, req) {
  assertFinance(req);
  return generateAndSignInvoice({
    supabaseAdmin: req.supabaseAdmin,
    invoiceId: inputInvoiceId(input),
    force: Boolean(input?.force),
  });
}

async function submitZatcaInvoiceAction(input, req) {
  assertFinance(req);
  return submitInvoiceToZatca({
    supabaseAdmin: req.supabaseAdmin,
    invoiceId: inputInvoiceId(input),
    zatcaInvoiceId: input?.zatca_invoice_id ?? input?.zatcaInvoiceId,
    allowGenerate: input?.allowGenerate !== false,
  });
}

async function processZatcaQueueAction(input, req) {
  assertFinance(req);
  return runQueueOnce({
    supabaseAdmin: req.supabaseAdmin,
    limit: input?.maxItems ?? input?.limit ?? 10,
    source: "manual",
  });
}

async function startAutoRunAction(_input, req) {
  assertAdmin(req);
  await req.supabaseAdmin.from("zatca_settings").update({ queue_enabled: true }).eq("id", true);
  return startZatcaAutoRunner();
}

async function stopAutoRunAction(_input, req) {
  assertAdmin(req);
  await req.supabaseAdmin.from("zatca_settings").update({ queue_enabled: false }).eq("id", true);
  return stopZatcaAutoRunner();
}

async function getDeviceStatusAction(_input, req) {
  assertFinance(req);
  const settings = await getZatcaSettings({}, req);
  const device = await getZatcaDeviceKeys(req);
  return {
    signingServiceConfigured: signingServiceConfigured(),
    hasKey: Boolean(device?.private_key_encrypted || settings?.private_key_pem || settings?.private_key),
    hasCsr: Boolean(device?.csr_pem || settings?.csr_pem || settings?.csr_base64),
    hasComplianceCsid: Boolean(device?.compliance_csid_token_encrypted || settings?.compliance_csid_token),
    hasProductionCsid: Boolean(device?.production_csid_token_encrypted || settings?.production_csid_token),
    pihPresent: Boolean(settings?.last_pih_b64),
    onboarding_status: settings?.onboarding_status ?? "not_started",
  };
}

async function getCsidDetailsAction(_input, req) {
  assertFinance(req);
  const settings = await getZatcaSettings({}, req);
  const device = await getZatcaDeviceKeys(req);
  return {
    certificateType: device?.production_csid_token_encrypted || settings?.production_csid_token ? "production" : device?.compliance_csid_token_encrypted || settings?.compliance_csid_token ? "compliance" : null,
    hasComplianceCsid: Boolean(device?.compliance_csid_token_encrypted || settings?.compliance_csid_token),
    hasProductionCsid: Boolean(device?.production_csid_token_encrypted || settings?.production_csid_token),
    serialNumber: device?.csid_serial_number ?? settings?.csid_serial_number ?? null,
    issuedAt: device?.csid_issued_at ?? settings?.csid_issued_at ?? null,
    expiresAt: device?.csid_expires_at ?? settings?.csid_expires_at ?? null,
  };
}

async function prepareDeviceCsrAction(_input, req) {
  assertAdmin(req);
  const status = await getDeviceStatusAction({}, req);
  return {
    ok: status.hasKey,
    stage: "device_key_check",
    message: status.hasKey
      ? "Device key exists. Generate CSR with the official ZATCA onboarding SDK flow and store the encrypted CSID values before signing."
      : "Device key is missing. Store encrypted device credentials before onboarding.",
    ...status,
  };
}

async function submitOnboardingOtpAction(input, req) {
  assertAdmin(req);
  const otp = input?.otp;
  if (!otp) throw httpError(400, "otp is required");
  const settingsBefore = await getZatcaSettings({}, req);
  const device = await getZatcaDeviceKeys(req);
  if (!device?.csr_pem) {
    throw httpError(409, "CSR is missing. Prepare/store csr_pem in zatca_device_keys before submitting OTP.");
  }

  const endpoint = zatcaEndpoints(settingsBefore ?? {}).complianceCsid;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "accept-version": "V2",
      otp: String(otp),
    },
    body: JSON.stringify({ csr: Buffer.from(device.csr_pem, "utf8").toString("base64") }),
  });

  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }

  if (!response.ok) {
    await req.supabaseAdmin.from("zatca_settings").update({
      onboarding_status: "failed",
      last_error: `CSID HTTP ${response.status}: ${text.slice(0, 300)}`,
      updated_by: req.auth.uid,
    }).eq("id", true);
    throw httpError(response.status, "ZATCA compliance CSID request failed", body);
  }

  const token = body?.binarySecurityToken ?? body?.token;
  const secret = body?.secret;
  const requestId = body?.requestID ?? body?.requestId;
  if (!token || !secret) {
    throw httpError(502, "ZATCA CSID response is missing token or secret", body);
  }

  const encToken = encryptSecret(String(token));
  const encSecret = encryptSecret(String(secret));
  await req.supabaseAdmin.from("zatca_device_keys").update({
    compliance_csid_token_encrypted: encToken.ciphertext,
    compliance_csid_iv: encToken.iv,
    compliance_csid_secret_encrypted: encSecret.ciphertext,
    compliance_csid_secret_iv: encSecret.iv,
    compliance_request_id: requestId ? String(requestId) : null,
    csid_issued_at: new Date().toISOString(),
  }).eq("id", true);

  const settings = await maybe(req.supabaseAdmin.from("zatca_settings").update({
    onboarding_status: "onboarded",
    compliance_csid_at: new Date().toISOString(),
    last_error: null,
    updated_by: req.auth.uid,
  }).eq("id", true).select().single());
  return {
    ok: true,
    status: response.status,
    requestId: requestId ? String(requestId) : null,
    onboarding_status: settings?.onboarding_status,
  };
}

async function listCustomersWithStats(input, req) {
  assertFinance(req);
  let q = req.supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (input?.q) q = q.or(`name.ilike.%${input.q}%,phone.ilike.%${input.q}%`);
  const rows = await must(q.limit(input?.limit ?? 100));
  return rows.map((row) => ({ ...row, orders_count: 0, total_purchases: 0 }));
}

async function getCustomerHistory(input, req) {
  assertFinance(req);
  const customerId = input?.customer_id ?? input?.id;
  if (!customerId) throw httpError(400, "customer_id is required");
  const [customer, orders] = await Promise.all([
    maybe(req.supabase.from("customers").select("*").eq("id", customerId).single()),
    must(req.supabase.from("orders").select("*, invoices(invoice_number)").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100)),
  ]);
  return { customer, orders, orders_count: orders.length, total_purchases: orders.reduce((s, o) => s + Number(o.total_including_vat ?? o.total ?? 0), 0) };
}

async function createPurchase(input, req) {
  assertAdmin(req);
  const items = Array.isArray(input?.items) ? input.items : [];
  const invoice = await maybe(req.supabaseAdmin.from("purchase_invoices").insert({ ...input, items: undefined, created_by: req.auth.uid }).select().single());
  if (items.length) {
    await must(
      req.supabaseAdmin.from("purchase_items").insert(
        items.map((item) => ({ ...item, purchase_invoice_id: invoice.id })),
      ),
    );
  }
  return { invoice };
}

async function saveRecipe(input, req) {
  assertAdmin(req);
  const { product_id, ingredients = [], active = true } = input ?? {};
  if (!product_id) throw httpError(400, "product_id is required");
  const recipe = await maybe(req.supabaseAdmin.from("product_recipes").upsert({ product_id, active }, { onConflict: "product_id" }).select().single());
  await must(req.supabaseAdmin.from("recipe_ingredients").delete().eq("recipe_id", recipe.id));
  if (ingredients.length) {
    await must(req.supabaseAdmin.from("recipe_ingredients").insert(ingredients.map((it) => ({ ...it, recipe_id: recipe.id }))));
  }
  return recipe;
}

async function createAdjustment(input, req) {
  assertAdmin(req);
  const item = await maybe(req.supabaseAdmin.from("inventory_items").select("*").eq("id", input?.inventory_item_id).single());
  if (!item) throw httpError(404, "Inventory item not found");
  const oldQty = Number(item.current_quantity);
  const newQty = Number(input?.new_quantity);
  const difference = round2(newQty - oldQty);
  await must(req.supabaseAdmin.from("inventory_items").update({ current_quantity: newQty }).eq("id", item.id));
  return maybe(
    req.supabaseAdmin
      .from("stock_adjustments")
      .insert({ ...input, old_quantity: oldQty, new_quantity: newQty, difference, created_by: req.auth.uid })
      .select()
      .single(),
  );
}

async function createWaste(input, req) {
  assertAdmin(req);
  return maybe(req.supabaseAdmin.from("waste_records").insert({ ...input, created_by: req.auth.uid }).select().single());
}

async function transferBetweenAccounts(input, req) {
  assertFinance(req);
  return { ok: true, pendingAccountingAutomation: true, input };
}

async function createExpense(input, req) {
  assertFinance(req);
  return maybe(req.supabaseAdmin.from("expenses").insert({ ...input, created_by: req.auth.uid }).select().single());
}

async function createJournalEntry(input, req) {
  assertFinance(req);
  const { lines = [], ...entry } = input ?? {};
  const row = await maybe(req.supabaseAdmin.from("journal_entries").insert({ ...entry, created_by: req.auth.uid }).select().single());
  if (lines.length) {
    await must(req.supabaseAdmin.from("journal_lines").insert(lines.map((line) => ({ ...line, journal_entry_id: row.id }))));
  }
  return row;
}

async function previewPayroll(input, req) {
  assertFinance(req);
  const employees = await must(req.supabase.from("employees").select("*").eq("status", "active"));
  return employees.map((e) => ({ employee_id: e.id, name: e.name, basic: Number(e.monthly_salary), advances: 0, deductions: 0, net: Number(e.monthly_salary), month: input?.month }));
}

async function generatePayroll(input, req) {
  assertFinance(req);
  const preview = await previewPayroll(input, req);
  if (!preview.length) return [];
  return must(req.supabaseAdmin.from("salary_records").upsert(preview.map((p) => ({ ...p, status: "unpaid" })), { onConflict: "employee_id,month" }).select());
}

async function paySalaryRecord(input, req) {
  assertFinance(req);
  return maybe(req.supabaseAdmin.from("salary_records").update({ status: "paid", paid_at: new Date().toISOString(), paid_from_account_id: input?.paid_from_account_id, paid_amount: input?.amount }).eq("id", input?.id).select().single());
}

export const actionRegistry = {
  bootstrapStatus: { auth: false, handler: bootstrapStatus },
  bootstrapOwner: { auth: false, handler: bootstrapOwner },

  listCatalog: { handler: listCatalog },
  upsertCategory: { handler: upsertRow("categories") },
  deleteCategory: { handler: deleteById("categories") },
  upsertProduct: { handler: upsertRow("products") },
  deleteProduct: { handler: deleteById("products") },
  upsertAddonGroup: { handler: upsertRow("addon_groups") },
  deleteAddonGroup: { handler: deleteById("addon_groups") },
  upsertAddon: { handler: upsertRow("addons") },
  deleteAddon: { handler: deleteById("addons") },
  linkAddonGroup: { handler: linkAddonGroup },
  unlinkAddonGroup: { handler: unlinkAddonGroup },

  listUsers: { handler: listUsers },
  createUser: { handler: createUser },
  updateUser: { handler: updateUser },
  resetCredentials: { handler: resetCredentials },
  setUserActive: { handler: setUserActive },
  deleteUser: { handler: deleteUser },

  getRestaurantSettings: { handler: getRestaurantSettings },
  updateRestaurantSettings: { handler: updateRestaurantSettings },

  getOpenShift: { handler: getOpenShift },
  openShift: { handler: openShift },
  closeShift: { handler: closeShift },
  getShiftSummary: { handler: getShiftSummary },
  listShifts: { handler: listShifts },

  createOrder: { handler: createOrder },
  updateOrderStatus: { handler: async (input, req) => maybe(req.supabase.from("orders").update({ status: input?.status }).eq("id", input?.id ?? input?.order_id).select().single()) },
  listRecentOrders: { handler: listRecentOrders },
  getOrder: { handler: getOrder },
  findCustomerByPhone: { handler: async (input, req) => maybe(req.supabase.from("customers").select("*").eq("phone", input?.phone).maybeSingle()) },
  findOrCreateCustomerByPhone: { handler: findOrCreateCustomerByPhone },
  listCustomers: { handler: selectAll("customers", { order: { column: "created_at", ascending: false } }) },
  upsertCustomer: { handler: upsertRow("customers", { admin: false }) },
  listCustomersWithStats: { handler: listCustomersWithStats },
  getCustomerHistory: { handler: getCustomerHistory },
  createRefund: { handler: createRefund },
  listRefunds: { handler: selectAll("refunds", { roles: [...FINANCE_ROLES], order: { column: "refunded_at", ascending: false } }) },
  holdOrder: { handler: holdOrder },
  listHeldOrders: { handler: listHeldOrders },
  resumeHeldOrder: { handler: resumeHeldOrder },
  discardHeldOrder: { handler: discardHeldOrder },
  recordCashMovement: { handler: recordCashMovement },
  listCashMovements: { handler: listCashMovements },

  listSuppliers: { handler: selectAll("suppliers", { roles: [...FINANCE_ROLES], order: { column: "supplier_name" } }) },
  upsertSupplier: { handler: upsertRow("suppliers") },
  setSupplierActive: { handler: async (input, req) => { assertAdmin(req); return maybe(req.supabaseAdmin.from("suppliers").update({ active: input?.active }).eq("id", input?.id).select().single()); } },
  getSupplierProfile: { handler: async (input, req) => ({ supplier: await maybe(req.supabase.from("suppliers").select("*").eq("id", input?.id).single()), purchases: await must(req.supabase.from("purchase_invoices").select("*").eq("supplier_id", input?.id).order("invoice_date", { ascending: false })) }) },
  listInventory: { handler: selectAll("inventory_items", { roles: [...FINANCE_ROLES], order: { column: "name_ar" } }) },
  upsertInventoryItem: { handler: upsertRow("inventory_items") },
  setInventoryActive: { handler: async (input, req) => { assertAdmin(req); return maybe(req.supabaseAdmin.from("inventory_items").update({ active: input?.active }).eq("id", input?.id).select().single()); } },
  listItemMovements: { handler: async (input, req) => { assertFinance(req); let q = req.supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }); if (input?.inventory_item_id) q = q.eq("inventory_item_id", input.inventory_item_id); return must(q.limit(input?.limit ?? 100)); } },
  listPurchases: { handler: selectAll("purchase_invoices", { roles: [...FINANCE_ROLES], order: { column: "invoice_date", ascending: false } }) },
  getPurchase: { handler: async (input, req) => ({ purchase: await maybe(req.supabase.from("purchase_invoices").select("*").eq("id", input?.id).single()), items: await must(req.supabase.from("purchase_items").select("*").eq("purchase_invoice_id", input?.id)) }) },
  createPurchase: { handler: createPurchase },
  listRecipes: { handler: async (_input, req) => ({ recipes: await must(req.supabase.from("product_recipes").select("*")), ingredients: await must(req.supabase.from("recipe_ingredients").select("*")) }) },
  saveRecipe: { handler: saveRecipe },
  deleteRecipe: { handler: deleteById("product_recipes") },
  createAdjustment: { handler: createAdjustment },
  listAdjustments: { handler: selectAll("stock_adjustments", { roles: [...FINANCE_ROLES], order: { column: "created_at", ascending: false } }) },
  createWaste: { handler: createWaste },
  listWaste: { handler: selectAll("waste_records", { roles: [...FINANCE_ROLES], order: { column: "created_at", ascending: false } }) },

  listFinanceAccounts: { handler: selectAll("finance_accounts", { roles: [...FINANCE_ROLES], order: { column: "name_ar" } }) },
  upsertFinanceAccount: { handler: upsertRow("finance_accounts") },
  listAccountMovements: { handler: async (input, req) => { assertFinance(req); let q = req.supabase.from("account_movements").select("*").order("occurred_at", { ascending: false }); if (input?.account_id) q = q.eq("account_id", input.account_id); return must(q.limit(input?.limit ?? 100)); } },
  transferBetweenAccounts: { handler: transferBetweenAccounts },
  recordCashAdjustment: { handler: transferBetweenAccounts },
  listExpenses: { handler: selectAll("expenses", { roles: [...FINANCE_ROLES], order: { column: "expense_date", ascending: false } }) },
  createExpense: { handler: createExpense },
  listChartAccounts: { handler: selectAll("chart_accounts", { roles: [...FINANCE_ROLES], order: { column: "code" } }) },
  upsertChartAccount: { handler: upsertRow("chart_accounts") },
  listJournalEntries: { handler: async (_input, req) => { assertFinance(req); return must(req.supabase.from("journal_entries").select("*, journal_lines(*)").order("entry_date", { ascending: false }).limit(100)); } },
  createJournalEntry: { handler: createJournalEntry },
  reverseJournalEntry: { handler: async (input, req) => { assertFinance(req); return maybe(req.supabaseAdmin.from("journal_entries").update({ status: "reversed" }).eq("id", input?.id).select().single()); } },
  listSupplierPayments: { handler: selectAll("supplier_payments", { roles: [...FINANCE_ROLES], order: { column: "paid_at", ascending: false } }) },
  createSupplierPayment: { handler: upsertRow("supplier_payments", { createdBy: true }) },
  getFinanceSummary: { handler: async (_input, req) => ({ accounts: await must(req.supabase.from("finance_accounts").select("*")), expenses: await must(req.supabase.from("expenses").select("*").limit(100)) }) },

  listEmployees: { handler: selectAll("employees", { roles: [...FINANCE_ROLES], order: { column: "name" } }) },
  upsertEmployee: { handler: upsertRow("employees") },
  setEmployeeStatus: { handler: async (input, req) => { assertFinance(req); return maybe(req.supabaseAdmin.from("employees").update({ status: input?.status }).eq("id", input?.id).select().single()); } },
  listEmployeeAdjustments: { handler: selectAll("employee_adjustments", { roles: [...FINANCE_ROLES], order: { column: "created_at", ascending: false } }) },
  createEmployeeAdjustment: { handler: upsertRow("employee_adjustments", { createdBy: true }) },
  deleteEmployeeAdjustment: { handler: deleteById("employee_adjustments") },
  previewPayroll: { handler: previewPayroll },
  generatePayroll: { handler: generatePayroll },
  listSalaryRecords: { handler: selectAll("salary_records", { roles: [...FINANCE_ROLES], order: { column: "created_at", ascending: false } }) },
  paySalaryRecord: { handler: paySalaryRecord },

  getDashboardSummary: { handler: getDashboardSummary },
  getDailySalesReport: { handler: reportRows },
  getShiftReport: { handler: reportRows },
  getEndOfDayReport: { handler: reportRows },
  getTopProductsReport: { handler: reportRows },
  getSalesByPaymentMethod: { handler: reportRows },
  getSalesByOrderType: { handler: reportRows },
  getSalesByCashier: { handler: reportRows },
  getDiscountsReport: { handler: reportRows },
  getRefundsReport: { handler: reportRows },
  listZReports: { handler: listShifts },

  listAuditLogs: { handler: listAuditLogs },
  getReadinessSnapshot: { handler: getReadinessSnapshot },

  getZatcaSettings: { handler: getZatcaSettings },
  getZatcaConnectionStatus: { handler: getZatcaConnectionStatus },
  updateZatcaSettings: { handler: updateZatcaSettings },
  listZatcaInvoices: { handler: listZatcaInvoices },
  listZatcaCreditNotes: { handler: listZatcaCreditNotes },
  listZatcaLogs: { handler: listZatcaLogs },
  getZatcaForInvoice: { handler: getZatcaForInvoice },
  getZatcaLifecycleSummary: { handler: getZatcaLifecycleSummary },
  getAutoRunnerStatus: { handler: getAutoRunnerStatus },
  setQueueEnabled: { handler: setQueueEnabled },
  verifyOnboardingReadiness: { handler: async (_input, req) => ({ ready: Boolean(await getRestaurantSettings({}, req)), currentStatus: "settings_checked", missing: [] }) },
  prepareDeviceCsr: { handler: prepareDeviceCsrAction },
  submitOnboardingOtp: { handler: submitOnboardingOtpAction },
  processZatcaQueue: { handler: processZatcaQueueAction },
  submitValidatedZatcaInvoice: { handler: submitZatcaInvoiceAction },
  getDeviceStatus: { handler: getDeviceStatusAction },
  getCsidDetails: { handler: getCsidDetailsAction },
  debugSignedPropertiesSample: { handler: generateZatcaInvoiceAction },
  regenerateZatcaInvoice: { handler: async (input, req) => generateZatcaInvoiceAction({ ...input, force: true }, req) },
  localGenerateZatcaInvoice: { handler: generateZatcaInvoiceAction },
  retryZatcaInvoice: { handler: submitZatcaInvoiceAction },
  runExternalSdkComplianceTest: { handler: generateZatcaInvoiceAction },
  previewInvoiceForZatca: { handler: generateZatcaInvoiceAction },
  submitInvoiceToZatcaManual: { handler: submitZatcaInvoiceAction },
  resolveInvoiceForZatca: { handler: async (input, req) => getZatcaForInvoice({ invoice_id: input?.invoiceId ?? input?.query }, req) },
  startAutoRun: { handler: startAutoRunAction },
  stopAutoRun: { handler: stopAutoRunAction },
  advanceOneInvoice: { handler: submitZatcaInvoiceAction },
};
