-- Add credits-escrow accounting columns to NORMAL flow payment snapshots.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_profit_target integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_type text NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS converted_to_credits_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_payment_method_type_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_method_type_check
      CHECK (payment_method_type IN ('card', 'credits'));
  END IF;
END $$;

-- QUICK CHALLENGE does not persist snapshots in public.payments;
-- create a durable payment snapshot table for challenge payments.
CREATE TABLE IF NOT EXISTS public.quick_challenge_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.quick_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  court_amount integer NOT NULL,
  platform_profit_target integer NOT NULL DEFAULT 0,
  service_fee_total integer NOT NULL DEFAULT 0,
  payment_method_type text NOT NULL,
  stripe_payment_intent_id text,
  stripe_fee_actual integer,
  status text NOT NULL,
  paid_at timestamp with time zone,
  converted_to_credits_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quick_challenge_payments_payment_method_type_check
    CHECK (payment_method_type IN ('card', 'credits')),
  CONSTRAINT quick_challenge_payments_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'converted_to_credits', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS quick_challenge_payments_challenge_user_intent_uidx
  ON public.quick_challenge_payments (challenge_id, user_id, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quick_challenge_payments_challenge_user_credit_only_uidx
  ON public.quick_challenge_payments (challenge_id, user_id)
  WHERE stripe_payment_intent_id IS NULL;

CREATE INDEX IF NOT EXISTS quick_challenge_payments_challenge_idx
  ON public.quick_challenge_payments (challenge_id);

CREATE INDEX IF NOT EXISTS quick_challenge_payments_user_idx
  ON public.quick_challenge_payments (user_id);

CREATE INDEX IF NOT EXISTS quick_challenge_payments_status_idx
  ON public.quick_challenge_payments (status);

ALTER TABLE public.quick_challenge_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quick_challenge_payments'
      AND policyname = 'Users can view own quick challenge payments'
  ) THEN
    CREATE POLICY "Users can view own quick challenge payments"
    ON public.quick_challenge_payments
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_quick_challenge_payments_updated_at'
      AND tgrelid = 'public.quick_challenge_payments'::regclass
  ) THEN
    CREATE TRIGGER update_quick_challenge_payments_updated_at
    BEFORE UPDATE ON public.quick_challenge_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
