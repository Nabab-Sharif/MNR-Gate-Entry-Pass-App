-- Expand allowed product statuses to match UI workflow
DO $$
BEGIN
  -- Drop old constraint if it exists (definition currently too restrictive)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'products'
      AND c.conname = 'products_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.products DROP CONSTRAINT products_status_check';
  END IF;
END $$;

ALTER TABLE public.products
ADD CONSTRAINT products_status_check
CHECK (
  status IS NULL OR status = ANY (
    ARRAY[
      'entered',
      'on_the_way_store',
      'in_store',
      'stock_in_store',
      'on_the_way_dept',
      'received',
      -- legacy + UI label compatibility
      'viewed',
      'know_about',
      -- optional statuses used by action buttons/badges
      'gate_in',
      'gate_out'
    ]
  )
);