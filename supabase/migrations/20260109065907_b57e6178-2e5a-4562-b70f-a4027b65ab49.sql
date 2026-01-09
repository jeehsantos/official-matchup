-- Add template_id column to court_availability for bulk deletion support
ALTER TABLE public.court_availability 
ADD COLUMN IF NOT EXISTS template_id uuid;

-- Add index for efficient bulk operations
CREATE INDEX IF NOT EXISTS idx_court_availability_template_id 
ON public.court_availability(template_id) 
WHERE template_id IS NOT NULL;