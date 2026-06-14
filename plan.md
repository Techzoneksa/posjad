# Phase 1 — Controlled Batch Submit (Plan Only)

Owner/manager presses **Submit next 5 eligible invoices**. Server processes them strictly one at a time, in chronological order, stopping on the first error. Reuses the existing `submit-real-invoice` route — no change to its contract, signing service, SDK, Docker, CSID, or onboarding. Global queue stays disabled.

---

## 1. Required routes / functions

### 1a. New server function — `runManualBatch`
- File: `src/lib/zatca-batch.functions.ts`
- Signature:
  ```ts
  runManualBatch({ batchSize: 5 | 10, confirmToken: 'SUBMIT_BATCH' })
  ```
- Middleware: `requireSupabaseAuth` + inline `has_role(uid,'owner') OR has_role(uid,'manager')` check.
- Validates `confirmToken` and that `batchSize ∈ {5, 10}`.
- Performs **advisory lock acquisition** (see §2) — refuses if another batch is running.
- Picks up to `batchSize` eligible invoices ordered by `issued_at ASC, created_at ASC, id ASC`.
- Loops sequentially, calling the existing `submit-real-invoice` route with `dryRun: false` for each invoice.
- After each invoice: writes a `zatca_batch_items` row capturing result; updates parent `zatca_batch_runs` counters.
- Stops at first non-success (see §8) and releases the lock.
- Returns the full batch summary to the UI.

### 1b. New server function — `previewManualBatch`
- Read-only. Same auth/role check.
- Runs the eligibility query and returns the first `batchSize` candidates plus current PIH and next ICV preview.
- No writes, no ZATCA call.

### 1c. New server function — `getBatchStatus`
- Polled by the UI while a batch runs.
- Returns the active `zatca_batch_runs` row + ordered `zatca_batch_items` rows.

### 1d. **No changes** to `src/routes/api/public/zatca/submit-real-invoice.ts`.
The batch function calls it internally as a normal fetch with the existing `x-signing-service-secret` header, exactly the same way the Manual Submit UI calls it today.

---

## 2. DB fields used for locking and progress

### 2a. New table `zatca_batch_runs`
| column | type | purpose |
|---|---|---|
| `id` | uuid pk | run id |
| `status` | enum: `running | completed | stopped_on_error | cancelled` | lifecycle |
| `batch_size_requested` | int | 5 or 10 |
| `invoices_attempted` | int | how many we tried |
| `invoices_succeeded` | int | REPORTED + PASS/WARNING |
| `invoices_failed` | int | first failure ends the batch |
| `started_at` | timestamptz | now() |
| `ended_at` | timestamptz | null until finished |
| `stopped_reason` | text | "first_error" / "completed" / "no_eligible" |
| `initiated_by` | uuid → auth.users | who clicked |
| `lock_token` | uuid | matches advisory-lock key |

### 2b. New table `zatca_batch_items`
| column | type | purpose |
|---|---|---|
| `id` | uuid pk | |
| `batch_run_id` | uuid → zatca_batch_runs.id | parent |
| `position` | int | 1..batchSize |
| `invoice_id` | uuid → invoices.id | one row per attempted invoice |
| `invoice_number` | text | snapshot |
| `result` | enum: `sent | rejected | failed | skipped_pre_check` | per-invoice outcome |
| `icv_used` | int | from response |
| `pih_before` | text | from response |
| `pih_after` | text | from response |
| `zatca_http_status` | int | |
| `reporting_status` | text | REPORTED / null |
| `validation_status` | text | PASS / WARNING / ERROR |
| `error_summary` | text | first error msg if any |
| `started_at`, `finished_at` | timestamptz | |

### 2c. Locking mechanism
Two layers:
1. **Postgres advisory lock** keyed `pg_try_advisory_lock(hashtext('zatca_manual_batch'))`. Acquired at the start of `runManualBatch`, released in `finally`. Guarantees no two batches run concurrently across processes.
2. **Row uniqueness**: partial unique index on `zatca_batch_runs(status) WHERE status = 'running'` — only one running row is permitted. Belt and suspenders for the advisory lock.

