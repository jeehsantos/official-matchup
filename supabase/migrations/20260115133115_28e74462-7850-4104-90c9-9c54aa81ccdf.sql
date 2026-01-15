-- Change preferred_sports from sport_type[] to text[] to support database-driven sports
ALTER TABLE public.profiles 
  ALTER COLUMN preferred_sports TYPE text[] USING preferred_sports::text[];