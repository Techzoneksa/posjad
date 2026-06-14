
CREATE OR REPLACE FUNCTION public.zatca_acquire_submission_lock(
  _source text,
  _invoice_id uuid,
  _zatca_invoice_id uuid,
  _initiated_by uuid,
  _lease_seconds integer DEFAULT 120
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt uuid := gen_random_uuid();
  v_rows int;
BEGIN
  IF _source NOT IN ('manual','auto_runner') THEN
    RAISE EXCEPTION 'invalid source %', _source;
  END IF;
  UPDATE public.zatca_submission_lock
     SET attempt_id        = v_attempt,
         locked_by         = _initiated_by,
         locked_at         = now(),
         lease_expires_at  = now() + make_interval(secs => _lease_seconds),
         source            = _source,
         invoice_id        = _invoice_id,
         zatca_invoice_id  = _zatca_invoice_id,
         updated_at        = now()
   WHERE lock_key = 'zatca:submission'
     AND (attempt_id IS NULL OR lease_expires_at < now());
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN NULL;
  END IF;
  RETURN v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.zatca_renew_submission_lock(
  _attempt_id uuid,
  _lease_seconds integer DEFAULT 120
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows int;
BEGIN
  UPDATE public.zatca_submission_lock
     SET lease_expires_at = now() + make_interval(secs => _lease_seconds),
         updated_at = now()
   WHERE lock_key = 'zatca:submission'
     AND attempt_id = _attempt_id
     AND lease_expires_at >= now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.zatca_release_submission_lock(
  _attempt_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows int;
BEGIN
  UPDATE public.zatca_submission_lock
     SET attempt_id = NULL,
         locked_by = NULL,
         locked_at = NULL,
         lease_expires_at = NULL,
         source = NULL,
         invoice_id = NULL,
         zatca_invoice_id = NULL,
         updated_at = now()
   WHERE lock_key = 'zatca:submission'
     AND attempt_id = _attempt_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.zatca_acquire_submission_lock(text, uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_renew_submission_lock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_release_submission_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zatca_acquire_submission_lock(text, uuid, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.zatca_renew_submission_lock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.zatca_release_submission_lock(uuid) TO service_role;
