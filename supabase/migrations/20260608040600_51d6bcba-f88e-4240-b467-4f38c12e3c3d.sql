
-- sub_admins table
CREATE TABLE IF NOT EXISTS public.sub_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_id text NOT NULL UNIQUE,
  user_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_admins TO authenticated;
GRANT ALL ON public.sub_admins TO service_role;
GRANT SELECT ON public.sub_admins TO anon;

ALTER TABLE public.sub_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sub admins"
  ON public.sub_admins FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active sub admins for login"
  ON public.sub_admins FOR SELECT
  USING (status = 'active');

CREATE POLICY "Sub admin can view own row"
  ON public.sub_admins FOR SELECT
  USING (user_id = auth.uid());

CREATE TRIGGER update_sub_admins_updated_at
  BEFORE UPDATE ON public.sub_admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Read-only SELECT policies for sub_admin across data tables
CREATE POLICY "Sub admins can view all products"
  ON public.products FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all gate passes"
  ON public.gate_passes FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all product items"
  ON public.product_items FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all gate pass items"
  ON public.gate_pass_items FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all product timeline"
  ON public.product_timeline FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all gate pass timeline"
  ON public.gate_pass_timeline FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all offices"
  ON public.offices FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all gates"
  ON public.gates FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all stores"
  ON public.stores FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all departments"
  ON public.departments FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all login sessions"
  ON public.login_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

-- Chat access for sub_admin
CREATE POLICY "Sub admins can view all messages"
  ON public.messages FOR SELECT
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Sub admins can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'sub_admin'::app_role) AND sender_id = auth.uid());

CREATE POLICY "Sub admins can mark messages read"
  ON public.messages FOR UPDATE
  USING (public.has_role(auth.uid(), 'sub_admin'::app_role) AND sender_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'sub_admin'::app_role));
