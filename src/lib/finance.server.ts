// Trusted server-only helpers for Sprint D (finance movement engine).
// Imported only by server functions / server-side helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FinanceMovementType =
  | "sale" | "expense" | "supplier_payment" | "salary"
  | "cash_in" | "cash_out" | "transfer" | "manual" | "opening";

/** Post a single in/out movement against a finance account and update its balance. */
export async function postAccountMovement(opts: {
  account_id: string;
  type: FinanceMovementType;
  amount_in?: number;
  amount_out?: number;
  description?: string | null;
  reference?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  occurred_at?: string | null;
}) {
  const amount_in = Math.max(0, Number(opts.amount_in ?? 0));
  const amount_out = Math.max(0, Number(opts.amount_out ?? 0));
  if (amount_in === 0 && amount_out === 0) {
    throw new Error("Movement must have either amount_in or amount_out");
  }

  const { data: acc, error } = await supabaseAdmin
    .from("finance_accounts")
    .select("id, balance, active")
    .eq("id", opts.account_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc) throw new Error("Finance account not found");
  if (!acc.active) throw new Error("Finance account is inactive");

  const delta = amount_in - amount_out;
  const next = Number(acc.balance) + delta;

  const occurred_at = opts.occurred_at ?? new Date().toISOString();

  const { error: mErr } = await supabaseAdmin.from("account_movements").insert({
    account_id: opts.account_id,
    occurred_at,
    type: opts.type,
    amount_in,
    amount_out,
    balance_after: next,
    description: opts.description ?? null,
    reference: opts.reference ?? null,
    reference_id: opts.reference_id ?? null,
    notes: opts.notes ?? null,
    created_by: opts.created_by ?? null,
  });
  if (mErr) throw new Error(mErr.message);

  const { error: uErr } = await supabaseAdmin
    .from("finance_accounts")
    .update({ balance: next, last_movement_at: occurred_at })
    .eq("id", opts.account_id);
  if (uErr) throw new Error(uErr.message);

  return { balance_after: next };
}

/** Post a balanced journal entry from server-side typed lines. */
export async function postJournalEntry(opts: {
  date?: string;
  source?: "manual" | "expense" | "supplier_payment" | "salary" | "purchase" | "pos" | "waste";
  description: string;
  lines: { account_code: string; debit?: number; credit?: number; notes?: string | null }[];
  created_by?: string | null;
  attachment_url?: string | null;
}) {
  const lines = opts.lines.map((l) => ({
    account_code: l.account_code,
    debit: Math.max(0, Number(l.debit ?? 0)),
    credit: Math.max(0, Number(l.credit ?? 0)),
    notes: l.notes ?? null,
  }));
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.round(debit * 100) !== Math.round(credit * 100)) {
    throw new Error(`Journal not balanced (debit=${debit} credit=${credit})`);
  }
  if (lines.length < 2) throw new Error("Journal requires at least two lines");

  const { data: entry, error: jeErr } = await supabaseAdmin
    .from("journal_entries")
    .insert({
      entry_date: opts.date ?? new Date().toISOString(),
      source: opts.source ?? "manual",
      description: opts.description,
      status: "posted",
      created_by: opts.created_by ?? null,
      attachment_url: opts.attachment_url ?? null,
    })
    .select("id, number")
    .single();
  if (jeErr) throw new Error(jeErr.message);

  const linesPayload = lines.map((l) => ({ ...l, journal_entry_id: entry.id }));
  const { error: lErr } = await supabaseAdmin.from("journal_lines").insert(linesPayload);
  if (lErr) throw new Error(lErr.message);

  return entry;
}

/** Returns YYYY-MM in Riyadh, or validates a supplied month. */
export function riyadhMonth(month?: string): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
