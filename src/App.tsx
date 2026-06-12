import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { preloadRoleData } from "@/lib/appPreload";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";

// Pages
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import OfficesPage from "./pages/admin/OfficesPage";
import OfficeDashboard from "./pages/admin/OfficeDashboard";
import AllGatesPage from "./pages/admin/AllGatesPage";
import AllStoresPage from "./pages/admin/AllStoresPage";
import AllDepartmentsPage from "./pages/admin/AllDepartmentsPage";
import AdminGateDataPage from "./pages/admin/AdminGateDataPage";
import AdminStoreDataPage from "./pages/admin/AdminStoreDataPage";
import AdminDepartmentDataPage from "./pages/admin/AdminDepartmentDataPage";
import SettingsPage from "./pages/admin/SettingsPage";
import GatePage from "./pages/GatePage";
import StorePage from "./pages/StorePage";
import DepartmentPage from "./pages/DepartmentPage";
import DepartmentDetailsPage from "./pages/DepartmentDetailsPage";
import SubAdminLayout from "./components/layout/SubAdminLayout";
import SubAdminDashboard from "./pages/subadmin/SubAdminDashboard";
import SubAdminOfficeDetails from "./pages/subadmin/SubAdminOfficeDetails";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type UserRole = 'admin' | 'sub_admin' | 'gate' | 'store' | 'department';

interface ProtectedRouteProps {
  children: React.ReactNode;
  session: Session | null;
  allowedRole?: UserRole;
  userRole?: UserRole | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  session, 
  allowedRole, 
  userRole 
}) => {
  if (!session) {
    return <Navigate to="/" replace />;
  }
  
  // If a specific role is required, check it
  if (allowedRole && userRole !== allowedRole) {
    // Redirect to the correct page based on user's role
    const targetPath = userRole === 'admin' ? '/admin' : userRole ? `/${userRole}` : '/';
    return <Navigate to={targetPath} replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  useSessionHeartbeat(session?.user?.id ?? null);

  useEffect(() => {
    let cancelled = false;

    const applySession = (currentSession: Session | null) => {
      if (cancelled) return;
      setSession(currentSession);
      if (currentSession?.user) {
        const immediateRole =
          (currentSession.user.user_metadata?.role as UserRole) || null;
        setUserRole(immediateRole);
        setLoading(false);
        // Background: confirm role from DB + warm cache, no UI blocking.
        void verifyRoleAndPreload(currentSession);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const verifyRoleAndPreload = async (currentSession: Session) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();

      const role =
        (data?.role as UserRole) ||
        (currentSession.user.user_metadata?.role as UserRole) ||
        null;
      setUserRole((prev) => (prev === role ? prev : role));
      void preloadRoleData(currentSession.user, role);
    } catch (error) {
      console.error('Error verifying user role:', error);
      const fallbackRole =
        (currentSession.user.user_metadata?.role as UserRole) || null;
      void preloadRoleData(currentSession.user, fallbackRole);
    }
  };

  const getRedirectPath = () => {
    if (!session) return '/';
    switch (userRole) {
      case 'admin': return '/admin';
      case 'sub_admin': return '/sub-admin';
      case 'gate': return '/gate';
      case 'store': return '/store';
      case 'department': return '/department';
      default: return '/';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Staff Login Page */}
      <Route 
        path="/" 
        element={session ? <Navigate to={getRedirectPath()} replace /> : <LoginPage />} 
      />

      <Route path="/admin/login" element={<Navigate to="/" replace />} />

      {/* Admin Routes */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute session={session} allowedRole="admin" userRole={userRole}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="offices" element={<OfficesPage />} />
        <Route path="offices/:officeId" element={<OfficeDashboard />} />
        <Route path="gates" element={<AllGatesPage />} />
        <Route path="gates/:gateId" element={<AdminGateDataPage />} />
        <Route path="stores" element={<AllStoresPage />} />
        <Route path="stores/:storeId" element={<AdminStoreDataPage />} />
        <Route path="departments" element={<AllDepartmentsPage />} />
        <Route path="departments/:departmentId" element={<AdminDepartmentDataPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Sub Admin Routes */}
      <Route
        path="/sub-admin"
        element={
          <ProtectedRoute session={session} allowedRole="sub_admin" userRole={userRole}>
            <SubAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SubAdminDashboard />} />
        <Route path="offices/:officeId" element={<SubAdminOfficeDetails />} />
      </Route>

      {/* Gate Route */}
      <Route 
        path="/gate" 
        element={
          <ProtectedRoute session={session} allowedRole="gate" userRole={userRole}>
            <GatePage />
          </ProtectedRoute>
        } 
      />

      {/* Store Route */}
      <Route 
        path="/store" 
        element={
          <ProtectedRoute session={session} allowedRole="store" userRole={userRole}>
            <StorePage />
          </ProtectedRoute>
        } 
      />

      {/* Department Route */}
      <Route 
        path="/department" 
        element={
          <ProtectedRoute session={session} allowedRole="department" userRole={userRole}>
            <DepartmentPage />
          </ProtectedRoute>
        } 
      />

      {/* Department Details Route (accessible from gate page) */}
      <Route 
        path="/department-details/:departmentId" 
        element={
          <ProtectedRoute session={session}>
            <DepartmentDetailsPage />
          </ProtectedRoute>
        } 
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;