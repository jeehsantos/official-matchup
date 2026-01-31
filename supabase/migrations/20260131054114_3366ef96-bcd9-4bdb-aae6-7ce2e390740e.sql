-- Add nationality_code column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN nationality_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.nationality_code IS 'ISO 3166-1 alpha-2 country code (e.g., NZ, BR, US)';