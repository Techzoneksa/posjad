-- Enforce intended grants matrix for Step 1 tables.
-- Counters schema-level default privileges that auto-grant ALL on new public tables.

-- Submission lock: server-only. No client access.
REVOKE ALL ON public.zatca_submission_lock FROM anon, authenticated, PUBLIC;

-- Auto-runner runs: signed-in owners/managers may SELECT (gated by RLS policy);
-- nobody else; no client writes.
REVOKE ALL ON public.zatca_auto_runs FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.zatca_auto_runs TO authenticated;

-- Auto-runner items: same as runs.
REVOKE ALL ON public.zatca_auto_run_items FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.zatca_auto_run_items TO authenticated;

-- Re-assert service_role (defensive; usually unaffected by the above).
GRANT ALL ON public.zatca_submission_lock TO service_role;
GRANT ALL ON public.zatca_auto_runs       TO service_role;
GRANT ALL ON public.zatca_auto_run_items  TO service_role;