### 2d. Global queue flag
- Already-planned `zatca_settings.queue_enabled` is **not** required for Phase 1. The batch button is independent and ignores that flag. The flag remains reserved for Phase 2+ (auto-runner) and stays `false`.

---

## 3. Exact eligibility query

```sql
SELECT i.id, i.invoice_number, i.issued_at, i.created_at, i.order_id
FROM public.invoices i
JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.zatca_invoices zi ON zi.invoice_id = i.id
WHERE
  -- order finalized
  o.status IN ('paid','completed')
  -- has at least one line item
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  -- not a test prefix
  AND i.invoice_number NOT LIKE 'EXTSDK-%'
  -- simplified standard invoice only (no refunds/credit/debit notes)
  -- refunds live in public.refunds, never in invoices → already excluded.
  -- doc_type filter for the zatca_invoices stub, if present:
  AND (zi.doc_type IS NULL OR zi.doc_type = 'invoice')
  -- eligibility based on existing zatca_invoices row
  AND (
    zi.id IS NULL
    OR (
      zi.submitted_at IS NULL
      AND zi.status IN ('generated','local_validation_failed','validated_blocked')
    )
  )
  -- explicit blocks (defensive — already covered by clauses above but kept for clarity)
  AND COALESCE(zi.status, '') NOT IN
      ('sent','reported','synced','rejected',
       'pending_sync','submitting','signed','pending_generation')
ORDER BY i.issued_at ASC, i.created_at ASC, i.id ASC
LIMIT :batchSize;
```

Notes:
- A row with `submitted_at IS NOT NULL` is always blocked, regardless of status text (defence in depth against text drift).
- Credit/debit notes are out of scope for Phase 1 (`doc_type = 'invoice'` filter).
- The query runs once at batch start to pick the slice. The single-invoice route re-checks each invoice's duplicate guard at submit time (already enforced today), so even if the snapshot is stale we are safe.

---

## 4. How ordering is determined

`ORDER BY issued_at ASC, created_at ASC, id ASC`.

Rationale:
- `issued_at` is the business timestamp printed on the receipt — matches chronological submission expected by ZATCA.
- `created_at` breaks ties when multiple invoices share the same `issued_at` second.
- `id` (UUID) is the final deterministic tiebreaker so repeated runs see the same order.

The batch always processes oldest → newest. Newer invoices wait for older ones to clear.

---

## 5. How PIH/ICV are protected

- **Sequential, never parallel.** The loop awaits each `submit-real-invoice` call before starting the next.
- **PIH advancement is owned by the existing route.** The batch function does NOT touch `zatca_device_keys.last_pih_b64`. It just calls the route and reads `pihAfter`/`lastPihUpdated` from the response.
- **ICV allocation is owned by `next_zatca_icv()`.** The batch function never calls it.
- **Chain integrity check between invoices.** After each successful invoice, the batch function asserts:
  - response `pihAfter == response invoiceHashBase64`, AND
  - re-reads `zatca_device_keys.last_pih_b64` and asserts it equals `pihAfter`.
  If either assertion fails, batch stops immediately with `stopped_reason = 'pih_chain_drift'` even though the invoice itself was REPORTED. No further invoices are submitted in that run.
- **No ICV gap-fill, no PIH rewind.** Failures leave the chain exactly where the underlying route left it. If signing failed mid-batch, ICV may be burned for that one invoice; subsequent invoices in the batch are NOT submitted.
- **No retry inside the batch.** A failed invoice is recorded as `failed`/`rejected` and the loop ends.

---

## 6. What happens on success (REPORTED + PASS)

Per invoice:
- `zatca_batch_items.result = 'sent'`, `validation_status = 'PASS'`.
- Update `zatca_batch_runs.invoices_succeeded += 1`.
- Existing route already wrote the `zatca_invoices` row, advanced PIH, advanced ICV.
- Continue to next invoice in the slice.

End of batch (all `batchSize` succeeded OR no more eligible):
- `zatca_batch_runs.status = 'completed'`, `ended_at = now()`, `stopped_reason = 'completed'` (or `'no_eligible'` if we exhausted the slice early).
- Release advisory lock.
- UI shows green summary.

---

## 7. What happens on warning (REPORTED + WARNING, e.g. KSA-25)

