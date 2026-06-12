
-- product_items table for multiple products per gate entry
CREATE TABLE public.product_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;

-- gate_pass_items table for multiple products per gate pass
CREATE TABLE public.gate_pass_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_pass_id uuid NOT NULL REFERENCES public.gate_passes(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gate_pass_items ENABLE ROW LEVEL SECURITY;

-- Add sender_company and receiver_company to both tables
ALTER TABLE public.products ADD COLUMN sender_company text;
ALTER TABLE public.products ADD COLUMN receiver_company text;
ALTER TABLE public.gate_passes ADD COLUMN sender_company text;
ALTER TABLE public.gate_passes ADD COLUMN receiver_company text;

-- RLS for product_items
CREATE POLICY "Users can view product items in their office" ON public.product_items
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_items.product_id 
    AND (p.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
);
CREATE POLICY "Authenticated can insert product items" ON public.product_items
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update product items in their office" ON public.product_items
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_items.product_id 
    AND p.office_id = get_user_office_id(auth.uid()))
);
CREATE POLICY "Users can delete product items in their office" ON public.product_items
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_items.product_id 
    AND (p.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
);
CREATE POLICY "Admins can manage product items" ON public.product_items
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for gate_pass_items
CREATE POLICY "Users can view gate pass items in their office" ON public.gate_pass_items
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.gate_passes gp WHERE gp.id = gate_pass_items.gate_pass_id 
    AND (gp.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
);
CREATE POLICY "Authenticated can insert gate pass items" ON public.gate_pass_items
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update gate pass items in their office" ON public.gate_pass_items
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.gate_passes gp WHERE gp.id = gate_pass_items.gate_pass_id 
    AND gp.office_id = get_user_office_id(auth.uid()))
);
CREATE POLICY "Users can delete gate pass items in their office" ON public.gate_pass_items
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.gate_passes gp WHERE gp.id = gate_pass_items.gate_pass_id 
    AND (gp.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
);
CREATE POLICY "Admins can manage gate pass items" ON public.gate_pass_items
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
