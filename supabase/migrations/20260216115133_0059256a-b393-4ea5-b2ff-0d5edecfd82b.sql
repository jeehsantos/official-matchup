
-- Replace recalculate_and_maybe_confirm_session with proper logic:
-- Only count funds from confirmed players who are still in the session (not cancelled)
-- Return whether session meets confirmation thresholds
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
  v_total_eligible_funds numeric;
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

  -- Count confirmed players who are STILL in session_players (not cancelled/removed)
  SELECT COUNT(*)
  INTO v_confirmed_count
  FROM session_players sp
  WHERE sp.session_id = p_session_id
    AND sp.is_confirmed = true;

  -- Sum eligible funds: payments that are 'completed' (not cancelled/refunded)
  -- AND the player is still in the session (join with session_players)
  -- Include both card amount and credits applied
  SELECT COALESCE(SUM(p.amount + COALESCE(p.paid_with_credits, 0)), 0)
  INTO v_total_eligible_funds
  FROM payments p
  INNER JOIN session_players sp ON sp.session_id = p.session_id AND sp.user_id = p.user_id
  WHERE p.session_id = p_session_id
    AND p.status = 'completed'
    AND sp.is_confirmed = true;

  -- Check thresholds
  v_session_confirmed := (v_confirmed_count >= v_min_players) AND (v_total_eligible_funds >= v_court_price);

  RETURN jsonb_build_object(
    'success', true,
    'session_confirmed', v_session_confirmed,
    'confirmed_players', v_confirmed_count,
    'min_players', v_min_players,
    'total_eligible_funds', v_total_eligible_funds,
    'court_price', v_court_price
  );
END;
$function$;
