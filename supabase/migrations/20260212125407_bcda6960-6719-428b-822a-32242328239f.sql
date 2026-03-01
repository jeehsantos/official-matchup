
-- Add allowed_sports column to courts table
ALTER TABLE public.courts ADD COLUMN allowed_sports text[] DEFAULT '{}'::text[];

-- Migrate data: copy allowed_sports from venues to their parent courts
UPDATE public.courts c
SET allowed_sports = v.allowed_sports
FROM public.venues v
WHERE c.venue_id = v.id
  AND c.parent_court_id IS NULL
  AND v.allowed_sports IS NOT NULL
  AND array_length(v.allowed_sports, 1) > 0;

-- Also set the court's own sport_type as an allowed sport if not already present
UPDATE public.courts
SET allowed_sports = CASE 
  WHEN allowed_sports IS NULL OR array_length(allowed_sports, 1) IS NULL 
    THEN ARRAY[sport_type::text]
  WHEN NOT (sport_type::text = ANY(allowed_sports))
    THEN array_append(allowed_sports, sport_type::text)
  ELSE allowed_sports
END;

-- Drop allowed_sports from venues table
ALTER TABLE public.venues DROP COLUMN allowed_sports;
