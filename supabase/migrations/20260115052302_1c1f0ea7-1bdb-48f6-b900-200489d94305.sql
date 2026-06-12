-- Add helper function to read app role from JWT user_metadata
CREATE OR REPLACE FUNCTION public.jwt_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role');
$$;

-- PRODUCTS: allow gate users (by JWT role) to create products in their office
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Gate can create products (jwt role)'
  ) THEN
    CREATE POLICY "Gate can create products (jwt role)"
    ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.jwt_user_role() = 'gate'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;
END $$;

-- GATE PASSES: allow store users (by JWT role) to create gate passes in their office
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gate_passes'
      AND policyname = 'Store can create gate passes (jwt role)'
  ) THEN
    CREATE POLICY "Store can create gate passes (jwt role)"
    ON public.gate_passes
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.jwt_user_role() = 'store'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;
END $$;

-- GATE PASSES: allow department users (by JWT role) to create gate passes in their office
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gate_passes'
      AND policyname = 'Dept can create gate passes (jwt role)'
  ) THEN
    CREATE POLICY "Dept can create gate passes (jwt role)"
    ON public.gate_passes
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.jwt_user_role() = 'department'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;
END $$;

-- GATE PASSES: allow gate/store/department users (by JWT role) to update gate passes in their office
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gate_passes'
      AND policyname = 'Gate can update gate passes (jwt role)'
  ) THEN
    CREATE POLICY "Gate can update gate passes (jwt role)"
    ON public.gate_passes
    FOR UPDATE
    TO authenticated
    USING (
      public.jwt_user_role() = 'gate'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gate_passes'
      AND policyname = 'Store can update gate passes (jwt role)'
  ) THEN
    CREATE POLICY "Store can update gate passes (jwt role)"
    ON public.gate_passes
    FOR UPDATE
    TO authenticated
    USING (
      public.jwt_user_role() = 'store'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gate_passes'
      AND policyname = 'Dept can update gate passes (jwt role)'
  ) THEN
    CREATE POLICY "Dept can update gate passes (jwt role)"
    ON public.gate_passes
    FOR UPDATE
    TO authenticated
    USING (
      public.jwt_user_role() = 'department'
      AND office_id = public.get_user_office_id(auth.uid())
    );
  END IF;
END $$;