Same as success:
- `zatca_batch_items.result = 'sent'`, `validation_status = 'WARNING'`, `error_summary` left null but warning messages copied for display.
- Update `invoices_succeeded`.
- Continue to next invoice.

This matches current Manual Submit behaviour: WARNING is treated as accepted (the existing route already maps REPORTED + WARNING to `rowStatus = 'sent'` and advances PIH).

---

## 8. What happens on error

Any of the following ends the batch immediately:

| Condition | `result` | Batch stops? |
|---|---|---|
| HTTP non-2xx from ZATCA | `failed` | yes |
| Network/timeout | `failed` | yes |
| Signing service failure (route returns 502 / `signedXmlB64 == null`) | `failed` | yes |
| Reporting status not `REPORTED` | `rejected` | yes |
| `validationResults.status == 'ERROR'` | `rejected` | yes |
| PIH drift check fails after a REPORTED invoice | `sent` (still recorded as sent) but batch stops with `stopped_reason='pih_chain_drift'` | yes |
| Existing route returns 409 (`already_submitted` / `in_flight`) | `skipped_pre_check` | yes (treat as a logic mismatch worth investigating) |
| `submit-real-invoice` returns 412 (`order_not_finalized`, `no_line_items`, `test_prefix_blocked`, `no_production_csid`) | `skipped_pre_check` | yes |

Then:
- `zatca_batch_runs.status = 'stopped_on_error'`, `ended_at = now()`, `stopped_reason` = first failure category.
- Release advisory lock.
- UI shows the failed invoice prominently and the list of unprocessed candidates that were NOT attempted.
- **No automatic retry.** Manager investigates manually using the existing Manual Submit screen.

---

## 9. How to prevent duplicate submit

Three layers, top to bottom:

1. **UI layer**
   - Submit button disables on click; spinner replaces label.
   - Polled `getBatchStatus` keeps button disabled while a `running` row exists.
   - Typed confirm token + checkbox (mirrors Manual Submit gate).

2. **DB layer**
   - Partial unique index `WHERE status = 'running'` on `zatca_batch_runs` — second concurrent insert raises a unique-violation that the server fn translates to "another batch is already running".
   - Advisory lock `pg_try_advisory_lock(...)` — if not acquired, server fn rejects with the same error.

3. **Per-invoice layer (already exists)**
   - The `submit-real-invoice` route's existing duplicate guard (returns 409 for `already_submitted` / `in_flight`) is the final backstop. Even if a row somehow appears between batch eligibility query and submit, the route refuses to overwrite it.

---

## 10. UI flow

Location: new **ZATCA Batch Submit** card inside the existing manager area, separate from the Manual Submit card. Hidden for cashier/finance roles.

```text
[Step 1: Pick size]
   ( • ) Submit next 5 eligible invoices
   (   ) Submit next 10 eligible invoices       (disabled until first 5-batch succeeds)
   [Preview eligibility]

[Step 2: Preview panel]
   Shows the ordered list of N candidates:
     position | invoice_number | issued_at | total | net | vat | existing zatca status
   Shows current PIH (from device_keys) and last completed ICV.
   "0 eligible" → button to Step 3 is disabled.

[Step 3: Confirmation]
   Type SUBMIT_BATCH:  [_________]
   [x] I understand this will submit up to N invoices to ZATCA Simulation
       strictly one at a time and stop on the first error.
   [Run batch]  ← disabled until token + checkbox

[Step 4: Live progress]
   While running (polled every 2s via getBatchStatus):
     [1/5] INV-...  → SUBMITTING…
     [2/5] INV-...  → QUEUED
     ...
   On each completion, row updates to ✅ REPORTED (PASS) / ⚠ REPORTED (WARNING) / ❌ ERROR.
   Lock indicator: "Batch lock held — no other batch can run."

[Step 5: Final result]
   Summary: succeeded X / failed Y / stopped reason.
   Per-row drilldown: ICV used, PIH before/after, ZATCA HTTP status, validation messages,
                      x-global-transaction-id.
   If stopped on error: explicit banner saying "Remaining eligible invoices were NOT submitted.
                         Investigate the failed invoice via Manual Submit before retrying."
   No "Retry" button.
   "Run another batch" button is enabled only after the lock is released and 30 seconds elapsed
   (soft cooldown to encourage a sanity-check between batches).
```

