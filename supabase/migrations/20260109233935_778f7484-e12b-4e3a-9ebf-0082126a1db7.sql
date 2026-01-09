-- Add venue configuration fields for slot-based scheduling
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_booking_minutes integer NOT NULL DEFAULT 120;

-- Create venue_weekly_rules table for recurring availability
CREATE TABLE public.venue_weekly_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time OR is_closed = true),
  CONSTRAINT unique_venue_day UNIQUE (venue_id, day_of_week)
);

-- Create venue_date_overrides table for exceptions
CREATE TABLE public.venue_date_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  is_closed boolean NOT NULL DEFAULT false,
  custom_start_time time without time zone,
  custom_end_time time without time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR start_date <= end_date),
  CONSTRAINT valid_custom_time_range CHECK (
    (custom_start_time IS NULL AND custom_end_time IS NULL) OR
    (custom_start_time IS NOT NULL AND custom_end_time IS NOT NULL AND custom_start_time < custom_end_time)
  )
);

-- Enable RLS on new tables
ALTER TABLE public.venue_weekly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_date_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for venue_weekly_rules
CREATE POLICY "Weekly rules viewable by everyone" 
ON public.venue_weekly_rules 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_weekly_rules.venue_id AND v.is_active = true
));

CREATE POLICY "Venue owners can create weekly rules" 
ON public.venue_weekly_rules 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_weekly_rules.venue_id AND v.owner_id = auth.uid()
));

CREATE POLICY "Venue owners can update weekly rules" 
ON public.venue_weekly_rules 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_weekly_rules.venue_id AND v.owner_id = auth.uid()
));

CREATE POLICY "Venue owners can delete weekly rules" 
ON public.venue_weekly_rules 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_weekly_rules.venue_id AND v.owner_id = auth.uid()
));

-- RLS policies for venue_date_overrides
CREATE POLICY "Date overrides viewable by everyone" 
ON public.venue_date_overrides 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_date_overrides.venue_id AND v.is_active = true
));

CREATE POLICY "Venue owners can create date overrides" 
ON public.venue_date_overrides 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_date_overrides.venue_id AND v.owner_id = auth.uid()
));

CREATE POLICY "Venue owners can update date overrides" 
ON public.venue_date_overrides 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_date_overrides.venue_id AND v.owner_id = auth.uid()
));

CREATE POLICY "Venue owners can delete date overrides" 
ON public.venue_date_overrides 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.venues v 
  WHERE v.id = venue_date_overrides.venue_id AND v.owner_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_venue_weekly_rules_updated_at
BEFORE UPDATE ON public.venue_weekly_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_venue_date_overrides_updated_at
BEFORE UPDATE ON public.venue_date_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying
CREATE INDEX idx_venue_weekly_rules_venue_day ON public.venue_weekly_rules(venue_id, day_of_week);
CREATE INDEX idx_venue_date_overrides_venue_dates ON public.venue_date_overrides(venue_id, start_date, end_date);
CREATE INDEX idx_court_availability_booking ON public.court_availability(court_id, available_date, start_time, end_time) WHERE is_booked = true;