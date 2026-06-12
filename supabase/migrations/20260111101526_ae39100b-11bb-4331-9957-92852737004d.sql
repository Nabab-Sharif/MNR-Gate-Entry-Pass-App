-- Allow initial bootstrap for the allowlisted admin account to self-assign the admin role.
-- This avoids the chicken/egg problem where the user needs the admin role to manage roles.
-- Restricts to the single allowlisted email used by the Admin ID login flow.

CREATE POLICY "Bootstrap allowlisted admin can self-assign admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::public.app_role
  AND (current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'admin_01838047391@mnrgroup.com'
);
