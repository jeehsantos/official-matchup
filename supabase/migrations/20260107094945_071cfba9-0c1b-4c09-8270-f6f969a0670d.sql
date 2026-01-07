-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('court_manager', 'organizer', 'player');

-- Create sport_type enum
CREATE TYPE public.sport_type AS ENUM ('futsal', 'tennis', 'volleyball', 'basketball', 'turf_hockey', 'badminton', 'other');

-- Create session_state enum
CREATE TYPE public.session_state AS ENUM ('protected', 'rescue', 'released');

-- Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create notification_type enum
CREATE TYPE public.notification_type AS ENUM ('game_reminder', 'payment_due', 'payment_confirmed', 'rescue_mode', 'slot_released', 'player_joined', 'group_invite');

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  city TEXT,
  preferred_sports sport_type[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Venues table (court manager's venues)
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone TEXT,
  email TEXT,
  description TEXT,
  photo_url TEXT,
  amenities TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courts table
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sport_type sport_type NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10,
  is_indoor BOOLEAN DEFAULT false,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Groups table (recurring game groups)
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sport_type sport_type NOT NULL,
  default_court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  default_day_of_week INTEGER NOT NULL CHECK (default_day_of_week >= 0 AND default_day_of_week <= 6),
  default_start_time TIME NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  weekly_court_price DECIMAL(10, 2) NOT NULL,
  min_players INTEGER NOT NULL DEFAULT 6,
  max_players INTEGER NOT NULL DEFAULT 14,
  payment_deadline_hours INTEGER NOT NULL DEFAULT 24,
  is_public BOOLEAN DEFAULT false,
  city TEXT NOT NULL,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Sessions table (weekly game instances)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  court_price DECIMAL(10, 2) NOT NULL,
  state session_state NOT NULL DEFAULT 'protected',
  is_rescue_open BOOLEAN DEFAULT false,
  payment_deadline TIMESTAMPTZ NOT NULL,
  min_players INTEGER NOT NULL,
  max_players INTEGER NOT NULL,
  notes TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, session_date)
);

-- Session players table
CREATE TABLE public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_confirmed BOOLEAN DEFAULT false,
  is_from_rescue BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE (session_id, user_id)
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2) DEFAULT 0,
  stripe_payment_intent_id TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default role is player
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON public.courts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can view all profiles, edit own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles: Users can view own roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Venues: Public read, court managers can manage own
CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING (is_active = true);
CREATE POLICY "Court managers can create venues" ON public.venues FOR INSERT WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'court_manager'));
CREATE POLICY "Court managers can update own venues" ON public.venues FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Court managers can delete own venues" ON public.venues FOR DELETE USING (auth.uid() = owner_id);

-- Courts: Public read, venue owners can manage
CREATE POLICY "Courts are viewable by everyone" ON public.courts FOR SELECT USING (is_active = true);
CREATE POLICY "Venue owners can create courts" ON public.courts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid())
);
CREATE POLICY "Venue owners can update courts" ON public.courts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid())
);
CREATE POLICY "Venue owners can delete courts" ON public.courts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid())
);

-- Groups: Public groups visible, members can see private groups
CREATE POLICY "Public groups are viewable" ON public.groups FOR SELECT USING (
  is_public = true OR 
  auth.uid() = organizer_id OR 
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid())
);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update own groups" ON public.groups FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Organizers can delete own groups" ON public.groups FOR DELETE USING (auth.uid() = organizer_id);

-- Group members: Members can view, organizers can manage
CREATE POLICY "Group members can view members" ON public.group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organizer_id = auth.uid())
);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Organizers can manage members" ON public.group_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organizer_id = auth.uid()) OR
  auth.uid() = user_id
);

-- Sessions: Visible to group members or if rescue mode is open
CREATE POLICY "Sessions viewable by group members or rescue" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organizer_id = auth.uid()) OR
  (is_rescue_open = true AND state = 'rescue')
);
CREATE POLICY "Organizers can create sessions" ON public.sessions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organizer_id = auth.uid())
);
CREATE POLICY "Organizers can update sessions" ON public.sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organizer_id = auth.uid())
);

-- Session players: Players can view and join
CREATE POLICY "Session players viewable" ON public.session_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = s.group_id AND gm.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = s.group_id AND g.organizer_id = auth.uid()) OR
    (s.is_rescue_open = true AND s.state = 'rescue')
  ))
);
CREATE POLICY "Players can join sessions" ON public.session_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can leave sessions" ON public.session_players FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Players can update own participation" ON public.session_players FOR UPDATE USING (auth.uid() = user_id);

-- Payments: Users can view own payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications: Users can view and manage own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;