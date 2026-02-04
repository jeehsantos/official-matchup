-- Add policy to allow creators to view their own challenges regardless of status
CREATE POLICY "Creators can view own challenges"
ON public.quick_challenges
FOR SELECT
USING (auth.uid() = created_by);

-- Add policy to allow creators to delete their own challenges
CREATE POLICY "Creators can delete own challenges"
ON public.quick_challenges
FOR DELETE
USING (auth.uid() = created_by);