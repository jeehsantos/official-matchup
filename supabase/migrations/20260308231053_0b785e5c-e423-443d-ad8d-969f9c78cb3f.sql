-- Backfill venue phone/email from owner profiles and auth users
UPDATE public.venues v
SET 
  phone = COALESCE(v.phone, p.phone),
  email = COALESCE(v.email, u.email)
FROM public.profiles p, auth.users u
WHERE p.user_id = v.owner_id
  AND u.id = v.owner_id
  AND (v.phone IS NULL OR v.email IS NULL);