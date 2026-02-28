
-- Create quick_challenge_payments table for payment snapshots
CREATE TABLE public.quick_challenge_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.quick_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  court_amount INTEGER NOT NULL DEFAULT 0,
  platform_profit_target INTEGER DEFAULT 0,
  service_fee_total INTEGER DEFAULT 0,
  payment_method_type TEXT DEFAULT 'card',
  stripe_payment_intent_id TEXT,
  stripe_fee_actual INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id, stripe_payment_intent_id)
);

-- Enable RLS
ALTER TABLE public.quick_challenge_payments ENABLE ROW LEVEL SECURITY;

-- Players can view their own payment records
CREATE POLICY "Users can view own quick challenge payments"
  ON public.quick_challenge_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only system (service_role) inserts/updates via edge functions
-- No user INSERT/UPDATE/DELETE policies needed
