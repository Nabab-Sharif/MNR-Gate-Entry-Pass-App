import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DoorOpen, Store, Users, Loader2, CheckCircle2, AlertCircle, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpg';
import { preloadRoleData } from '@/lib/appPreload';

type UserRole = 'admin' | 'sub_admin' | 'gate' | 'store' | 'department';
type EntityTable = 'admin' | 'sub_admin' | 'gates' | 'stores' | 'departments';

interface EntityInfo {
  id: string;
  name: string;
  code: string;
  office_id?: string;
  office_name?: string;
  role: UserRole;
  table: EntityTable;
}

const ADMIN_ID = '01838047391';
const sanitizeLoginId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const getAuthPassword = (value: string) => `mnr-access-${sanitizeLoginId(value)}-2026`;

const LoginPage: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [entityInfo, setEntityInfo] = useState<EntityInfo | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const trimmedId = loginId.trim();

    if (!trimmedId) {
      setEntityInfo(null);
      setVerified(false);
      setVerifying(false);
      return;
    }

    if (trimmedId === ADMIN_ID) {
      setEntityInfo({
        id: ADMIN_ID,
        name: 'Administrator',
        code: ADMIN_ID,
        role: 'admin',
        table: 'admin',
      });
      setVerified(true);
      setVerifying(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setVerifying(true);
      setVerified(false);
      setEntityInfo(null);

      try {
        const [gateRes, storeRes, deptRes, subRes] = await Promise.all([
          supabase
            .from('gates')
            .select('id, name, gate_code, office_id, offices(name)')
            .ilike('gate_code', trimmedId)
            .eq('status', 'active'),
          supabase
            .from('stores')
            .select('id, name, store_code, office_id, offices(name)')
            .ilike('store_code', trimmedId)
            .eq('status', 'active'),
          supabase
            .from('departments')
            .select('id, name, department_code, office_id, offices(name)')
            .ilike('department_code', trimmedId)
            .eq('status', 'active'),
          supabase
            .from('sub_admins')
            .select('id, name, access_id')
            .ilike('access_id', trimmedId)
            .eq('status', 'active'),
        ]);

        const matches: EntityInfo[] = [
          ...(gateRes.data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.gate_code,
            office_id: item.office_id,
            office_name: item.offices?.name,
            role: 'gate' as const,
            table: 'gates' as const,
          })),
          ...(storeRes.data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.store_code,
            office_id: item.office_id,
            office_name: item.offices?.name,
            role: 'store' as const,
            table: 'stores' as const,
          })),
          ...(deptRes.data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.department_code,
            office_id: item.office_id,
            office_name: item.offices?.name,
            role: 'department' as const,
            table: 'departments' as const,
          })),
          ...(subRes.data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.access_id,
            role: 'sub_admin' as const,
            table: 'sub_admin' as const,
          })),
        ];

        if (matches.length === 1) {
          setEntityInfo(matches[0]);
          setVerified(true);
          return;
        }

        if (matches.length > 1) {
          toast.error('Same ID multiple places found. Please contact admin.');
        }

        setEntityInfo(null);
        setVerified(false);
      } catch (error) {
        console.error('Verification error:', error);
        setEntityInfo(null);
        setVerified(false);
      } finally {
        setVerifying(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [loginId]);

  const rolePresentation = useMemo(() => {
    switch (entityInfo?.role) {
      case 'admin':
        return { icon: Shield, label: 'Admin' };
      case 'sub_admin':
        return { icon: Shield, label: 'Sub Admin' };
      case 'gate':
        return { icon: DoorOpen, label: 'Gate' };
      case 'store':
        return { icon: Store, label: 'Store' };
      case 'department':
        return { icon: Users, label: 'Department' };
      default:
        return { icon: Search, label: 'Access' };
    }
  }, [entityInfo?.role]);

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent;
    let deviceName = 'Unknown Device';
    let browser = 'Unknown Browser';

    if (/iPhone|iPad|iPod/.test(userAgent)) deviceName = 'iOS Device';
    else if (/Android/.test(userAgent)) deviceName = 'Android Device';
    else if (/Windows/.test(userAgent)) deviceName = 'Windows PC';
    else if (/Mac/.test(userAgent)) deviceName = 'Mac';
    else if (/Linux/.test(userAgent)) deviceName = 'Linux PC';

    if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/.test(userAgent)) browser = 'Firefox';
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = 'Safari';
    else if (/Edge/.test(userAgent)) browser = 'Edge';

    return { deviceName, browser };
  };

  const handleAdminLogin = async (accessId: string) => {
    const adminEmail = `admin_${accessId}@mnrgroup.com`;
    const adminPassword = getAuthPassword(accessId);

    let authPayload: any = null;
    let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (signInError?.message?.includes('Invalid login credentials') && accessId.length >= 6) {
      const legacySignIn = await supabase.auth.signInWithPassword({ email: adminEmail, password: accessId });
      if (!legacySignIn.error) {
        signInData = legacySignIn.data;
        signInError = null;
      }
    }

    if (signInError?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: { data: { name: 'Administrator', role: 'admin' }, emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (signUpError) throw signUpError;
      authPayload = signUpData;
      if (!signUpData.session) {
        const retry = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
        if (retry.error) throw retry.error;
        authPayload = retry.data;
      }
    } else if (signInError) {
      throw signInError;
    } else {
      authPayload = signInData;
    }

    const activeUser = authPayload?.user;
    if (!activeUser) throw new Error('Login completed but user session not found.');

    // Navigate immediately; run secondary work in background
    toast.success('Welcome, Admin!');
    navigate('/admin');

    const { deviceName, browser } = getDeviceInfo();
    void supabase.from('user_roles').insert({ user_id: activeUser.id, role: 'admin' as const });
    void supabase.from('profiles').upsert(
      { user_id: activeUser.id, name: 'Administrator', email: adminEmail },
      { onConflict: 'user_id' },
    );
    void supabase.from('login_sessions').insert({
      user_id: activeUser.id, role: 'admin' as const, device_name: deviceName, browser,
    });
    void preloadRoleData(activeUser, 'admin');
  };

  const handleSubAdminLogin = async (info: EntityInfo) => {
    const accessId = sanitizeLoginId(info.code);
    const email = `subadmin_${accessId}@mnrgroup.com`;
    const password = getAuthPassword(info.code);

    let authPayload: any = null;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: info.name, role: 'sub_admin' }, emailRedirectTo: `${window.location.origin}/sub-admin` },
      });
      if (signUpError) throw signUpError;
      authPayload = signUpData;
      if (!signUpData.session) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (retry.error) throw retry.error;
        authPayload = retry.data;
      }
    } else if (signInError) {
      throw signInError;
    } else {
      authPayload = signInData;
    }

    const activeUser = authPayload?.user;
    if (!activeUser) throw new Error('Login completed but user session not found.');

    // CRITICAL: ensure user_roles row exists BEFORE navigating, so RLS policies
    // (which rely on has_role) allow the dashboard to load data on first login.
    await supabase
      .from('user_roles')
      .upsert({ user_id: activeUser.id, role: 'sub_admin' as const }, { onConflict: 'user_id,role' });

    toast.success(`Welcome, ${info.name}`);
    navigate('/sub-admin');

    const { deviceName, browser } = getDeviceInfo();
    void supabase.from('profiles').upsert(
      { user_id: activeUser.id, name: info.name, email },
      { onConflict: 'user_id' },
    );
    void supabase.from('sub_admins').update({ user_id: activeUser.id }).eq('id', info.id);
    void supabase.from('login_sessions').insert({
      user_id: activeUser.id, role: 'sub_admin' as const, device_name: deviceName, browser,
    });
    void preloadRoleData(activeUser, 'sub_admin');
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedId = loginId.trim();

    if (!trimmedId) {
      toast.error('Please enter your ID');
      return;
    }

    if (trimmedId !== ADMIN_ID && (!entityInfo || !verified)) {
      toast.error('Valid ID not found');
      return;
    }

    setIsLoading(true);

    try {
      if (trimmedId === ADMIN_ID || entityInfo?.role === 'admin') {
        await handleAdminLogin(trimmedId);
        return;
      }

      if (entityInfo?.role === 'sub_admin') {
        await handleSubAdminLogin(entityInfo);
        return;
      }

      const normalizedId = sanitizeLoginId(trimmedId);
      const email = `${entityInfo.role}_${normalizedId}@mnrgroup.com`;
      const password = getAuthPassword(trimmedId);

      let authPayload: any = null;
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError?.message?.includes('Invalid login credentials') && trimmedId.length >= 6) {
        const legacySignIn = await supabase.auth.signInWithPassword({ email, password: trimmedId });
        if (!legacySignIn.error) {
          signInData = legacySignIn.data;
          signInError = null;
        }
      }

      if (signInError?.message?.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: entityInfo.name,
              role: entityInfo.role,
              office_id: entityInfo.office_id,
              entity_id: entityInfo.id,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signUpError) throw signUpError;
        authPayload = signUpData;

        if (!signUpData.session) {
          const retrySignIn = await supabase.auth.signInWithPassword({ email, password });
          if (retrySignIn.error) throw retrySignIn.error;
          authPayload = retrySignIn.data;
        }
      } else if (signInError) {
        throw signInError;
      } else {
        authPayload = signInData;
      }

      const activeUser = authPayload?.user || (await supabase.auth.getUser()).data.user;
      if (!activeUser) {
        throw new Error('Login completed but user session not found. Please try again.');
      }

      const { error: syncError } = await supabase.functions.invoke('sync-user-entity', {
        body: {
          table: entityInfo.table,
          entityId: entityInfo.id,
          role: entityInfo.role,
          officeId: entityInfo.office_id,
          name: entityInfo.name,
          email,
        },
      });

      if (syncError) throw syncError;

      toast.success(`Welcome to ${entityInfo.name}`);
      navigate(`/${entityInfo.role}`);

      const { deviceName, browser } = getDeviceInfo();
      void supabase.from('login_sessions').insert({
        user_id: activeUser.id,
        role: entityInfo.role as 'gate' | 'store' | 'department',
        device_name: deviceName,
        browser,
      });
      void preloadRoleData(activeUser, entityInfo.role);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const RoleIcon = rolePresentation.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="login-card relative animate-slide-up max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src={logo}
              alt="MNR Group"
              className="h-20 w-20 rounded-full object-cover border-4 border-primary/10 shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MNR Group</h1>
          <p className="text-muted-foreground mt-1">Access with your ID</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
              <Label htmlFor="loginId">Access ID</Label>
            <div className="relative">
              <Input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter your Access ID"
                className={`form-input h-11 pr-10 ${verified ? 'border-success' : ''}`}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {verifying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {verified && <CheckCircle2 className="h-4 w-4 text-success" />}
                {!verifying && !verified && loginId.trim().length >= 1 && <AlertCircle className="h-4 w-4 text-destructive" />}
              </div>
            </div>
          </div>

          {entityInfo && verified && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
                  <RoleIcon className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-success">Verified {rolePresentation.label}</p>
                  <p className="text-sm text-foreground">{entityInfo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entityInfo.role === 'admin' ? `ID: ${entityInfo.code}` : `${entityInfo.office_name || 'Office'} • ID: ${entityInfo.code}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!verified && loginId.trim().length >= 1 && !verifying && (
            <p className="text-xs text-destructive">ID not found. Please check and try again.</p>
          )}

          <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading || !verified}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">© 2026 MNR Group. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
