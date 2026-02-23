
-- Drop sport_type column from courts table since allowed_sports is the source of truth
ALTER TABLE public.courts DROP COLUMN sport_type;
