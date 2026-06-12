-- Drop the old status check constraint
ALTER TABLE public.gate_passes DROP CONSTRAINT IF EXISTS gate_passes_status_check;

-- Add new constraint with all statuses for gate pass flow
ALTER TABLE public.gate_passes ADD CONSTRAINT gate_passes_status_check 
CHECK (status IN (
  'pending', 'approved', 'rejected',
  'created', 'store_check', 'ready_gate_pass', 
  'on_the_way_gate', 'gate_received', 'gate_in', 'gate_out',
  'on_the_way_store', 'store_received', 
  'on_the_way_dept', 'dept_received'
));