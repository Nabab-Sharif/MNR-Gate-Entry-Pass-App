
-- Drop the old type check constraint that blocks 'product' and 'gate_pass' types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add RLS policy for users to delete their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications"
      ON public.notifications FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
