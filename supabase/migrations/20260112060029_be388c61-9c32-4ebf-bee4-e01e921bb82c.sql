-- Add sender_name and receiver_name to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS receiver_name text;

-- Add sender_name and receiver_name to gate_passes table
ALTER TABLE public.gate_passes
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS receiver_name text;

-- Create product_timeline table for product flow tracking
CREATE TABLE IF NOT EXISTS public.product_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  action_by UUID,
  action_by_name TEXT,
  action_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on product_timeline
ALTER TABLE public.product_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_timeline
CREATE POLICY "Users can view timeline in their office"
ON public.product_timeline
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_timeline.product_id
    AND (p.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Authenticated users can insert timeline"
ON public.product_timeline
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for product_timeline
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_timeline;