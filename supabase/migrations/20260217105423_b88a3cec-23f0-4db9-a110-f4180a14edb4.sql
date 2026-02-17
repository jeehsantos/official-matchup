
-- Add snapshot and accounting columns to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_fee_actual numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS court_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_type_snapshot text DEFAULT NULL;
