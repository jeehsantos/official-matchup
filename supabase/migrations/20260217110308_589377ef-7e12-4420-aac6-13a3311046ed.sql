
CREATE OR REPLACE FUNCTION public.recalculate_and_maybe_confirm_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_court_price numeric;
  v_min_players integer;
  v_is_cancelled boolean;
  v_current_state text;
  v_confirmed_count integer;
  v_total_funded_court_amount numeric;
  v_session_confirmed boolean;
BEGIN
  -- Fetch session details
  SELECT s.court_price, s.min_players, s.is_cancelled, s.state::text
  INTO v_court_price, v_min_players, v_is_cancelled, v_current_state
  FROM sessions s
  WHERE s.id = p_session_id;

  IF v_court_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
  END IF;

  IF v_is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CANCELLED');
  END IF;

  -- Count confirmed players who are STILL in session_players
  SELECT COUNT(*)
  INTO v_confirmed_count
  FROM session_players sp
  WHERE sp.session_id = p_session_id
    AND sp.is_confirmed = true;

  -- Sum funded court amount from payment snapshots (court_amount column)
  -- For payments where court_amount is NULL (legacy), fall back to amount - platform_fee
  -- Only count payments where the player is still confirmed in the session
  SELECT COALESCE(SUM(
    COALESCE(p.court_amount, GREATEST(p.amount - COALESCE(p.platform_fee, 0), 0))
  ), 0)
  INTO v_total_funded_court_amount
  FROM payments p
  INNER JOIN session_players sp ON sp.session_id = p.session_id AND sp.user_id = p.user_id
  WHERE p.session_id = p_session_id
    AND p.status = 'completed'
    AND sp.is_confirmed = true;

  -- Check thresholds: enough players AND enough court funding
  v_session_confirmed := (v_confirmed_count >= v_min_players) AND (v_total_funded_court_amount >= v_court_price);

  RETURN jsonb_build_object(
    'success', true,
    'session_confirmed', v_session_confirmed,
    'confirmed_players', v_confirmed_count,
    'min_players', v_min_players,
    'total_funded_court_amount', v_total_funded_court_amount,
    'court_price', v_court_price
  );
END;
$function$;
