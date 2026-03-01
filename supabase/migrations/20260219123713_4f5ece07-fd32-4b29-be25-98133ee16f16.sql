
-- Add Stripe fee columns to existing platform_settings table
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS stripe_percent numeric NOT NULL DEFAULT 0.029,
  ADD COLUMN IF NOT EXISTS stripe_fixed numeric NOT NULL DEFAULT 0.30;

-- Ensure the single existing row has the default values populated
UPDATE public.platform_settings
SET stripe_percent = 0.029, stripe_fixed = 0.30
WHERE stripe_percent IS NULL OR stripe_fixed IS NULL;
