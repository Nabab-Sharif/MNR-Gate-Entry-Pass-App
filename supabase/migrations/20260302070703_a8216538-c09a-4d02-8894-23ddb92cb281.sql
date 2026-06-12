
-- Allow store users to delete gate passes they created
CREATE POLICY "Store can delete own gate passes"
ON public.gate_passes
FOR DELETE
USING (
  (has_role(auth.uid(), 'store'::app_role) OR jwt_user_role() = 'store')
  AND office_id = get_user_office_id(auth.uid())
  AND created_by = auth.uid()
);

-- Allow department users to delete gate passes they created
CREATE POLICY "Dept can delete own gate passes"
ON public.gate_passes
FOR DELETE
USING (
  (has_role(auth.uid(), 'department'::app_role) OR jwt_user_role() = 'department')
  AND office_id = get_user_office_id(auth.uid())
  AND created_by = auth.uid()
);

-- Allow deletion of gate_pass_timeline entries when deleting gate passes
CREATE POLICY "Users can delete timeline for their gate passes"
ON public.gate_pass_timeline
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM gate_passes gp
    WHERE gp.id = gate_pass_timeline.gate_pass_id
    AND (
      gp.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);
