
-- Add 'transferred' and 'cancelled' to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'transferred';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled';
