
CREATE OR REPLACE FUNCTION public.purge_old_cancelled_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_challenges INTEGER;
  v_slots INTEGER;
BEGIN
  -- Delete cancelled quick challenges older than 2 weeks (cascades to players, payments, messages, bans)
  DELETE FROM public.quick_challenges
  WHERE status = 'cancelled'
    AND created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_challenges = ROW_COUNT;

  -- Delete orphaned court_availability with pending payment older than 2 weeks
  DELETE FROM public.court_availability
  WHERE payment_status = 'pending'
    AND available_date < current_date - interval '14 days';
  GET DIAGNOSTICS v_slots = ROW_COUNT;

  RETURN jsonb_build_object(
    'purged_challenges', v_challenges,
    'purged_slots', v_slots
  );
END;
$$;
