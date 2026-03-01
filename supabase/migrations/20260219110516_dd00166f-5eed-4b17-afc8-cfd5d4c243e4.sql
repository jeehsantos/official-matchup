
-- 1. Fix profiles public exposure: replace open SELECT with scoped policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

-- Users can view profiles of group members they share a group with
CREATE POLICY "Users can view group member profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.user_id
  )
);

-- Users can view profiles of quick challenge participants
CREATE POLICY "Users can view challenge participant profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM quick_challenge_players qp1
    JOIN quick_challenge_players qp2 ON qp1.challenge_id = qp2.challenge_id
    WHERE qp1.user_id = auth.uid() AND qp2.user_id = profiles.user_id
  )
);

-- Users can view profiles of session participants
CREATE POLICY "Users can view session participant profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM session_players sp1
    JOIN session_players sp2 ON sp1.session_id = sp2.session_id
    WHERE sp1.user_id = auth.uid() AND sp2.user_id = profiles.user_id
  )
);

-- Group organizers can view profiles of their group members
CREATE POLICY "Organizers can view member profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE g.organizer_id = auth.uid() AND gm.user_id = profiles.user_id
  )
);

-- 2. Fix add_user_credits: add authorization check
CREATE OR REPLACE FUNCTION public.add_user_credits(p_user_id uuid, p_amount numeric, p_reason text, p_session_id uuid DEFAULT NULL::uuid, p_payment_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Only allow service_role (edge functions) or admins to add credits
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only system or admins can add credits';
  END IF;

  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Upsert user_credits
  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + p_amount,
      updated_at = now();
  
  -- Get new balance
  SELECT balance INTO v_new_balance FROM user_credits WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reason, related_session_id, related_payment_id)
  VALUES (p_user_id, p_amount, 'credit', p_reason, p_session_id, p_payment_id);
  
  RETURN v_new_balance;
END;
$function$;

-- Fix use_user_credits: users can only spend their own credits
CREATE OR REPLACE FUNCTION public.use_user_credits(p_user_id uuid, p_amount numeric, p_reason text, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Users can only use their own credits, or service_role/admin can use any
  IF auth.uid() IS NOT NULL AND p_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Can only use your own credits';
  END IF;

  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN false;
  END IF;
  
  -- Deduct credits
  UPDATE user_credits
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reason, related_session_id)
  VALUES (p_user_id, p_amount, 'debit', p_reason, p_session_id);
  
  RETURN true;
END;
$function$;

-- 3. Enable RLS on archive tables
ALTER TABLE IF EXISTS sessions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_players_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contact_messages_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS archiving_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access to archive tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions_archive' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Admins can view archived sessions" ON public.sessions_archive FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_players_archive' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Admins can view archived session players" ON public.session_players_archive FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments_archive' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Users can view own archived payments" ON public.payments_archive FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Admins can view all archived payments" ON public.payments_archive FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_messages_archive' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Admins can view archived contact messages" ON public.contact_messages_archive FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archiving_logs' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Admins can view archiving logs" ON public.archiving_logs FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;
