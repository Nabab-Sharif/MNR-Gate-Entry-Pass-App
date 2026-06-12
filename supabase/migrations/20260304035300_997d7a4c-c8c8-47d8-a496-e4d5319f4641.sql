
-- Add store_id to products table (nullable FK to stores)
ALTER TABLE public.products ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- Add gate_id to gate_passes table (nullable FK to gates)
ALTER TABLE public.gate_passes ADD COLUMN gate_id uuid REFERENCES public.gates(id);
