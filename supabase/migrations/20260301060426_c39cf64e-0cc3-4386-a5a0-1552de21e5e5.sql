
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.gates ADD COLUMN IF NOT EXISTS whatsapp_number text;
