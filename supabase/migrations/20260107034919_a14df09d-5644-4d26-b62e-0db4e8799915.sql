-- Add last_action_by and last_action_role columns to track who did what
ALTER TABLE public.gate_passes 
ADD COLUMN IF NOT EXISTS last_action_by uuid,
ADD COLUMN IF NOT EXISTS last_action_role text,
ADD COLUMN IF NOT EXISTS last_action_at timestamp with time zone DEFAULT now();

-- Add status tracking to products table too
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS last_action_by uuid,
ADD COLUMN IF NOT EXISTS last_action_role text,
ADD COLUMN IF NOT EXISTS last_action_at timestamp with time zone DEFAULT now();

-- Create gate pass timeline table for tracking all status changes
CREATE TABLE IF NOT EXISTS public.gate_pass_timeline (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_pass_id uuid NOT NULL REFERENCES public.gate_passes(id) ON DELETE CASCADE,
    status text NOT NULL,
    action_by uuid,
    action_by_name text,
    action_role text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on timeline
ALTER TABLE public.gate_pass_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies for timeline
CREATE POLICY "Users can view timeline in their office" 
ON public.gate_pass_timeline 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.gate_passes gp 
        WHERE gp.id = gate_pass_id 
        AND (gp.office_id = get_user_office_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
);

CREATE POLICY "Authenticated users can insert timeline" 
ON public.gate_pass_timeline 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for gate_pass_timeline
ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_pass_timeline;