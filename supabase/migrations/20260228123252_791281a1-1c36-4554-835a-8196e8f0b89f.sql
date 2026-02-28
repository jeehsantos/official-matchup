
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code TEXT;
  v_referrer RECORD;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default role is player
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player');

  -- Process referral code if present in metadata
  v_referral_code := NEW.raw_user_meta_data ->> 'referral_code';
  IF v_referral_code IS NOT NULL AND v_referral_code != '' THEN
    SELECT user_id INTO v_referrer
    FROM public.profiles
    WHERE referral_code = v_referral_code
    LIMIT 1;

    IF v_referrer IS NOT NULL AND v_referrer.user_id != NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code, status)
      VALUES (v_referrer.user_id, NEW.id, v_referral_code, 'pending');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
