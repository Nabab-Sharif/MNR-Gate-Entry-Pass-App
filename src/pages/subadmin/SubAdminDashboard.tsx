import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, FileText, Building2, Clock, ChevronRight, Loader2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import ChatDialog from '@/components/ChatDialog';
import { ProductFlowProgress, ProductStatusBadge } from '@/components/ProductFlowTimeline';
import { GatePassFlowProgress, GatePassStatusBadge } from '@/components/GatePassFlowTimeline';

interface Office { id: string; name: string; location: string | null; }
interface Item {
  id: string; name: string; status: string | null; created_at: string; office_id: string;
  quantity?: number | null; sender_name?: string | null; receiver_name?: string | null; created_by?: string | null;
  office?: { name: string } | null;
  stores?: { user_id: string | null } | null;
}
type ProductRow = Omit<Item, 'office' | 'stores'>;
type PassRow = Omit<Item, 'name' | 'office'> & { product_name: string; stores?: { user_id: string | null } | null };
interface OfficeStat {
  office: Office;
  totalEntries: number;
  totalPasses: number;
  pending: number;
}

const SubAdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<Item[]>([]);
  const [recentPasses, setRecentPasses] = useState<Item[]>([]);
  const [officeStats, setOfficeStats] = useState<OfficeStat[]>([]);
  const [chatTarget, setChatTarget] = useState<{ type: 'product' | 'pass'; id: string; officeId: string; title: string } | null>(null);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    try {
      const [officesRes, productsRes, passesRes, userRes] = await Promise.all([
        supabase.from('offices').select('*').eq('status', 'active').order('name'),
        supabase.from('products').select('id, name, status, created_at, office_id, quantity, sender_name, receiver_name').order('created_at', { ascending: false }),
        supabase.from('gate_passes').select('id, product_name, status, created_at, office_id, quantity, sender_name, receiver_name, created_by, stores(user_id)').order('created_at', { ascending: false }),
        supabase.auth.getUser(),
      ]);
      const offices = (officesRes.data || []) as Office[];
      const products = (productsRes.data || []) as ProductRow[];
      const passes = (passesRes.data || []) as PassRow[];
      const user = userRes.data.user;
      setMe(user ? { id: user.id, name: user.user_metadata?.name || 'Sub Admin' } : null);
      const officeMap = new Map<string, Office>(offices.map((o) => [o.id, o]));

      setRecentEntries(products.slice(0, 10).map((p) => ({ ...p, office: officeMap.get(p.office_id) })));
      setRecentPasses(passes.slice(0, 10).map((p) => ({ ...p, name: p.product_name, office: officeMap.get(p.office_id) })));

      const stats: OfficeStat[] = offices.map((o) => {
        const pEntries = products.filter((p) => p.office_id === o.id);
        const pPasses = passes.filter((p) => p.office_id === o.id);
        const pendingE = pEntries.filter((p) => ['entered', 'in_transit', 'pending'].includes(p.status || '')).length;
        const pendingP = pPasses.filter((p) => ['pending', 'in_transit', 'awaiting_verification'].includes(p.status || '')).length;
        return {
          office: o,
          totalEntries: pEntries.length,
          totalPasses: pPasses.length,
          pending: pendingE + pendingP,
        };
      });
      setOfficeStats(stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRealtimeSubscription({ table: 'products', onInsert: load, onUpdate: load, onDelete: load, enabled: true });
  useRealtimeSubscription({ table: 'gate_passes', onInsert: load, onUpdate: load, onDelete: load, enabled: true });

  const openChat = (item: Item, type: 'product' | 'pass') => {
    setChatTarget({ type, id: item.id, officeId: item.office_id, title: item.name });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Sub Admin Overview</h1>
        <p className="page-description">Read-only view across all units</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Recent Gate Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEntries.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No entries yet</p>}
            {recentEntries.map((e) => (
              <div key={e.id} className="rounded-lg border border-border/70 bg-card/95 p-3 space-y-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
                        <Building2 className="h-3 w-3" /> {e.office?.name || '—'}
                        <Clock className="h-3 w-3 ml-1" /> {format(new Date(e.created_at), 'MMM d, HH:mm')}
                        <span>Qty {e.quantity ?? 1}</span>
                      </p>
                    </div>
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => openChat(e, 'product')} aria-label="Open chat">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <ProductStatusBadge status={e.status || 'entered'} />
                    <Badge variant="outline" className="text-[10px]">Delivery Progress</Badge>
                  </div>
                  <ProductFlowProgress currentStatus={e.status || 'entered'} disabled />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Recent Gate Passes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPasses.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No passes yet</p>}
            {recentPasses.map((e) => (
              <div key={e.id} className="rounded-lg border border-border/70 bg-card/95 p-3 space-y-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
                        <Building2 className="h-3 w-3" /> {e.office?.name || '—'}
                        <Clock className="h-3 w-3 ml-1" /> {format(new Date(e.created_at), 'MMM d, HH:mm')}
                        <span>Qty {e.quantity ?? 1}</span>
                      </p>
                    </div>
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => openChat(e, 'pass')} aria-label="Open chat">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <GatePassStatusBadge status={e.status || 'created'} />
                    <Badge variant="outline" className="text-[10px]">Delivery Progress</Badge>
                  </div>
                  <GatePassFlowProgress
                    currentStatus={e.status || 'created'}
                    createdBy={e.created_by && e.stores?.user_id && e.created_by === e.stores.user_id ? 'store' : 'department'}
                    disabled
                  />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Units / Offices
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {officeStats.map((s) => (
            <Link key={s.office.id} to={`/sub-admin/offices/${s.office.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="truncate">{s.office.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  {s.office.location && <p className="text-xs text-muted-foreground">{s.office.location}</p>}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/40 p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Entries</p>
                      <p className="text-lg font-semibold text-foreground">{s.totalEntries}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Passes</p>
                      <p className="text-lg font-semibold text-foreground">{s.totalPasses}</p>
                    </div>
                    <div className="rounded-lg bg-warning/10 p-2">
                      <p className="text-[10px] uppercase text-warning">Pending</p>
                      <p className="text-lg font-semibold text-warning">{s.pending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {chatTarget && me && (
        <ChatDialog
          open={!!chatTarget}
          onOpenChange={(open) => !open && setChatTarget(null)}
          officeId={chatTarget.officeId}
          productId={chatTarget.type === 'product' ? chatTarget.id : undefined}
          gatePassId={chatTarget.type === 'pass' ? chatTarget.id : undefined}
          currentUserId={me.id}
          currentUserRole="sub_admin"
          currentUserName={me.name}
          title={`Chat - ${chatTarget.title}`}
        />
      )}
    </div>
  );
};

export default SubAdminDashboard;
