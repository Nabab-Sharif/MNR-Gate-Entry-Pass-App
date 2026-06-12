import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserRow {
  user_id: string;
  name: string;
  role: string;
  office_name?: string | null;
  last_seen_at: string | null;
  is_active: boolean;
}

const HEARTBEAT_WINDOW_MS = 2 * 60 * 1000;

const SubAdminOnlinePage: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [sessRes, gateRes, storeRes, deptRes, profRes, subRes] = await Promise.all([
      supabase.from('login_sessions').select('user_id, role, last_seen_at, is_active, logout_at, login_at').order('login_at', { ascending: false }).limit(500),
      supabase.from('gates').select('user_id, name, offices(name)'),
      supabase.from('stores').select('user_id, name, offices(name)'),
      supabase.from('departments').select('user_id, name, offices(name)'),
      supabase.from('profiles').select('user_id, name'),
      supabase.from('sub_admins').select('user_id, name'),
    ]);

    const gateMap = new Map((gateRes.data || []).map((g: any) => [g.user_id, g]));
    const storeMap = new Map((storeRes.data || []).map((g: any) => [g.user_id, g]));
    const deptMap = new Map((deptRes.data || []).map((g: any) => [g.user_id, g]));
    const profMap = new Map((profRes.data || []).map((g: any) => [g.user_id, g]));
    const subMap = new Map((subRes.data || []).map((g: any) => [g.user_id, g]));

    // Reduce sessions to one per user (latest last_seen_at)
    const userMap = new Map<string, UserRow>();
    (sessRes.data || []).forEach((s: any) => {
      if (!s.user_id) return;
      const entity =
        s.role === 'gate' ? gateMap.get(s.user_id) :
        s.role === 'store' ? storeMap.get(s.user_id) :
        s.role === 'department' ? deptMap.get(s.user_id) : null;
      const prof = profMap.get(s.user_id);
      const sub = subMap.get(s.user_id);
      const name = entity?.name || sub?.name || prof?.name || (s.role === 'admin' ? 'Administrator' : 'User');
      const office = entity?.offices?.name || null;
      const lastSeen = s.last_seen_at ? new Date(s.last_seen_at).getTime() : 0;
      const active = s.is_active === true && !s.logout_at && (Date.now() - lastSeen < HEARTBEAT_WINDOW_MS);

      const existing = userMap.get(s.user_id);
      if (!existing || (s.last_seen_at && new Date(s.last_seen_at) > new Date(existing.last_seen_at || 0))) {
        userMap.set(s.user_id, {
          user_id: s.user_id, name, role: s.role, office_name: office,
          last_seen_at: s.last_seen_at, is_active: active,
        });
      } else if (active) {
        existing.is_active = true;
      }
    });

    const rows = Array.from(userMap.values()).sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime();
    });
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const onlineCount = users.filter((u) => u.is_active).length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Online Users</h1>
        <p className="page-description">{onlineCount} online · {users.length} total · auto-refreshes every 30s</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No users found</p>}
          {users.map((u) => (
            <div key={u.user_id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-3 w-3 rounded-full flex-shrink-0 ${u.is_active ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role.replace('_', ' ')} {u.office_name ? `· ${u.office_name}` : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={u.is_active ? 'default' : 'outline'} className="text-[10px]">
                  {u.is_active ? 'Online' : 'Offline'}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {u.last_seen_at ? `Last seen ${formatDistanceToNow(new Date(u.last_seen_at), { addSuffix: true })}` : 'No activity'}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubAdminOnlinePage;
