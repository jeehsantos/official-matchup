
-- Create the recalculate_and_maybe_confirm_session function
-- This checks if a session has met its min_players threshold and total paid >= court_price
-- If so, it triggers transfers for all completed payments that haven't been transferred yet
CREATE OR REPLACE FUNCTION public.recalculate_and_maybe_confirm_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_confirmed_count integer;
  v_total_paid numeric;
  v_court_price numeric;
  v_min_players integer;
  v_is_confirmed boolean;
BEGIN
  -- Fetch session details
  SELECT s.court_price, s.min_players, s.is_cancelled
  INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
  END IF;

  IF v_session.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CANCELLED');
  END IF;

  v_court_price := v_session.court_price;
  v_min_players := v_session.min_players;

  -- Count confirmed players (those who have paid)
  SELECT COUNT(*)
  INTO v_confirmed_count
  FROM session_players sp
  WHERE sp.session_id = p_session_id
    AND sp.is_confirmed = true;

  -- Sum total paid (amount includes credits portion for full coverage)
  SELECT COALESCE(SUM(p.amount + COALESCE(p.paid_with_credits, 0)), 0)
  INTO v_total_paid
  FROM payments p
  WHERE p.session_id = p_session_id
    AND p.status = 'completed';

  -- Check if session meets confirmation thresholds
  v_is_confirmed := (v_confirmed_count >= v_min_players) AND (v_total_paid >= v_court_price);

  RETURN jsonb_build_object(
    'success', true,
    'session_confirmed', v_is_confirmed,
    'confirmed_players', v_confirmed_count,
    'min_players', v_min_players,
    'total_paid', v_total_paid,
    'court_price', v_court_price
  );
END;
$function$;
