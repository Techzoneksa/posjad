// Sprint E — trusted server-only audit log helper.
// Imported by server functions only. Failures NEVER throw — they are best-effort
// observability writes that must not roll back the original business action.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditAction = string; // "order.create", "shift.close", ...

async function getUserRole(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return (data as any)?.role ?? null;
  } catch {
    return null;
  }
}

export async function logAudit(opts: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    const role = await getUserRole(opts.userId);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: opts.userId ?? null,
      user_role: role,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ? String(opts.entityId) : null,
      old_value: (opts.oldValue ?? null) as any,
      new_value: (opts.newValue ?? null) as any,
      ip: opts.ip ?? null,
    });
  } catch (err) {
    // Never throw from audit writes — observability must never break business flows.
    console.error("[audit] log write failed:", err);
  }
}

/** Try to post a balanced journal entry. Swallows errors (logs only) so the
 * underlying business action (expense / supplier payment / salary) is not
 * rolled back if the chart of accounts is empty or JE posting fails. */
export async function tryPostJournal(opts: {
  description: string;
  source: "expense" | "supplier_payment" | "salary";
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  createdBy?: string | null;
  date?: string;
}): Promise<{ posted: boolean; reason?: string }> {
  try {
    if (opts.amount <= 0) return { posted: false, reason: "non-positive amount" };
    // Both account codes must exist in chart_accounts to keep the entry meaningful.
    const { data: accs } = await supabaseAdmin
      .from("chart_accounts")
      .select("code")
      .in("code", [opts.debitAccountCode, opts.creditAccountCode]);
    if (!accs || accs.length < 2) {
      return { posted: false, reason: "chart accounts missing" };
    }
    const { postJournalEntry } = await import("@/lib/finance.server");
    await postJournalEntry({
      date: opts.date,
      source: opts.source,
      description: opts.description,
      created_by: opts.createdBy ?? null,
      lines: [
        { account_code: opts.debitAccountCode, debit: opts.amount, credit: 0 },
        { account_code: opts.creditAccountCode, debit: 0, credit: opts.amount },
      ],
    });
    return { posted: true };
  } catch (err) {
    console.error("[audit] auto-journal post failed:", err);
    return { posted: false, reason: "post error" };
  }
}
