CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'court_manager',
    'organizer',
    'player'
);


--
-- Name: booking_payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_payment_type AS ENUM (
    'single',
    'split'
);


--
-- Name: ground_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ground_type AS ENUM (
    'grass',
    'turf',
    'sand',
    'hard',
    'clay',
    'other'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'game_reminder',
    'payment_due',
    'payment_confirmed',
    'rescue_mode',
    'slot_released',
    'player_joined',
    'group_invite'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


--
-- Name: payment_timing; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_timing AS ENUM (
    'at_booking',
    'before_session'
);


--
-- Name: session_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_state AS ENUM (
    'protected',
    'rescue',
    'released'
);


--
-- Name: session_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_type AS ENUM (
    'casual',
    'competitive',
    'training',
    'private',
    'tournament'
);


--
-- Name: sport_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sport_type AS ENUM (
    'futsal',
    'tennis',
    'volleyball',
    'basketball',
    'turf_hockey',
    'badminton',
    'other'
);


--
-- Name: can_view_group(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_group(_group_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    -- Public groups
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = _group_id AND g.is_public = true
    )
    OR
    -- Organizer
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = _group_id AND g.organizer_id = _user_id
    )
    OR
    -- Group member
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = _group_id AND gm.user_id = _user_id
    )
    OR
    -- Has open rescue session
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.group_id = _group_id
        AND s.is_cancelled = false
        AND s.is_rescue_open = true
        AND s.state = 'rescue'::session_state
    )
$$;


--
-- Name: cancel_session_and_release_court(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_session_and_release_court(session_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_group_id uuid;
  v_organizer_id uuid;
BEGIN
  -- Get the group_id and verify the user is the organizer
  SELECT s.group_id, g.organizer_id INTO v_group_id, v_organizer_id
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE s.id = session_id;
  
  -- Check if user is the organizer
  IF v_organizer_id IS NULL OR v_organizer_id != auth.uid() THEN
    RETURN false;
  END IF;
  
  -- Release the court availability
  UPDATE court_availability
  SET 
    is_booked = false,
    booked_by_session_id = NULL,
    booked_by_group_id = NULL,
    booked_by_user_id = NULL,
    payment_status = 'pending'
  WHERE booked_by_session_id = session_id;
  
  -- Delete all session players
  DELETE FROM session_players WHERE session_players.session_id = cancel_session_and_release_court.session_id;
  
  -- Mark session as cancelled
  UPDATE sessions
  SET is_cancelled = true
  WHERE id = session_id;
  
  RETURN true;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_group_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = _group_id
        AND g.organizer_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.user_id = _user_id
    );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizer_id uuid NOT NULL,
    court_manager_id uuid NOT NULL,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    expires_at timestamp with time zone
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: court_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.court_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    court_id uuid NOT NULL,
    available_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_booked boolean DEFAULT false,
    booked_by_group_id uuid,
    booked_by_session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booked_by_user_id uuid,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    template_id uuid
);


--
-- Name: courts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_id uuid NOT NULL,
    name text NOT NULL,
    sport_type public.sport_type NOT NULL,
    hourly_rate numeric(10,2) NOT NULL,
    capacity integer DEFAULT 10 NOT NULL,
    is_indoor boolean DEFAULT false,
    photo_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ground_type public.ground_type DEFAULT 'turf'::public.ground_type,
    payment_timing public.payment_timing DEFAULT 'at_booking'::public.payment_timing,
    payment_hours_before integer DEFAULT 24,
    photo_urls text[] DEFAULT '{}'::text[]
);


--
-- Name: group_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    invite_code text NOT NULL,
    created_by uuid NOT NULL,
    expires_at timestamp with time zone,
    max_uses integer,
    use_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_admin boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizer_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sport_type public.sport_type NOT NULL,
    default_court_id uuid,
    default_day_of_week integer NOT NULL,
    default_start_time time without time zone NOT NULL,
    default_duration_minutes integer DEFAULT 60 NOT NULL,
    weekly_court_price numeric(10,2) NOT NULL,
    min_players integer DEFAULT 6 NOT NULL,
    max_players integer DEFAULT 14 NOT NULL,
    payment_deadline_hours integer DEFAULT 24 NOT NULL,
    is_public boolean DEFAULT false,
    city text NOT NULL,
    photo_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT groups_default_day_of_week_check CHECK (((default_day_of_week >= 0) AND (default_day_of_week <= 6)))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    platform_fee numeric(10,2) DEFAULT 0,
    stripe_payment_intent_id text,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    city text,
    preferred_sports public.sport_type[] DEFAULT '{}'::public.sport_type[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_confirmed boolean DEFAULT false,
    is_from_rescue boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    court_id uuid,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    court_price numeric(10,2) NOT NULL,
    state public.session_state DEFAULT 'protected'::public.session_state NOT NULL,
    is_rescue_open boolean DEFAULT false,
    payment_deadline timestamp with time zone NOT NULL,
    min_players integer NOT NULL,
    max_players integer NOT NULL,
    notes text,
    is_cancelled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_type public.booking_payment_type DEFAULT 'single'::public.booking_payment_type,
    session_type public.session_type DEFAULT 'casual'::public.session_type
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: venue_date_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venue_date_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    is_closed boolean DEFAULT false NOT NULL,
    custom_start_time time without time zone,
    custom_end_time time without time zone,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_custom_time_range CHECK ((((custom_start_time IS NULL) AND (custom_end_time IS NULL)) OR ((custom_start_time IS NOT NULL) AND (custom_end_time IS NOT NULL) AND (custom_start_time < custom_end_time)))),
    CONSTRAINT valid_date_range CHECK (((end_date IS NULL) OR (start_date <= end_date)))
);


