CREATE INDEX IF NOT EXISTS idx_products_gate_created_at ON public.products (gate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_store_created_at ON public.products (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_department_created_at ON public.products (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);

CREATE INDEX IF NOT EXISTS idx_gate_passes_gate_created_at ON public.gate_passes (gate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_passes_store_created_at ON public.gate_passes (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_passes_department_created_at ON public.gate_passes (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status ON public.gate_passes (status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_gates_user_id ON public.gates (user_id);
CREATE INDEX IF NOT EXISTS idx_gates_office_status ON public.gates (office_id, status);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores (user_id);
CREATE INDEX IF NOT EXISTS idx_stores_office_status ON public.stores (office_id, status);
CREATE INDEX IF NOT EXISTS idx_departments_user_id ON public.departments (user_id);
CREATE INDEX IF NOT EXISTS idx_departments_office_status ON public.departments (office_id, status);

CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON public.product_items (product_id);
CREATE INDEX IF NOT EXISTS idx_gate_pass_items_gate_pass_id ON public.gate_pass_items (gate_pass_id);
CREATE INDEX IF NOT EXISTS idx_product_timeline_product_id_created_at ON public.product_timeline (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_pass_timeline_gate_pass_id_created_at ON public.gate_pass_timeline (gate_pass_id, created_at DESC);