-- =====================================================================
-- Step 1: Auto-runner scaffolding
-- DDL + two safe initialization writes (queue_enabled=false, lock row).
-- No operational invoice/ZATCA data modified.
-- =====================================================================

-- 1) queue_enabled flag on the singleton zatca_settings row
ALTER TABLE public.zatca_settings
  ADD COLUMN IF NOT EXISTS queue_enabled boolean NOT NULL DEFAULT false;

UPDATE public.zatca_settings
   SET queue_enabled = false
 WHERE id = true;

-- 2) Global lease-based submission lock (shared by Manual + Auto Runner)
CREATE TABLE IF NOT EXISTS public.zatca_submission_lock (
  lock_key          text PRIMARY KEY,
  locked_by         uuid NULL,
  locked_at         timestamptz NULL,
  lease_expires_at  timestamptz NULL,
  source            text NULL CHECK (source IS NULL OR source IN ('manual','auto_runner')),
  invoice_id        uuid NULL,
  zatca_invoice_id  uuid NULL,
  attempt_id        uuid NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.zatca_submission_lock (lock_key)
VALUES ('zatca:submission')
ON CONFLICT (lock_key) DO NOTHING;

GRANT ALL ON public.zatca_submission_lock TO service_role;

ALTER TABLE public.zatca_submission_lock ENABLE ROW LEVEL SECURITY;

-- 3) Auto-runner run header
CREATE TABLE IF NOT EXISTS public.zatca_auto_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('idle','running','halted','completed','stopped')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz NULL,
  initiated_by    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  halt_reason     text NULL,
  error_summary   text NULL,
  processed_count integer NOT NULL DEFAULT 0,
  reported_count  integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  unknown_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_auto_runs_one_active
  ON public.zatca_auto_runs ((status))
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS zatca_auto_runs_started_at_idx
  ON public.zatca_auto_runs (started_at DESC);

GRANT SELECT ON public.zatca_auto_runs TO authenticated;
GRANT ALL    ON public.zatca_auto_runs TO service_role;

ALTER TABLE public.zatca_auto_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_runs: owner/manager read"
  ON public.zatca_auto_runs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_zatca_auto_runs_touch
  BEFORE UPDATE ON public.zatca_auto_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Per-attempt log
CREATE TABLE IF NOT EXISTS public.zatca_auto_run_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                   uuid NULL
                              REFERENCES public.zatca_auto_runs(id) ON DELETE RESTRICT,
  invoice_id               uuid NOT NULL
                              REFERENCES public.invoices(id) ON DELETE RESTRICT,
  zatca_invoice_id         uuid NULL
                              REFERENCES public.zatca_invoices(id) ON DELETE RESTRICT,
  attempt_id               uuid NOT NULL,
  source                   text NOT NULL CHECK (source IN ('manual','auto_runner')),
  result                   text NOT NULL
                              CHECK (result IN (
                                'reported',
                                'failed',
                                'submission_unknown',
                                'manual_review_required',
                                'skipped'
                              )),
  http_status              integer NULL,
  reporting_status         text NULL,
  zatca_response_code      text NULL,
  validation_status        text NULL,
  error_summary            text NULL,
  icv                      integer NULL,
  invoice_hash_b64         text NULL,
  previous_hash_b64        text NULL,
  submitted_endpoint       text NULL,
  x_global_transaction_id  text NULL,
  submission_started_at    timestamptz NULL,
  response_received_at     timestamptz NULL,
  started_at               timestamptz NOT NULL DEFAULT now(),
  finished_at              timestamptz NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zatca_auto_run_items_run_required_for_auto
    CHECK (
      (source = 'auto_runner' AND run_id IS NOT NULL)
      OR
      (source = 'manual')
    )
);

CREATE INDEX IF NOT EXISTS zatca_auto_run_items_run_idx
  ON public.zatca_auto_run_items (run_id, started_at DESC);

CREATE INDEX IF NOT EXISTS zatca_auto_run_items_invoice_idx
  ON public.zatca_auto_run_items (invoice_id, started_at DESC);

CREATE INDEX IF NOT EXISTS zatca_auto_run_items_zatca_invoice_idx
  ON public.zatca_auto_run_items (zatca_invoice_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_auto_run_items_attempt_uq
  ON public.zatca_auto_run_items (attempt_id);

GRANT SELECT ON public.zatca_auto_run_items TO authenticated;
GRANT ALL    ON public.zatca_auto_run_items TO service_role;

ALTER TABLE public.zatca_auto_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_run_items: owner/manager read"
  ON public.zatca_auto_run_items
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));