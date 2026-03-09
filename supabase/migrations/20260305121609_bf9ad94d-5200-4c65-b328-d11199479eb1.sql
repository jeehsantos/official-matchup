
-- Add gender column to profiles
ALTER TABLE public.profiles ADD COLUMN gender text DEFAULT NULL;

-- Add gender_preference column to quick_challenges
ALTER TABLE public.quick_challenges ADD COLUMN gender_preference text NOT NULL DEFAULT 'mixed';
