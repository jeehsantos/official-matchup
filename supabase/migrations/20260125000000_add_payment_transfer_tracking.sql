-- Migration: Add Payment Transfer Tracking
-- Description: Add fields to track payment transfers to venue owners after player confirmation
-- Related to: Task 7.2 - Implement payment transfer on confirmation

-- Add 'transferred' status to payment_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'transferred'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'transferred';
  END IF;
END $$;

-- Add transfer tracking fields to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(10,2);

-- Add index for querying payments that need transfer
CREATE INDEX IF NOT EXISTS idx_payments_pending_transfer 
ON payments(session_id, status) 
WHERE status = 'completed' AND transferred_at IS NULL;

-- Add index for transfer tracking
CREATE INDEX IF NOT EXISTS idx_payments_transferred 
ON payments(transferred_at) 
WHERE transferred_at IS NOT NULL;

-- Add comment explaining the transfer flow
COMMENT ON COLUMN payments.transferred_at IS 'Timestamp when payment was transferred to venue owner after player confirmation';
COMMENT ON COLUMN payments.stripe_transfer_id IS 'Stripe Transfer ID for the transfer to connected account';
COMMENT ON COLUMN payments.transfer_amount IS 'Amount transferred to venue owner (payment amount minus platform fee)';
