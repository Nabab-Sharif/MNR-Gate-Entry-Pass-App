-- Allow public read access to active offices for login page dropdown
CREATE POLICY "Anyone can view active offices"
ON public.offices
FOR SELECT
TO public
USING (status = 'active');

-- Allow public read access to active gates for login verification
CREATE POLICY "Anyone can view active gates"
ON public.gates
FOR SELECT
TO public
USING (status = 'active');

-- Allow public read access to active stores for login verification
CREATE POLICY "Anyone can view active stores"
ON public.stores
FOR SELECT
TO public
USING (status = 'active');

-- Allow public read access to active departments for login verification
CREATE POLICY "Anyone can view active departments"
ON public.departments
FOR SELECT
TO public
USING (status = 'active');
