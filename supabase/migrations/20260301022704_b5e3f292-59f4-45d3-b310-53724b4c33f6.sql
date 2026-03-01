
-- 1) Harden handle_new_user with normalization, role from metadata, ON CONFLICT safety
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code TEXT;
  v_role TEXT;
  v_referrer_user_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  -- Role from metadata with fallback to player
  v_role := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'role'), ''), 'player');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role::app_role);

  -- Process referral code if present in metadata
  v_referral_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'referral_code', '')));
  IF v_referral_code != '' THEN
    SELECT p.user_id INTO v_referrer_user_id
    FROM public.profiles p
    WHERE p.referral_code = v_referral_code
    LIMIT 1;

    IF v_referrer_user_id IS NOT NULL AND v_referrer_user_id != NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code, status)
      VALUES (v_referrer_user_id, NEW.id, v_referral_code, 'pending')
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Attach trigger to auth.users (defensive re-creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Unique index on referrals(referred_user_id) for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_user_unique
  ON public.referrals (referred_user_id);
