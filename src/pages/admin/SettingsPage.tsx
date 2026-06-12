import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Users,
  Monitor,
  Clock,
  Loader2,
  Smartphone,
  Globe,
  KeyRound,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import SubAdminManager from '@/components/SubAdminManager';

interface LoginSession {
  id: string;
  role: string;
  device_name: string;
  browser: string;
  login_at: string;
  is_active: boolean;
  logout_at?: string | null;
  user_id?: string | null;
  profiles?: { name: string; email: string };
  office_name?: string | null;
  entity_name?: string | null;
  entity_type?: string | null;
}

const SettingsPage: React.FC = () => {
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Access ID state
  const [currentAccessId, setCurrentAccessId] = useState<string>('');
  const [editingId, setEditingId] = useState(false);
  const [newAccessId, setNewAccessId] = useState('');
  const [savingId, setSavingId] = useState(false);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('login_sessions')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const sessionsData = data || [];
      const userIds = Array.from(
        new Set(sessionsData.map((session) => session.user_id).filter(Boolean) as string[])
      );

      let profileMap = new Map<string, { name?: string | null; email?: string | null }>();
      let storeMap = new Map<string, any>();
      let departmentMap = new Map<string, any>();
      let gateMap = new Map<string, any>();

      if (userIds.length > 0) {
        const [profilesRes, storeRes, departmentRes, gateRes] = await Promise.all([
          supabase.from('profiles').select('user_id, name, email').in('user_id', userIds),
          supabase.from('stores').select('user_id, name, office_id, offices(name)').in('user_id', userIds),
          supabase.from('departments').select('user_id, name, office_id, offices(name)').in('user_id', userIds),
          supabase.from('gates').select('user_id, name, office_id, offices(name)').in('user_id', userIds),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (storeRes.error) throw storeRes.error;
        if (departmentRes.error) throw departmentRes.error;
        if (gateRes.error) throw gateRes.error;

        profileMap = new Map((profilesRes.data || []).map((profile: any) => [profile.user_id, profile]));
        storeMap = new Map((storeRes.data || []).map((item: any) => [item.user_id, item]));
        departmentMap = new Map((departmentRes.data || []).map((item: any) => [item.user_id, item]));
        gateMap = new Map((gateRes.data || []).map((item: any) => [item.user_id, item]));
      }

      const enriched = sessionsData.map((session) => {
        const profile = session.user_id ? profileMap.get(session.user_id) : undefined;
        const store = session.user_id ? storeMap.get(session.user_id) : undefined;
        const department = session.user_id ? departmentMap.get(session.user_id) : undefined;
        const gate = session.user_id ? gateMap.get(session.user_id) : undefined;
        const entity =
          session.role === 'store'
            ? store
            : session.role === 'gate'
            ? gate
            : session.role === 'department'
            ? department
            : undefined;
        const officeName = entity?.offices?.name ?? null;
        const entityName = entity?.name ?? profile?.name ?? (session.role === 'admin' ? 'Administrator' : null);
        const entityType =
          session.role === 'admin'
            ? 'Admin'
            : session.role === 'store'
            ? 'Store'
            : session.role === 'gate'
            ? 'Gate'
            : session.role === 'department'
            ? 'Department'
            : 'Unknown';
        // Online only if active, not logged out, AND heartbeat within last 2 minutes
        const HEARTBEAT_WINDOW_MS = 2 * 60 * 1000;
        const lastSeen = (session as any).last_seen_at ? new Date((session as any).last_seen_at).getTime() : 0;
        const recent = Date.now() - lastSeen < HEARTBEAT_WINDOW_MS;
        const normalizedActive = session.is_active === true && !session.logout_at && recent;

        return {
          ...session,
          profiles: profile ? { name: profile.name, email: profile.email } : undefined,
          office_name: officeName,
          entity_name: entityName,
          entity_type: entityType,
          is_active: normalizedActive,
        };
      });

      // Aggregate by entity so each department/store/gate appears once
      const aggMap = new Map<string, any>();
      enriched.forEach((s) => {
        const key = `${s.entity_type}|${s.user_id || s.entity_name || s.id}`;
        const existing = aggMap.get(key);
        const loginAt = s.login_at ? new Date(s.login_at) : null;
        const logoutAt = s.logout_at ? new Date(s.logout_at) : null;

        if (!existing) {
          aggMap.set(key, { ...s, last_login: loginAt, last_logout: logoutAt });
          return;
        }

        // Keep latest login
        if (loginAt && (!existing.last_login || loginAt > existing.last_login)) {
          existing.last_login = loginAt;
          existing.login_at = s.login_at;
        }

        // Keep latest logout
        if (logoutAt && (!existing.last_logout || logoutAt > existing.last_logout)) {
          existing.last_logout = logoutAt;
          existing.logout_at = s.logout_at;
        }

        // If any active session exists for this entity, mark active
        existing.is_active = existing.is_active || s.is_active === true;
      });

      const aggregated = Array.from(aggMap.values()).map((it) => ({
        ...it,
        // normalize Date objects back to strings for rendering convenience
        last_login: it.last_login ? it.last_login.toISOString() : null,
        last_logout: it.last_logout ? it.last_logout.toISOString() : null,
      }));

      setSessions(aggregated);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccessId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Extract access id from email pattern: admin_<id>@mnrgroup.com
    const match = user.email?.match(/^admin_(.+)@mnrgroup\.com$/);
    const id = match?.[1] || user.user_metadata?.access_id || '';
    setCurrentAccessId(id);
    setNewAccessId(id);
  };

  useEffect(() => {
    fetchSessions();
    fetchAccessId();
  }, []);

  const handleSaveAccessId = async () => {
    const trimmed = newAccessId.trim();
    if (!trimmed) {
      toast.error('Access ID cannot be empty');
      return;
    }
    if (trimmed === currentAccessId) {
      setEditingId(false);
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
      toast.error('Access ID may only contain letters, numbers and underscores');
      return;
    }

    setSavingId(true);
    try {
      const newEmail = `admin_${trimmed}@mnrgroup.com`;
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
        data: { access_id: trimmed },
      });
      if (error) throw error;
      toast.success('Access ID updated. You may need to verify the new email and login again.');
      setCurrentAccessId(trimmed);
      setEditingId(false);
    } catch (error: any) {
      console.error('Error updating access id:', error);
      toast.error(error?.message || 'Failed to update Access ID');
    } finally {
      setSavingId(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-primary/10 text-primary';
      case 'gate': return 'bg-info/10 text-info';
      case 'store': return 'bg-success/10 text-success';
      case 'department': return 'bg-warning/10 text-warning';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="icon-container">
            <Settings className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-description">System settings and login history</p>
          </div>
        </div>
      </div>

      {/* Admin Access ID Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Admin Access ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">
              This is the ID you use to login as Admin.
            </Label>
            {editingId ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newAccessId}
                  onChange={(e) => setNewAccessId(e.target.value)}
                  placeholder="Enter new Access ID"
                  className="flex-1"
                  disabled={savingId}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveAccessId} disabled={savingId} className="gap-2">
                    {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(false);
                      setNewAccessId(currentAccessId);
                    }}
                    disabled={savingId}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-xs text-muted-foreground">Current Access ID</p>
                  <p className="font-mono font-semibold text-foreground">
                    {currentAccessId || '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingId(true)} className="gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Note: After changing the Access ID you may be asked to confirm the change and re-login.
            </p>
          </div>
        </CardContent>
      </Card>

      <SubAdminManager />

      <Tabs defaultValue="sessions">
        <TabsList className="mb-6">
          <TabsTrigger value="sessions" className="gap-2">
            <Users className="h-4 w-4" />
            Login Sessions
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-2">
            <Monitor className="h-4 w-4" />
            Active Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Recent Login Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No login history</h3>
                  <p className="text-sm text-muted-foreground">
                    Login sessions will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session, index) => (
                    <div 
                      key={session.id}
                      className="flex flex-col gap-4 p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="icon-container-secondary !p-2">
                            {session.device_name?.toLowerCase().includes('mobile') ? (
                              <Smartphone className="h-4 w-4 text-primary" />
                            ) : (
                              <Monitor className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate">
                                {session.profiles?.name || 'Unknown User'}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(session.role)}`}>
                                {session.role}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {session.profiles?.email || 'No email'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.browser || 'Unknown Browser'}
                          </span>
                          <span>{session.device_name || 'Unknown Device'}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-foreground">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${session.is_active === true ? 'bg-success' : 'bg-muted-foreground'}`}
                            />
                            {session.is_active === true ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Login</p>
                          <p className="text-foreground">
                            {format(new Date(session.login_at), 'MMM d, yyyy')}
                          </p>
                          <p>{format(new Date(session.login_at), 'HH:mm')}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Unit / Office</p>
                          <p className="text-foreground">{session.office_name || 'Not available'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Entity Name</p>
                          <p className="text-foreground">{session.entity_name || 'Not available'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                Active Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.filter((s) => s.is_active === true).map((session, index) => (
                    <div 
                      key={session.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-success/20 bg-success/5"
                    >
                      <div className="icon-container" style={{ background: 'linear-gradient(135deg, hsl(142 71% 45%), hsl(142 60% 40%))' }}>
                        {session.device_name?.toLowerCase().includes('mobile') ? (
                          <Smartphone className="h-4 w-4 text-white" />
                        ) : (
                          <Monitor className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{session.device_name || 'Unknown Device'}</p>
                        <p className="text-sm text-muted-foreground">{session.browser}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(session.role)}`}>
                          {session.role}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.profiles?.name}
                        </p>
                      </div>
                    </div>
                  ))}
                  {sessions.filter(s => s.is_active).length === 0 && (
                    <div className="text-center py-12">
                      <Monitor className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <h3 className="font-semibold text-foreground mb-2">No active devices</h3>
                      <p className="text-sm text-muted-foreground">
                        Active sessions will appear here
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
