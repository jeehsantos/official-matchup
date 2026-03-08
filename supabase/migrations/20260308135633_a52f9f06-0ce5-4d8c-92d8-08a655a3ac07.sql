
-- 1. Add venue_staff to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'venue_staff';

-- 2. Create venue_staff table
CREATE TABLE public.venue_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, user_id)
);

ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check staff membership
CREATE OR REPLACE FUNCTION public.is_venue_staff(check_venue_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venue_staff
    WHERE venue_id = check_venue_id AND user_id = check_user_id
  )
$$;

-- Helper: check if user is staff for ANY venue owned by a given owner
CREATE OR REPLACE FUNCTION public.is_staff_of_owner(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venue_staff vs
    JOIN public.venues v ON v.id = vs.venue_id
    WHERE vs.user_id = check_user_id
  )
$$;

-- Helper: get venue_ids that a staff user has access to
CREATE OR REPLACE FUNCTION public.get_staff_venue_ids(check_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vs.venue_id FROM public.venue_staff vs WHERE vs.user_id = check_user_id
$$;

-- 4. RLS on venue_staff table
-- Court managers can manage staff for their venues
CREATE POLICY "Venue owners can manage staff"
ON public.venue_staff
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.venues v WHERE v.id = venue_staff.venue_id AND v.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.venues v WHERE v.id = venue_staff.venue_id AND v.owner_id = auth.uid()
));

-- Staff can view their own rows
CREATE POLICY "Staff can view own membership"
ON public.venue_staff
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. RLS policies on existing tables for staff access

-- venues: staff can SELECT venues they're assigned to
CREATE POLICY "Staff can view assigned venues"
ON public.venues
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_staff_venue_ids(auth.uid())));

-- courts: staff can SELECT courts of their assigned venues
CREATE POLICY "Staff can view assigned venue courts"
ON public.courts
FOR SELECT
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

-- court_availability: staff can SELECT and UPDATE for their venues
CREATE POLICY "Staff can view venue availability"
ON public.court_availability
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courts c
  WHERE c.id = court_availability.court_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

CREATE POLICY "Staff can update venue availability"
ON public.court_availability
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courts c
  WHERE c.id = court_availability.court_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

CREATE POLICY "Staff can create venue availability"
ON public.court_availability
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.courts c
  WHERE c.id = court_availability.court_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

CREATE POLICY "Staff can delete venue availability"
ON public.court_availability
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courts c
  WHERE c.id = court_availability.court_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

-- venue_weekly_rules: staff can manage
CREATE POLICY "Staff can view venue weekly rules"
ON public.venue_weekly_rules
FOR SELECT
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can update venue weekly rules"
ON public.venue_weekly_rules
FOR UPDATE
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can create venue weekly rules"
ON public.venue_weekly_rules
FOR INSERT
TO authenticated
WITH CHECK (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can delete venue weekly rules"
ON public.venue_weekly_rules
FOR DELETE
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

-- venue_date_overrides: staff can manage
CREATE POLICY "Staff can view venue date overrides"
ON public.venue_date_overrides
FOR SELECT
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can update venue date overrides"
ON public.venue_date_overrides
FOR UPDATE
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can create venue date overrides"
ON public.venue_date_overrides
FOR INSERT
TO authenticated
WITH CHECK (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can delete venue date overrides"
ON public.venue_date_overrides
FOR DELETE
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

-- equipment_inventory: staff can manage
CREATE POLICY "Staff can view venue equipment"
ON public.equipment_inventory
FOR SELECT
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

CREATE POLICY "Staff can manage venue equipment"
ON public.equipment_inventory
FOR ALL
TO authenticated
USING (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())))
WITH CHECK (venue_id IN (SELECT public.get_staff_venue_ids(auth.uid())));

-- booking_holds: staff can view holds on their venue courts
CREATE POLICY "Staff can view venue booking holds"
ON public.booking_holds
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courts c
  WHERE c.id = booking_holds.court_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

-- profiles: staff can view booker profiles for their venues
CREATE POLICY "Staff can view venue booker profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.court_availability ca
  JOIN public.courts c ON c.id = ca.court_id
  WHERE ca.booked_by_user_id = profiles.user_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));

-- payments: staff can view venue payments
CREATE POLICY "Staff can view venue payments"
ON public.payments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sessions s
  JOIN public.courts c ON c.id = s.court_id
  WHERE s.id = payments.session_id
  AND c.venue_id IN (SELECT public.get_staff_venue_ids(auth.uid()))
));
