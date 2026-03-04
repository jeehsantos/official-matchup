
-- Step 1: Backfill is_multi_court for any court that already has children
UPDATE public.courts
SET is_multi_court = true
WHERE id IN (
  SELECT DISTINCT parent_court_id
  FROM public.courts
  WHERE parent_court_id IS NOT NULL
)
AND (is_multi_court IS NULL OR is_multi_court = false);

-- Step 2: Create validation trigger for courts table
CREATE OR REPLACE FUNCTION public.enforce_court_multi_court_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Rule 1: child cannot reference itself
  IF NEW.parent_court_id IS NOT NULL AND NEW.parent_court_id = NEW.id THEN
    RAISE EXCEPTION 'A court cannot be its own parent';
  END IF;

  -- Rule 2: child parent must be in same venue
  IF NEW.parent_court_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.courts
      WHERE id = NEW.parent_court_id AND venue_id = NEW.venue_id
    ) THEN
      RAISE EXCEPTION 'Parent court must be in the same venue';
    END IF;
  END IF;

  -- Rule 3: when child is inserted/updated with parent_court_id, auto-promote parent
  IF NEW.parent_court_id IS NOT NULL THEN
    UPDATE public.courts
    SET is_multi_court = true
    WHERE id = NEW.parent_court_id
      AND (is_multi_court IS NULL OR is_multi_court = false);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_court_integrity
BEFORE INSERT OR UPDATE ON public.courts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_court_multi_court_integrity();

-- Step 3: Prevent setting is_multi_court=false while children exist
CREATE OR REPLACE FUNCTION public.prevent_multi_court_disable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only check when is_multi_court is being set to false (from true)
  IF (OLD.is_multi_court = true) AND (NEW.is_multi_court IS DISTINCT FROM true) THEN
    IF EXISTS (
      SELECT 1 FROM public.courts WHERE parent_court_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot disable multi-court while sub-courts exist. Delete sub-courts first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_multi_court_disable
BEFORE UPDATE ON public.courts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_multi_court_disable();