--
-- Name: venue_weekly_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venue_weekly_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_time_range CHECK (((start_time < end_time) OR (is_closed = true))),
    CONSTRAINT venue_weekly_rules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    phone text,
    email text,
    description text,
    photo_url text,
    amenities text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    country text DEFAULT 'New Zealand'::text,
    suburb text,
    stripe_account_id text,
    slot_interval_minutes integer DEFAULT 30 NOT NULL,
    max_booking_minutes integer DEFAULT 120 NOT NULL
);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_session_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_session_id_unique UNIQUE (session_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: court_availability court_availability_court_id_available_date_start_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_court_id_available_date_start_time_key UNIQUE (court_id, available_date, start_time);


--
-- Name: court_availability court_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_pkey PRIMARY KEY (id);


--
-- Name: courts courts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: group_invitations group_invitations_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_invite_code_key UNIQUE (invite_code);


--
-- Name: group_invitations group_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: session_players session_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_players
    ADD CONSTRAINT session_players_pkey PRIMARY KEY (id);


--
-- Name: session_players session_players_session_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_players
    ADD CONSTRAINT session_players_session_id_user_id_key UNIQUE (session_id, user_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: venue_weekly_rules unique_venue_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_weekly_rules
    ADD CONSTRAINT unique_venue_day UNIQUE (venue_id, day_of_week);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: venue_date_overrides venue_date_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_date_overrides
    ADD CONSTRAINT venue_date_overrides_pkey PRIMARY KEY (id);


--
-- Name: venue_weekly_rules venue_weekly_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_weekly_rules
    ADD CONSTRAINT venue_weekly_rules_pkey PRIMARY KEY (id);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: idx_court_availability_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_court_availability_booking ON public.court_availability USING btree (court_id, available_date, start_time, end_time) WHERE (is_booked = true);


--
-- Name: idx_court_availability_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_court_availability_template_id ON public.court_availability USING btree (template_id) WHERE (template_id IS NOT NULL);


--
-- Name: idx_venue_date_overrides_venue_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venue_date_overrides_venue_dates ON public.venue_date_overrides USING btree (venue_id, start_date, end_date);


--
-- Name: idx_venue_weekly_rules_venue_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venue_weekly_rules_venue_day ON public.venue_weekly_rules USING btree (venue_id, day_of_week);


--
-- Name: idx_venues_stripe_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venues_stripe_account_id ON public.venues USING btree (stripe_account_id);


--
-- Name: chat_conversations update_chat_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: court_availability update_court_availability_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_court_availability_updated_at BEFORE UPDATE ON public.court_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: courts update_courts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON public.courts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: groups update_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sessions update_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: venue_date_overrides update_venue_date_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_venue_date_overrides_updated_at BEFORE UPDATE ON public.venue_date_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: venue_weekly_rules update_venue_weekly_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_venue_weekly_rules_updated_at BEFORE UPDATE ON public.venue_weekly_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: venues update_venues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_conversations chat_conversations_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.court_availability(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_court_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_court_manager_id_fkey FOREIGN KEY (court_manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: court_availability court_availability_booked_by_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_booked_by_group_id_fkey FOREIGN KEY (booked_by_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: court_availability court_availability_booked_by_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_booked_by_session_id_fkey FOREIGN KEY (booked_by_session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: court_availability court_availability_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;


--
-- Name: courts courts_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: group_invitations group_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: group_invitations group_invitations_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_default_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_default_court_id_fkey FOREIGN KEY (default_court_id) REFERENCES public.courts(id) ON DELETE SET NULL;


--
-- Name: groups groups_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_players session_players_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_players
    ADD CONSTRAINT session_players_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_players session_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_players
    ADD CONSTRAINT session_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: venue_date_overrides venue_date_overrides_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_date_overrides
    ADD CONSTRAINT venue_date_overrides_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: venue_weekly_rules venue_weekly_rules_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_weekly_rules
    ADD CONSTRAINT venue_weekly_rules_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: venues venues_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_messages Anyone can submit contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages FOR INSERT WITH CHECK (((name IS NOT NULL) AND (btrim(name) <> ''::text) AND (email IS NOT NULL) AND (btrim(email) <> ''::text) AND (subject IS NOT NULL) AND (btrim(subject) <> ''::text) AND (message IS NOT NULL) AND (btrim(message) <> ''::text)));


--
-- Name: group_invitations Anyone can view active invitations by code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active invitations by code" ON public.group_invitations FOR SELECT USING ((is_active = true));


--
-- Name: groups Authenticated users can create groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK ((auth.uid() = organizer_id));


--
-- Name: notifications Authenticated users receive notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users receive notifications" ON public.notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: court_availability Available slots viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Available slots viewable by everyone" ON public.court_availability FOR SELECT USING (true);


--
-- Name: chat_messages Conversation participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Conversation participants can send messages" ON public.chat_messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.chat_conversations cc
  WHERE ((cc.id = chat_messages.conversation_id) AND ((cc.organizer_id = auth.uid()) OR (cc.court_manager_id = auth.uid())))))));


--
-- Name: chat_messages Conversation participants can view messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Conversation participants can view messages" ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_conversations cc
  WHERE ((cc.id = chat_messages.conversation_id) AND ((cc.organizer_id = auth.uid()) OR (cc.court_manager_id = auth.uid()))))));


