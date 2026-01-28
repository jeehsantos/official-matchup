-- Create quick_challenges table for the matchmaking system
CREATE TABLE public.quick_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_category_id UUID NOT NULL REFERENCES public.sport_categories(id),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('1vs1', '2vs2', '3vs3', '4vs4', '5vs5')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'in_progress', 'completed', 'cancelled')),
  venue_id UUID REFERENCES public.venues(id),
  court_id UUID REFERENCES public.courts(id),
  scheduled_date DATE,
  scheduled_time TIME,
  price_per_player NUMERIC NOT NULL DEFAULT 0,
  total_slots INTEGER NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quick_challenge_players table to track players in each challenge
CREATE TABLE public.quick_challenge_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.quick_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('left', 'right')),
  slot_position INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  stripe_session_id TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(challenge_id, team, slot_position),
  UNIQUE(challenge_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.quick_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_challenge_players ENABLE ROW LEVEL SECURITY;

-- Quick challenges are viewable by everyone (public matchmaking)
CREATE POLICY "Quick challenges are viewable by everyone"
ON public.quick_challenges
FOR SELECT
USING (status IN ('open', 'full'));

-- Authenticated users can create quick challenges
CREATE POLICY "Authenticated users can create quick challenges"
ON public.quick_challenges
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Creators can update their challenges
CREATE POLICY "Creators can update their quick challenges"
ON public.quick_challenges
FOR UPDATE
USING (auth.uid() = created_by);

-- Players can view challenge players
CREATE POLICY "Anyone can view challenge players"
ON public.quick_challenge_players
FOR SELECT
USING (true);

-- Authenticated users can join challenges
CREATE POLICY "Authenticated users can join challenges"
ON public.quick_challenge_players
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Players can leave (delete) their own participation
CREATE POLICY "Players can leave challenges"
ON public.quick_challenge_players
FOR DELETE
USING (auth.uid() = user_id);

-- Players can update their own payment status (for webhook updates)
CREATE POLICY "Players can update their participation"
ON public.quick_challenge_players
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_quick_challenges_status ON public.quick_challenges(status);
CREATE INDEX idx_quick_challenges_sport ON public.quick_challenges(sport_category_id);
CREATE INDEX idx_quick_challenge_players_challenge ON public.quick_challenge_players(challenge_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_challenge_players;

-- Add updated_at trigger
CREATE TRIGGER update_quick_challenges_updated_at
BEFORE UPDATE ON public.quick_challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();