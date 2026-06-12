-- Fix the security issue: set search_path for jwt_user_role function
CREATE OR REPLACE FUNCTION public.jwt_user_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role');
$$;