--
-- Name: court_availability Court managers can create availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can create availability" ON public.court_availability FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.courts c
     JOIN public.venues v ON ((v.id = c.venue_id)))
  WHERE ((c.id = court_availability.court_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venues Court managers can create venues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can create venues" ON public.venues FOR INSERT WITH CHECK (((auth.uid() = owner_id) AND public.has_role(auth.uid(), 'court_manager'::public.app_role)));


--
-- Name: court_availability Court managers can delete availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can delete availability" ON public.court_availability FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.courts c
     JOIN public.venues v ON ((v.id = c.venue_id)))
  WHERE ((c.id = court_availability.court_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venues Court managers can delete own venues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can delete own venues" ON public.venues FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: court_availability Court managers can update availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can update availability" ON public.court_availability FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.courts c
     JOIN public.venues v ON ((v.id = c.venue_id)))
  WHERE ((c.id = court_availability.court_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venues Court managers can update own venues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Court managers can update own venues" ON public.venues FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: courts Courts are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Courts are viewable by everyone" ON public.courts FOR SELECT USING ((is_active = true));


--
-- Name: venue_date_overrides Date overrides viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Date overrides viewable by everyone" ON public.venue_date_overrides FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_date_overrides.venue_id) AND (v.is_active = true)))));


--
-- Name: group_members Group members can view members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view members" ON public.group_members FOR SELECT USING (public.is_group_member(group_id, auth.uid()));


--
-- Name: group_invitations Group organizers can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group organizers can manage invitations" ON public.group_invitations USING ((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_invitations.group_id) AND (g.organizer_id = auth.uid())))));


--
-- Name: sessions Organizers can create sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can create sessions" ON public.sessions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = sessions.group_id) AND (g.organizer_id = auth.uid())))));


--
-- Name: groups Organizers can delete own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can delete own groups" ON public.groups FOR DELETE USING ((auth.uid() = organizer_id));


--
-- Name: group_members Organizers can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can manage members" ON public.group_members FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_members.group_id) AND (g.organizer_id = auth.uid())))) OR (auth.uid() = user_id)));


--
-- Name: group_members Organizers can update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can update members" ON public.group_members FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_members.group_id) AND (g.organizer_id = auth.uid())))));


--
-- Name: groups Organizers can update own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can update own groups" ON public.groups FOR UPDATE USING ((auth.uid() = organizer_id));


--
-- Name: sessions Organizers can update sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can update sessions" ON public.sessions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = sessions.group_id) AND (g.organizer_id = auth.uid())))));


--
-- Name: groups Organizers can view own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can view own groups" ON public.groups FOR SELECT USING ((auth.uid() = organizer_id));


--
-- Name: court_availability Players can book available slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can book available slots" ON public.court_availability FOR UPDATE USING ((is_booked = false)) WITH CHECK (((is_booked = true) AND (booked_by_user_id = auth.uid()) AND (payment_status = 'pending'::public.payment_status)));


--
-- Name: session_players Players can join sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can join sessions" ON public.session_players FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: session_players Players can leave sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can leave sessions" ON public.session_players FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: session_players Players can update own participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can update own participation" ON public.session_players FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: groups Public groups are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public groups are viewable" ON public.groups FOR SELECT USING (public.can_view_group(id, auth.uid()));


--
-- Name: chat_messages Recipients can mark messages as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipients can mark messages as read" ON public.chat_messages FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.chat_conversations cc
  WHERE ((cc.id = chat_messages.conversation_id) AND ((cc.organizer_id = auth.uid()) OR (cc.court_manager_id = auth.uid()))))) AND (sender_id <> auth.uid())));


