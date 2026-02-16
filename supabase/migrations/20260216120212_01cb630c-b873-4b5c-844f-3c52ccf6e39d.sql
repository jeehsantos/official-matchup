
-- Add transfer tracking columns to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transferred_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS transfer_amount numeric;
