
-- Table to track failed login attempts by email (not user_id, since user may not exist)
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  last_attempt_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Unique constraint on email for upsert
CREATE UNIQUE INDEX login_attempts_email_idx ON public.login_attempts (email);

-- Enable RLS but allow public access via security definer functions only
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct RLS policies - all access through security definer functions

-- Function to check if an email is locked out
CREATE OR REPLACE FUNCTION public.check_login_attempt(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_remaining integer;
  v_locked_until timestamp with time zone;
BEGIN
  SELECT * INTO v_record FROM login_attempts WHERE email = lower(trim(p_email));
  
  -- No record = first attempt, allowed
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'remaining_attempts', 4);
  END IF;
  
  -- Check if locked and lock hasn't expired
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'locked', true,
      'locked_until', v_record.locked_until,
      'remaining_attempts', 0
    );
  END IF;
  
  -- If lock expired, reset
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= now() THEN
    DELETE FROM login_attempts WHERE email = lower(trim(p_email));
    RETURN jsonb_build_object('allowed', true, 'remaining_attempts', 4);
  END IF;
  
  v_remaining := GREATEST(4 - v_record.attempt_count, 0);
  RETURN jsonb_build_object('allowed', v_remaining > 0, 'remaining_attempts', v_remaining);
END;
$$;

-- Function to record a failed login attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_new_count integer;
  v_locked_until timestamp with time zone;
BEGIN
  INSERT INTO login_attempts (email, attempt_count, last_attempt_at)
  VALUES (lower(trim(p_email)), 1, now())
  ON CONFLICT (email) DO UPDATE
  SET attempt_count = CASE
    -- If previously locked and expired, reset to 1
    WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= now() THEN 1
    ELSE login_attempts.attempt_count + 1
  END,
  last_attempt_at = now(),
  locked_until = CASE
    -- Lock after 4 failed attempts (this will be attempt #4 or more)
    WHEN login_attempts.attempt_count >= 3 AND (login_attempts.locked_until IS NULL OR login_attempts.locked_until <= now())
    THEN now() + interval '30 minutes'
    ELSE login_attempts.locked_until
  END
  RETURNING attempt_count, locked_until INTO v_new_count, v_locked_until;
  
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_locked_until,
      'remaining_attempts', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'locked', false,
    'remaining_attempts', GREATEST(4 - v_new_count, 0)
  );
END;
$$;

-- Function to clear attempts on successful login
CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM login_attempts WHERE email = lower(trim(p_email));
END;
$$;