--
-- Name: chat_conversations Session participants can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session participants can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (((auth.uid() = organizer_id) AND (session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (((public.sessions s
     JOIN public.groups g ON ((g.id = s.group_id)))
     JOIN public.courts c ON ((c.id = s.court_id)))
     JOIN public.venues v ON ((v.id = c.venue_id)))
  WHERE ((s.id = chat_conversations.session_id) AND (g.organizer_id = auth.uid()) AND (v.owner_id = chat_conversations.court_manager_id))))));


--
-- Name: chat_conversations Session participants can delete expired conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session participants can delete expired conversations" ON public.chat_conversations FOR DELETE USING (((expires_at IS NOT NULL) AND (expires_at <= now()) AND ((auth.uid() = organizer_id) OR (auth.uid() = court_manager_id))));


--
-- Name: chat_conversations Session participants can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session participants can update conversations" ON public.chat_conversations FOR UPDATE USING (((auth.uid() = organizer_id) OR (auth.uid() = court_manager_id)));


--
-- Name: chat_conversations Session participants can view conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session participants can view conversations" ON public.chat_conversations FOR SELECT USING (((auth.uid() = organizer_id) OR (auth.uid() = court_manager_id)));


--
-- Name: session_players Session players viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session players viewable" ON public.session_players FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_players.session_id) AND ((EXISTS ( SELECT 1
           FROM public.group_members gm
          WHERE ((gm.group_id = s.group_id) AND (gm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM public.groups g
          WHERE ((g.id = s.group_id) AND (g.organizer_id = auth.uid())))) OR ((s.is_rescue_open = true) AND (s.state = 'rescue'::public.session_state)))))));


--
-- Name: sessions Sessions viewable by group members or rescue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sessions viewable by group members or rescue" ON public.sessions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.group_members gm
  WHERE ((gm.group_id = sessions.group_id) AND (gm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = sessions.group_id) AND (g.organizer_id = auth.uid())))) OR ((is_rescue_open = true) AND (state = 'rescue'::public.session_state))));


--
-- Name: payments Users can create own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own payments" ON public.payments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_roles Users can insert own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: group_members Users can join groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payments Users can view own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: courts Venue owners can create courts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can create courts" ON public.courts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.venues
  WHERE ((venues.id = courts.venue_id) AND (venues.owner_id = auth.uid())))));


--
-- Name: venue_date_overrides Venue owners can create date overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can create date overrides" ON public.venue_date_overrides FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_date_overrides.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venue_weekly_rules Venue owners can create weekly rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can create weekly rules" ON public.venue_weekly_rules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_weekly_rules.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: courts Venue owners can delete courts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can delete courts" ON public.courts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.venues
  WHERE ((venues.id = courts.venue_id) AND (venues.owner_id = auth.uid())))));


--
-- Name: venue_date_overrides Venue owners can delete date overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can delete date overrides" ON public.venue_date_overrides FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_date_overrides.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venue_weekly_rules Venue owners can delete weekly rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can delete weekly rules" ON public.venue_weekly_rules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_weekly_rules.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: courts Venue owners can update courts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can update courts" ON public.courts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.venues
  WHERE ((venues.id = courts.venue_id) AND (venues.owner_id = auth.uid())))));


--
-- Name: venue_date_overrides Venue owners can update date overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can update date overrides" ON public.venue_date_overrides FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_date_overrides.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venue_weekly_rules Venue owners can update weekly rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venue owners can update weekly rules" ON public.venue_weekly_rules FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_weekly_rules.venue_id) AND (v.owner_id = auth.uid())))));


--
-- Name: venues Venues are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING ((is_active = true));


--
-- Name: venue_weekly_rules Weekly rules viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Weekly rules viewable by everyone" ON public.venue_weekly_rules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE ((v.id = venue_weekly_rules.venue_id) AND (v.is_active = true)))));


--
-- Name: chat_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: court_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.court_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: courts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

--
-- Name: group_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: session_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_date_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venue_date_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_weekly_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venue_weekly_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: venues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;