-- Ensure payment snapshot columns exist for webhook + verify-payment parity
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_profit_target numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_fee_total numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method_type text DEFAULT NULL;

-- Deduplicate historical rows before adding a unique index.
WITH duplicate_intents AS (
  SELECT stripe_payment_intent_id
  FROM public.payments
  WHERE stripe_payment_intent_id IS NOT NULL
  GROUP BY stripe_payment_intent_id
  HAVING COUNT(*) > 1
), ranked AS (
  SELECT
    p.id,
    p.stripe_payment_intent_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.stripe_payment_intent_id
      ORDER BY p.paid_at DESC NULLS LAST, p.updated_at DESC NULLS LAST, p.created_at DESC, p.id DESC
    ) AS rn
  FROM public.payments p
  INNER JOIN duplicate_intents d
    ON d.stripe_payment_intent_id = p.stripe_payment_intent_id
)
UPDATE public.payments p
SET stripe_payment_intent_id = NULL
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Enforce idempotency key uniqueness for Stripe payment intent based writes
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_stripe_payment_intent_id
ON public.payments (stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

-- Keep payout scans/index lookups fast for completed/untransferred rows by session
CREATE INDEX IF NOT EXISTS idx_payments_payout_lookup
ON public.payments (session_id, status, transferred_at, user_id)
WHERE status = 'completed';

-- Fast lookup for webhook / verify-payment idempotency checks
CREATE INDEX IF NOT EXISTS idx_payments_intent_status
ON public.payments (stripe_payment_intent_id, status)
WHERE stripe_payment_intent_id IS NOT NULL;
