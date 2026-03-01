
-- Create held_credit_liabilities table for tracking deferred court payouts
CREATE TABLE public.held_credit_liabilities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  source_session_id uuid NOT NULL REFERENCES public.sessions(id),
  source_payment_id uuid NOT NULL REFERENCES public.payments(id),
  applied_session_id uuid REFERENCES public.sessions(id),
  status text NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'APPLIED')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.held_credit_liabilities ENABLE ROW LEVEL SECURITY;

-- Users can view their own liabilities
CREATE POLICY "Users can view own liabilities"
  ON public.held_credit_liabilities
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role inserts/updates (via edge functions), but we need a permissive policy for admin
-- No direct user insert/update/delete policies needed since edge functions use service role
