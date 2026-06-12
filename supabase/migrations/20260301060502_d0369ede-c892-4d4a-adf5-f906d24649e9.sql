
-- Allow gate users to delete products they created in their office
CREATE POLICY "Gate can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  office_id = get_user_office_id(auth.uid())
  AND (has_role(auth.uid(), 'gate'::app_role) OR jwt_user_role() = 'gate')
);