Cap on size selector:
- **5** is always available.
- **10** is available only after at least one full 5-invoice batch in the last 24 h completed with `status = 'completed'` and zero failures. Enforced server-side in `runManualBatch`.

---

## 11. Rollback / no-retry policy

- No automatic rollback of already-submitted invoices. ZATCA submissions are not reversible; the chain advances or it doesn't.
- A failed/rejected invoice in the batch is left in whatever state the existing route produced (e.g., `zatca_invoices.status = 'rejected'` or `'failed'`, with full error captured). It is NOT retried by Phase 1.
- The batch does NOT pick up old previously-rejected invoices. The eligibility query explicitly excludes `status = 'rejected'`.
- Manual remediation path: owner/manager investigates the failing invoice via the existing Manual Submit screen, fixes whatever's wrong (data, signing service, network), and either:
  - manually deletes the `zatca_invoices` row (existing operator path) and re-submits via Manual Submit, OR
  - leaves it rejected and moves on — the batch will skip it forever.
- No cron, no scheduled retry, no background worker. Every batch requires a human click.

---

## 12. Migration needed

Yes — one migration. Creates the two new audit tables, the partial unique index, and the per-table grants/RLS. Adds no enums to existing tables, alters no existing tables, touches no existing data.

```sql
-- New tables
CREATE TABLE public.zatca_batch_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running','completed','stopped_on_error','cancelled')),
  batch_size_requested int not null check (batch_size_requested in (5,10)),
  invoices_attempted int not null default 0,
  invoices_succeeded int not null default 0,
  invoices_failed int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  stopped_reason text null,
  initiated_by uuid null,
  lock_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.zatca_batch_runs TO authenticated;
GRANT ALL ON public.zatca_batch_runs TO service_role;
ALTER TABLE public.zatca_batch_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zatca_batch_runs_owner_manager"
  ON public.zatca_batch_runs FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE UNIQUE INDEX zatca_batch_runs_only_one_running
  ON public.zatca_batch_runs (status) WHERE status = 'running';

CREATE TABLE public.zatca_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references public.zatca_batch_runs(id) on delete cascade,
  position int not null,
  invoice_id uuid not null,
  invoice_number text not null,
  result text not null check (result in ('sent','rejected','failed','skipped_pre_check')),
  icv_used int null,
  pih_before text null,
  pih_after text null,
  zatca_http_status int null,
  reporting_status text null,
  validation_status text null,
  error_summary text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null
);
GRANT SELECT, INSERT, UPDATE ON public.zatca_batch_items TO authenticated;
GRANT ALL ON public.zatca_batch_items TO service_role;
ALTER TABLE public.zatca_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zatca_batch_items_owner_manager"
  ON public.zatca_batch_items FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE INDEX zatca_batch_items_run_idx ON public.zatca_batch_items(batch_run_id, position);

-- Updated_at trigger reuse
CREATE TRIGGER tg_zatca_batch_runs_touch
  BEFORE UPDATE ON public.zatca_batch_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

What this migration deliberately does NOT do:
- No change to `zatca_invoices`, `zatca_device_keys`, `zatca_icv_seq`, `zatca_settings`.
- No change to `invoices`, `orders`, `order_items`.
- No new enum values.
- No changes to RLS on existing tables.
- No queue tables (deferred to Phase 2).
- No `queue_enabled` flag flip (stays `false`).

---

## What this plan explicitly excludes (deferred to later phases)

- Background worker / cron / auto-submit.
- "Submit all eligible" or "Submit until cap" buttons.
- Auto-retry of old `rejected` or `failed` rows.
- Parallel submission.
- Credit/debit notes and refunds.
- Bulk historical backfill beyond a single 5/10 click.
- Any change to signing service, SDK, Docker, CSID, onboarding.

## To proceed

Reply with one of:
- **"build Phase 1"** — I create the migration and the server fns + UI for the 5-batch button only (10-batch unlocks per §10 rules).
- **"adjust: …"** — change something above.
- **"hold"** — nothing happens; queue stays disabled.