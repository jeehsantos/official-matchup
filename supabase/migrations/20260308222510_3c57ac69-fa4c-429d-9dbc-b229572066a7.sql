
-- =============================================
-- 1. Create group_bans table
-- =============================================
CREATE TABLE public.group_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.group_bans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. Create quick_challenge_bans table
-- =============================================
CREATE TABLE public.quick_challenge_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.quick_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
ALTER TABLE public.quick_challenge_bans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. Security definer: is_group_ban_manager
-- Returns true if user is organizer or co-organizer (is_admin) of the group
-- =============================================
CREATE OR REPLACE FUNCTION public.is_group_ban_manager(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = _group_id AND g.organizer_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = _group_id AND gm.user_id = _user_id AND gm.is_admin = true
    )
$$;

-- =============================================
-- 4. Security definer: is_user_banned_from_group
-- =============================================
CREATE OR REPLACE FUNCTION public.is_user_banned_from_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_bans gb
    WHERE gb.group_id = _group_id AND gb.user_id = _user_id
  )
$$;

-- =============================================
-- 5. Security definer: is_user_banned_from_challenge
-- =============================================
CREATE OR REPLACE FUNCTION public.is_user_banned_from_challenge(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quick_challenge_bans qcb
    WHERE qcb.challenge_id = _challenge_id AND qcb.user_id = _user_id
  )
$$;

-- =============================================
-- 6. RLS policies for group_bans
-- =============================================

-- Organizers/co-organizers can view bans
CREATE POLICY "Ban managers can view group bans"
ON public.group_bans FOR SELECT
TO authenticated
USING (public.is_group_ban_manager(group_id, auth.uid()));

-- Banned users can view their own ban (for feedback)
CREATE POLICY "Banned users can view own ban"
ON public.group_bans FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Organizers/co-organizers can create bans
CREATE POLICY "Ban managers can create group bans"
ON public.group_bans FOR INSERT
TO authenticated
WITH CHECK (public.is_group_ban_manager(group_id, auth.uid()));

-- Organizers/co-organizers can remove bans (unban)
CREATE POLICY "Ban managers can delete group bans"
ON public.group_bans FOR DELETE
TO authenticated
USING (public.is_group_ban_manager(group_id, auth.uid()));

-- =============================================
-- 7. RLS policies for quick_challenge_bans
-- =============================================

-- Challenge creators can view bans
CREATE POLICY "Challenge creators can view bans"
ON public.quick_challenge_bans FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quick_challenges qc
  WHERE qc.id = challenge_id AND qc.created_by = auth.uid()
));

-- Banned users can view their own ban
CREATE POLICY "Banned users can view own challenge ban"
ON public.quick_challenge_bans FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Challenge creators can create bans
CREATE POLICY "Challenge creators can create bans"
ON public.quick_challenge_bans FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quick_challenges qc
  WHERE qc.id = challenge_id AND qc.created_by = auth.uid()
));

-- Challenge creators can remove bans
CREATE POLICY "Challenge creators can delete bans"
ON public.quick_challenge_bans FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quick_challenges qc
  WHERE qc.id = challenge_id AND qc.created_by = auth.uid()
));

-- =============================================
-- 8. Update group_members INSERT policy to block banned users
-- =============================================
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups"
ON public.group_members FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_user_banned_from_group(group_id, auth.uid())
);

-- =============================================
-- 9. Update quick_challenge_players INSERT policy to block banned users
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can join challenges" ON public.quick_challenge_players;
CREATE POLICY "Authenticated users can join challenges"
ON public.quick_challenge_players FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_user_banned_from_challenge(challenge_id, auth.uid())
);
