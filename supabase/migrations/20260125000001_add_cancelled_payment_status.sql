-- Migration: Add 'cancelled' status to payment_status enum
-- Related to: Task 7.4 - Handle cancellation before confirmation
-- Purpose: Allow tracking of payments that were cancelled before confirmation
--          (distinct from 'refunded' which is for cash payments converted to credits)

-- Add 'cancelled' status to payment_status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'cancelled';
    RAISE NOTICE 'Added cancelled status to payment_status enum';
  END IF;
END $$;

-- Add comment explaining the status
COMMENT ON TYPE payment_status IS 'Payment status: pending (awaiting payment), completed (paid and confirmed), failed (payment failed), refunded (cash payment converted to credits on cancellation), cancelled (credit-only payment cancelled), transferred (payment sent to venue owner)';
