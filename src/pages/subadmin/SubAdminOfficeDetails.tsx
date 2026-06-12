import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, FileText, Search, Loader2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import ChatDialog from '@/components/ChatDialog';

const SubAdminOfficeDetails: React.FC = () => {
  const { officeId } = useParams<{ officeId: string }>();
  const [loading, setLoading] = useState(true);
  const [officeName, setOfficeName] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [chatTarget, setChatTarget] = useState<{ type: 'product' | 'pass'; id: string; title: string } | null>(null);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!officeId) return;
    (async () => {
      const [oRes, pRes, gRes, userRes] = await Promise.all([
        supabase.from('offices').select('name').eq('id', officeId).maybeSingle(),
        supabase.from('products').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
        supabase.from('gate_passes').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setOfficeName(oRes.data?.name || 'Office');
      setProducts(pRes.data || []);
      setPasses(gRes.data || []);
      const u = userRes.data.user;
      setMe(u ? { id: u.id, name: u.user_metadata?.name || 'Sub Admin' } : null);
      setLoading(false);
    })();
  }, [officeId]);

  const q = search.trim().toLowerCase();
  const filteredProducts = products.filter((p) =>
    !q || p.name?.toLowerCase().includes(q) || p.sender_name?.toLowerCase().includes(q) || p.receiver_name?.toLowerCase().includes(q),
  );
  const filteredPasses = passes.filter((p) =>
    !q || p.product_name?.toLowerCase().includes(q) || p.sender_name?.toLowerCase().includes(q) || p.receiver_name?.toLowerCase().includes(q),
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/sub-admin"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <h1 className="text-xl font-semibold text-foreground">{officeName}</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name / sender / receiver" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" className="gap-2"><Package className="h-4 w-4" /> Gate Entries ({filteredProducts.length})</TabsTrigger>
          <TabsTrigger value="passes" className="gap-2"><FileText className="h-4 w-4" /> Gate Passes ({filteredPasses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-2 mt-4">
          {filteredProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No entries</p>}
          {filteredProducts.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{(p.status || '').replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.sender_name || '—'} → {p.receiver_name || '—'} · Qty {p.quantity ?? 1} · {format(new Date(p.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
                <Button size="icon" variant="outline" onClick={() => setChatTarget({ type: 'product', id: p.id, title: p.name })}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="passes" className="space-y-2 mt-4">
          {filteredPasses.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No passes</p>}
          {filteredPasses.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{p.product_name}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{(p.status || '').replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.sender_name || '—'} → {p.receiver_name || '—'} · Qty {p.quantity ?? 1} · {format(new Date(p.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
                <Button size="icon" variant="outline" onClick={() => setChatTarget({ type: 'pass', id: p.id, title: p.product_name })}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {chatTarget && me && officeId && (
        <ChatDialog
          open={!!chatTarget}
          onOpenChange={(open) => !open && setChatTarget(null)}
          officeId={officeId}
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

export default SubAdminOfficeDetails;
