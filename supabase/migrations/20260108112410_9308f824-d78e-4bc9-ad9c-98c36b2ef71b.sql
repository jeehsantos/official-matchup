-- Address linter warning: avoid overly-permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;

CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
WITH CHECK (
  name IS NOT NULL AND btrim(name) <> ''
  AND email IS NOT NULL AND btrim(email) <> ''
  AND subject IS NOT NULL AND btrim(subject) <> ''
  AND message IS NOT NULL AND btrim(message) <> ''
);
