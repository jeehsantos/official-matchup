
CREATE OR REPLACE FUNCTION public.cancel_expired_unpaid_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_session RECORD;
  v_funding JSONB;
  v_payment RECORD;
  v_court_amount_dollars NUMERIC;
  v_liability_cents INTEGER;
BEGIN
  -- Find ALL overdue, non-cancelled sessions that have a court_availability row
  FOR v_session IN
    SELECT DISTINCT
      s.id AS session_id,
      s.group_id,
      s.court_price,
      s.payment_type,
      ca.id AS ca_id,
      g.organizer_id
    FROM sessions s
    JOIN court_availability ca ON ca.booked_by_session_id = s.id
    JOIN groups g ON g.id = s.group_id
    WHERE s.is_cancelled = false
      AND s.payment_deadline < now()
  LOOP
    -- Check if session is fully funded
    v_funding := recalculate_and_maybe_confirm_session(v_session.session_id);

    -- If fully funded, skip — session is healthy
    IF (v_funding->>'session_confirmed')::boolean = true THEN
      CONTINUE;
    END IF;

    -- Session is NOT fully funded past deadline → cancel it

    -- Refund any completed payments as credits
    FOR v_payment IN
      SELECT p.id, p.user_id, p.court_amount, p.amount, p.platform_fee
      FROM payments p
      WHERE p.session_id = v_session.session_id
        AND p.status = 'completed'
    LOOP
      v_court_amount_dollars := COALESCE(
        v_payment.court_amount,
        GREATEST(v_payment.amount - COALESCE(v_payment.platform_fee, 0), 0)
      );

      IF v_court_amount_dollars > 0 THEN
        -- Add credits (service role context, auth.uid() is NULL so passes the check)
        PERFORM add_user_credits(
          v_payment.user_id,
          v_court_amount_dollars,
          'Refund for cancelled session (payment deadline passed)',
          v_session.session_id,
          v_payment.id
        );

        -- Record held credit liability
        v_liability_cents := ROUND(v_court_amount_dollars * 100);
        INSERT INTO held_credit_liabilities (
          user_id, amount_cents, source_session_id, source_payment_id, status
        ) VALUES (
          v_payment.user_id, v_liability_cents, v_session.session_id, v_payment.id, 'HELD'
        );
      END IF;

      -- Mark payment as refunded
      UPDATE payments
      SET status = 'refunded', updated_at = now()
      WHERE id = v_payment.id;
    END LOOP;

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
      'Your booking was automatically cancelled because full payment was not received before the deadline.',
      jsonb_build_object('session_id', v_session.session_id)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
