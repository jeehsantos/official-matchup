
-- Referral settings table (admin-configurable)
CREATE TABLE public.referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_amount numeric NOT NULL DEFAULT 5.00,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage referral settings"
ON public.referral_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read settings (needed by edge functions via service role, and UI)
CREATE POLICY "Referral settings viewable by authenticated"
ON public.referral_settings FOR SELECT
USING (true);

-- Insert default setting
INSERT INTO public.referral_settings (credit_amount, is_active) VALUES (5.00, true);

-- Referrals tracking table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credited_amount numeric DEFAULT 0,
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

-- System inserts referrals (during signup)
CREATE POLICY "Authenticated users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referred_user_id);

-- Add referral_code column to profiles for unique referral codes
ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;

-- Generate referral codes for existing users
UPDATE public.profiles 
SET referral_code = UPPER(SUBSTRING(md5(user_id::text || now()::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Function to generate referral code on new profile creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(md5(NEW.user_id::text || now()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

-- Function to process referral credit (called by edge functions after payment)
CREATE OR REPLACE FUNCTION public.process_referral_credit(p_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_credit_amount numeric;
  v_is_active boolean;
BEGIN
  -- Check if referral program is active and get credit amount
  SELECT credit_amount, is_active INTO v_credit_amount, v_is_active
  FROM referral_settings
  LIMIT 1;

  IF NOT v_is_active OR v_credit_amount IS NULL THEN
    RETURN false;
  END IF;

  -- Find pending referral for this user
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_referred_user_id
    AND status = 'pending'
  LIMIT 1;

  IF v_referral IS NULL THEN
    RETURN false;
  END IF;

  -- Award credits to referrer
  PERFORM add_user_credits(
    v_referral.referrer_id,
    v_credit_amount,
    'Referral bonus for inviting a new player',
    NULL,
    NULL
  );

  -- Mark referral as completed
  UPDATE referrals
  SET status = 'completed',
      credited_amount = v_credit_amount,
      credited_at = now()
  WHERE id = v_referral.id;

  RETURN true;
END;
$$;
