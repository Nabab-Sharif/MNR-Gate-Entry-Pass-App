-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'gate', 'store', 'department');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create offices table
CREATE TABLE public.offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- Create gates table
CREATE TABLE public.gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    gate_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;

-- Create stores table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    store_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create departments table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    department_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create products table (gate entries)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    gate_id UUID REFERENCES public.gates(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    image_url TEXT,
    phone TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'entered' CHECK (status IN ('entered', 'viewed', 'in_store', 'received')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create gate_passes table
CREATE TABLE public.gate_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    purpose TEXT CHECK (purpose IN ('return', 'transfer', 'repair', 'delivery')),
    expected_date DATE,
    remarks TEXT,
    attachment_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;

-- Create messages table for chat
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    gate_pass_id UUID REFERENCES public.gate_passes(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    sender_role app_role NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read BOOLEAN DEFAULT false,
    related_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    related_gate_pass_id UUID REFERENCES public.gate_passes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get user's office_id based on role
CREATE OR REPLACE FUNCTION public.get_user_office_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT office_id FROM public.gates WHERE user_id = _user_id LIMIT 1),
        (SELECT office_id FROM public.stores WHERE user_id = _user_id LIMIT 1),
        (SELECT office_id FROM public.departments WHERE user_id = _user_id LIMIT 1)
    )
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gates_updated_at BEFORE UPDATE ON public.gates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gate_passes_updated_at BEFORE UPDATE ON public.gate_passes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- User roles: users can view their own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: users can view/update their own, admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Offices: admins can manage, others can view their assigned office
CREATE POLICY "Admins can manage offices" ON public.offices FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their office" ON public.offices FOR SELECT USING (
    id = public.get_user_office_id(auth.uid()) OR public.has_role(auth.uid(), 'admin')
);

-- Gates: admins can manage, gate users can view their own
CREATE POLICY "Admins can manage gates" ON public.gates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gate users can view own gate" ON public.gates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view gates in their office" ON public.gates FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid())
);

-- Stores: admins can manage, store users can view their own
CREATE POLICY "Admins can manage stores" ON public.stores FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Store users can view own store" ON public.stores FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view stores in their office" ON public.stores FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid())
);

-- Departments: admins can manage, department users can view their own
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Dept users can view own dept" ON public.departments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view depts in their office" ON public.departments FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid())
);

-- Products: office-scoped access
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gate can create products" ON public.products FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'gate') AND office_id = public.get_user_office_id(auth.uid())
);
CREATE POLICY "Users can view products in their office" ON public.products FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users can update products in their office" ON public.products FOR UPDATE USING (
    office_id = public.get_user_office_id(auth.uid())
);

-- Gate passes: office-scoped access
CREATE POLICY "Admins can manage gate passes" ON public.gate_passes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Store can create gate passes" ON public.gate_passes FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'store') AND office_id = public.get_user_office_id(auth.uid())
);
CREATE POLICY "Users can view gate passes in their office" ON public.gate_passes FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Gate can update gate passes" ON public.gate_passes FOR UPDATE USING (
    public.has_role(auth.uid(), 'gate') AND office_id = public.get_user_office_id(auth.uid())
);

-- Messages: office-scoped access
CREATE POLICY "Users can view messages in their office" ON public.messages FOR SELECT USING (
    office_id = public.get_user_office_id(auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users can send messages in their office" ON public.messages FOR INSERT WITH CHECK (
    office_id = public.get_user_office_id(auth.uid()) AND sender_id = auth.uid()
);

-- Notifications: users can only view their own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_passes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;