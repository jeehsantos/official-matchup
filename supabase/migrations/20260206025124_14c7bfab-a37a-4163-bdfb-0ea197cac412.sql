-- Create booking_holds table for temporary locks
CREATE TABLE public.booking_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'EXPIRED', 'CONVERTED', 'FAILED')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_booking_holds_overlap ON public.booking_holds (court_id, start_datetime, end_datetime, status, expires_at);
CREATE INDEX idx_booking_holds_user ON public.booking_holds (user_id, status);
CREATE INDEX idx_booking_holds_expires ON public.booking_holds (expires_at) WHERE status = 'HELD';

-- Add index to court_availability for overlap checks
CREATE INDEX IF NOT EXISTS idx_court_availability_overlap ON public.court_availability (court_id, available_date, start_time, end_time, is_booked);

-- Enable RLS
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own holds"
ON public.booking_holds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holds"
ON public.booking_holds FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holds"
ON public.booking_holds FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Holds viewable by court managers"
ON public.booking_holds FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.courts c
  JOIN public.venues v ON v.id = c.venue_id
  WHERE c.id = court_id AND v.owner_id = auth.uid()
));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_holds;

-- Create the atomic create_hold function with proper locking
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_court_id UUID,
  p_start_datetime TIMESTAMP WITH TIME ZONE,
  p_end_datetime TIMESTAMP WITH TIME ZONE,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_venue_id UUID;
  v_slot_interval INTEGER;
  v_max_booking INTEGER;
  v_duration_minutes INTEGER;
  v_start_date DATE;
  v_start_time TIME;
  v_end_time TIME;
  v_overlap_booking BOOLEAN;
  v_overlap_hold BOOLEAN;
BEGIN
  -- Validate start < end
  IF p_start_datetime >= p_end_datetime THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TIME_RANGE', 'message', 'Start time must be before end time');
  END IF;

  -- Get venue configuration
  SELECT v.id, v.slot_interval_minutes, v.max_booking_minutes
  INTO v_venue_id, v_slot_interval, v_max_booking
  FROM courts c
  JOIN venues v ON v.id = c.venue_id
  WHERE c.id = p_court_id;

  IF v_venue_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'COURT_NOT_FOUND', 'message', 'Court not found');
  END IF;

  -- Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (p_end_datetime - p_start_datetime)) / 60;

  -- Validate duration is multiple of slot interval
  IF v_duration_minutes % v_slot_interval != 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DURATION', 'message', 'Duration must be a multiple of ' || v_slot_interval || ' minutes');
  END IF;

  -- Validate max booking duration
  IF v_duration_minutes > v_max_booking THEN
    RETURN jsonb_build_object('success', false, 'error', 'DURATION_EXCEEDS_MAX', 'message', 'Duration exceeds maximum allowed (' || v_max_booking || ' minutes)');
  END IF;

  -- Extract date and times for court_availability check
  v_start_date := p_start_datetime::DATE;
  v_start_time := p_start_datetime::TIME;
  v_end_time := p_end_datetime::TIME;

  -- Use advisory lock on court_id to prevent race conditions
  PERFORM pg_advisory_xact_lock(('x' || md5(p_court_id::text))::bit(64)::bigint);

  -- Clean up expired holds first
  UPDATE booking_holds
  SET status = 'EXPIRED'
  WHERE status = 'HELD' AND expires_at < now();

  -- Check for overlap with CONFIRMED bookings in court_availability
  SELECT EXISTS (
    SELECT 1 FROM court_availability ca
    WHERE ca.court_id = p_court_id
      AND ca.available_date = v_start_date
      AND ca.is_booked = true
      AND ca.start_time < v_end_time
      AND ca.end_time > v_start_time
  ) INTO v_overlap_booking;

  IF v_overlap_booking THEN
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_UNAVAILABLE', 'message', 'This time slot overlaps with an existing booking');
  END IF;

  -- Check for overlap with ACTIVE holds (excluding user's own holds)
  SELECT EXISTS (
    SELECT 1 FROM booking_holds bh
    WHERE bh.court_id = p_court_id
      AND bh.status = 'HELD'
      AND bh.expires_at > now()
      AND bh.user_id != p_user_id
      AND bh.start_datetime < p_end_datetime
      AND bh.end_datetime > p_start_datetime
  ) INTO v_overlap_hold;

  IF v_overlap_hold THEN
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_UNAVAILABLE', 'message', 'This slot is temporarily held by another user');
  END IF;

  -- Cancel any existing holds by this user for this court (they're selecting a new slot)
  UPDATE booking_holds
  SET status = 'EXPIRED'
  WHERE user_id = p_user_id
    AND court_id = p_court_id
    AND status = 'HELD';

  -- Create the hold with 10 minute expiry
  v_expires_at := now() + interval '10 minutes';
  
  INSERT INTO booking_holds (court_id, user_id, start_datetime, end_datetime, status, expires_at)
  VALUES (p_court_id, p_user_id, p_start_datetime, p_end_datetime, 'HELD', v_expires_at)
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'expires_at', v_expires_at,
    'duration_minutes', v_duration_minutes
  );
END;
$$;

-- Function to release a hold
CREATE OR REPLACE FUNCTION public.release_booking_hold(p_hold_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE booking_holds
  SET status = 'EXPIRED'
  WHERE id = p_hold_id
    AND user_id = p_user_id
    AND status = 'HELD';
  
  RETURN FOUND;
END;
$$;

-- Function to convert hold to booking (called by payment webhook)
CREATE OR REPLACE FUNCTION public.convert_hold_to_booking(p_hold_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold RECORD;
  v_start_date DATE;
  v_start_time TIME;
  v_end_time TIME;
  v_overlap_exists BOOLEAN;
BEGIN
  -- Get hold with lock
  SELECT * INTO v_hold
  FROM booking_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF v_hold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'HOLD_NOT_FOUND');
  END IF;

  IF v_hold.status != 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'HOLD_INVALID_STATUS', 'status', v_hold.status);
  END IF;

  IF v_hold.expires_at < now() THEN
    UPDATE booking_holds SET status = 'EXPIRED' WHERE id = p_hold_id;
    RETURN jsonb_build_object('success', false, 'error', 'HOLD_EXPIRED');
  END IF;

  -- Extract date/times
  v_start_date := v_hold.start_datetime::DATE;
  v_start_time := v_hold.start_datetime::TIME;
  v_end_time := v_hold.end_datetime::TIME;

  -- Defensive: re-check for overlaps
  SELECT EXISTS (
    SELECT 1 FROM court_availability ca
    WHERE ca.court_id = v_hold.court_id
      AND ca.available_date = v_start_date
      AND ca.is_booked = true
      AND ca.start_time < v_end_time
      AND ca.end_time > v_start_time
  ) INTO v_overlap_exists;

  IF v_overlap_exists THEN
    UPDATE booking_holds SET status = 'FAILED' WHERE id = p_hold_id;
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_TAKEN_DURING_PAYMENT');
  END IF;

  -- Mark hold as converted
  UPDATE booking_holds SET status = 'CONVERTED' WHERE id = p_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'court_id', v_hold.court_id,
    'user_id', v_hold.user_id,
    'start_date', v_start_date,
    'start_time', v_start_time,
    'end_time', v_end_time
  );
END;
$$;

-- Function to expire stale holds (called by cron)
CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE booking_holds
  SET status = 'EXPIRED'
  WHERE status = 'HELD' AND expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;