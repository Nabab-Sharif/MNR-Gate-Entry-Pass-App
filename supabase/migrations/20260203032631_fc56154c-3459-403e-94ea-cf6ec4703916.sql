-- Enable realtime for tables
DO $$
DECLARE
  pub_oid oid;
BEGIN
  SELECT oid INTO pub_oid FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF pub_oid IS NULL THEN
    RAISE NOTICE 'Publication supabase_realtime not found; skipping.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pr.prpubid = pub_oid AND n.nspname = 'public' AND c.relname = 'products') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.products';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pr.prpubid = pub_oid AND n.nspname = 'public' AND c.relname = 'gate_passes') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_passes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pr.prpubid = pub_oid AND n.nspname = 'public' AND c.relname = 'messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pr.prpubid = pub_oid AND n.nspname = 'public' AND c.relname = 'product_timeline') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_timeline';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pr.prpubid = pub_oid AND n.nspname = 'public' AND c.relname = 'gate_pass_timeline') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_pass_timeline';
  END IF;
END $$;

-- Sender can update own messages
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;
CREATE POLICY "Senders can update own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Sender can delete own messages
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages"
ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

-- Users in same office can mark messages read (not their own)
DROP POLICY IF EXISTS "Users can mark messages read in their office" ON public.messages;
CREATE POLICY "Users can mark messages read in their office"
ON public.messages
FOR UPDATE
USING (office_id = get_user_office_id(auth.uid()) AND sender_id <> auth.uid())
WITH CHECK (office_id = get_user_office_id(auth.uid()));

-- Admins can manage messages
DROP POLICY IF EXISTS "Admins can manage messages" ON public.messages;
CREATE POLICY "Admins can manage messages"
ON public.messages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function to enforce safe message edits
CREATE OR REPLACE FUNCTION public.enforce_messages_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fnc$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.office_id <> OLD.office_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.gate_pass_id IS DISTINCT FROM OLD.gate_pass_id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.sender_role <> OLD.sender_role
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify message metadata';
  END IF;

  IF NEW.message IS DISTINCT FROM OLD.message
     AND OLD.sender_id <> auth.uid()
     AND NOT has_role(auth.uid(), 'admin'::app_role)
  THEN
    RAISE EXCEPTION 'Only sender can edit message text';
  END IF;

  IF OLD.is_read IS TRUE AND (NEW.is_read IS FALSE OR NEW.is_read IS NULL) THEN
    RAISE EXCEPTION 'Not allowed to unset read status';
  END IF;

  RETURN NEW;
END;
$fnc$;

DROP TRIGGER IF EXISTS enforce_messages_update_rules ON public.messages;
CREATE TRIGGER enforce_messages_update_rules
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_messages_update_rules();