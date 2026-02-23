
CREATE OR REPLACE FUNCTION public.cancel_expired_unpaid_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_session RECORD;
BEGIN
  FOR v_session IN
    SELECT
      s.id AS session_id,
      s.group_id,
      ca.id AS ca_id,
      g.organizer_id
    FROM sessions s
    JOIN court_availability ca ON ca.booked_by_session_id = s.id
    JOIN courts c ON c.id = s.court_id
    JOIN groups g ON g.id = s.group_id
    WHERE s.is_cancelled = false
      AND ca.is_booked = true
      AND ca.payment_status = 'pending'
      AND s.payment_deadline < now()
  LOOP
    -- Release court slot
    UPDATE court_availability
    SET
      is_booked = false,
      booked_by_session_id = NULL,
      booked_by_group_id = NULL,
      booked_by_user_id = NULL,
      payment_status = 'pending'
    WHERE id = v_session.ca_id;

    -- Remove session players
    DELETE FROM session_players WHERE session_id = v_session.session_id;

    -- Cancel session
    UPDATE sessions SET is_cancelled = true WHERE id = v_session.session_id;

    -- Notify organizer
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_session.organizer_id,
      'session_cancelled',
      'Booking Cancelled – Payment Overdue',
      'Your booking was automatically cancelled because payment was not received before the deadline.',
      jsonb_build_object('session_id', v_session.session_id)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
