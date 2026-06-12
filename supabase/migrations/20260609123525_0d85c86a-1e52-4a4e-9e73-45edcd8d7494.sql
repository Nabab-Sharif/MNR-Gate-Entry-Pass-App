CREATE POLICY "Sub admins can view all notifications"
ON public.notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'sub_admin'::public.app_role));