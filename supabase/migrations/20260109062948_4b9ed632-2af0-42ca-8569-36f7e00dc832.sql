-- Add stripe_account_id to venues table for court managers to receive payouts
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venues_stripe_account_id ON public.venues(stripe_account_id);