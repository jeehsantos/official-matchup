-- Court availability table for managers to publish available slots
CREATE TABLE public.court_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  booked_by_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  booked_by_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(court_id, available_date, start_time)
);

-- Enable RLS
ALTER TABLE public.court_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for court_availability
CREATE POLICY "Available slots viewable by everyone"
ON public.court_availability
FOR SELECT
USING (true);

CREATE POLICY "Court managers can create availability"
ON public.court_availability
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_availability.court_id
    AND v.owner_id = auth.uid()
  )
);

CREATE POLICY "Court managers can update availability"
ON public.court_availability
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_availability.court_id
    AND v.owner_id = auth.uid()
  )
);

CREATE POLICY "Court managers can delete availability"
ON public.court_availability
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_availability.court_id
    AND v.owner_id = auth.uid()
  )
);

-- Contact messages table
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit contact messages
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at on court_availability
CREATE TRIGGER update_court_availability_updated_at
BEFORE UPDATE ON public.court_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();