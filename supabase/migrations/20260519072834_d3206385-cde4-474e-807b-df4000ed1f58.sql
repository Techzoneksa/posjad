CREATE OR REPLACE FUNCTION public.assert_journal_balanced(_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE d numeric; c numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO d, c
  FROM public.journal_lines WHERE journal_entry_id = _entry_id;
  IF round(d::numeric, 2) <> round(c::numeric, 2) THEN
    RAISE EXCEPTION 'Journal entry % is not balanced (debit=% credit=%)', _entry_id, d, c;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.assert_journal_balanced(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_journal_balanced(uuid) TO service_role;
