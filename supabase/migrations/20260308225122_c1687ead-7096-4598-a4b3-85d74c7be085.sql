
ALTER TABLE public.venues ADD COLUMN slug text UNIQUE;
CREATE INDEX idx_venues_slug ON public.venues(slug);

CREATE POLICY "Admins can update venues" ON public.venues
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
