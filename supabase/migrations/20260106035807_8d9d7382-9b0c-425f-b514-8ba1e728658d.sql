-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Create storage policy for authenticated users to upload
CREATE POLICY "Anyone can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Users can update their own uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');
CREATE POLICY "Users can delete their own uploads" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');

-- Create login_sessions table to track who logged in when and from where
CREATE TABLE public.login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    device_name TEXT,
    browser TEXT,
    ip_address TEXT,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    logout_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view all login sessions
CREATE POLICY "Admins can view all sessions" ON public.login_sessions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own sessions" ON public.login_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Anyone can create sessions" ON public.login_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own sessions" ON public.login_sessions FOR UPDATE USING (user_id = auth.uid());

-- Add email to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;