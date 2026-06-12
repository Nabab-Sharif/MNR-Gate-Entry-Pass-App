-- Fix RLS policy for gate_passes - allow department to create gate passes
DROP POLICY IF EXISTS "Store can create gate passes" ON public.gate_passes;
DROP POLICY IF EXISTS "Dept can create gate passes" ON public.gate_passes;

CREATE POLICY "Store can create gate passes" 
ON public.gate_passes 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'store'::app_role) AND 
  office_id = get_user_office_id(auth.uid())
);

CREATE POLICY "Dept can create gate passes" 
ON public.gate_passes 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'department'::app_role) AND 
  office_id = get_user_office_id(auth.uid())
);

-- Allow store and department to update gate passes in their office
DROP POLICY IF EXISTS "Store can update gate passes" ON public.gate_passes;
DROP POLICY IF EXISTS "Dept can update gate passes" ON public.gate_passes;

CREATE POLICY "Store can update gate passes" 
ON public.gate_passes 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'store'::app_role) AND 
  office_id = get_user_office_id(auth.uid())
);

CREATE POLICY "Dept can update gate passes" 
ON public.gate_passes 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'department'::app_role) AND 
  office_id = get_user_office_id(auth.uid())
);

-- Make the get_user_office_id function also check user metadata as fallback
CREATE OR REPLACE FUNCTION public.get_user_office_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  office_id_result uuid;
  user_meta jsonb;
BEGIN
  -- First try to get from gates
  SELECT office_id INTO office_id_result FROM public.gates WHERE user_id = _user_id LIMIT 1;
  IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
  
  -- Then try stores
  SELECT office_id INTO office_id_result FROM public.stores WHERE user_id = _user_id LIMIT 1;
  IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
  
  -- Then try departments
  SELECT office_id INTO office_id_result FROM public.departments WHERE user_id = _user_id LIMIT 1;
  IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
  
  -- Fallback: try to get from user metadata via entity_id
  SELECT raw_user_meta_data INTO user_meta FROM auth.users WHERE id = _user_id;
  IF user_meta IS NOT NULL AND user_meta->>'office_id' IS NOT NULL THEN
    RETURN (user_meta->>'office_id')::uuid;
  END IF;
  
  -- If entity_id is set, try to get office_id from that entity
  IF user_meta IS NOT NULL AND user_meta->>'entity_id' IS NOT NULL THEN
    -- Try gate
    SELECT office_id INTO office_id_result FROM public.gates WHERE id = (user_meta->>'entity_id')::uuid LIMIT 1;
    IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
    
    -- Try store
    SELECT office_id INTO office_id_result FROM public.stores WHERE id = (user_meta->>'entity_id')::uuid LIMIT 1;
    IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
    
    -- Try department
    SELECT office_id INTO office_id_result FROM public.departments WHERE id = (user_meta->>'entity_id')::uuid LIMIT 1;
    IF office_id_result IS NOT NULL THEN RETURN office_id_result; END IF;
  END IF;
  
  RETURN NULL;
END;
$function$;