import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store, Search, Building2, Copy, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getCached, setCached, upsertCached, deleteCached } from '@/lib/indexedDBCache';

interface StoreItem {
  id: string;
  name: string;
  store_code: string;
  status: string;
  created_at: string;
  office_id: string;
  offices?: { name: string };
}

const AllStoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStores = async () => {
    try {
      const cached = await getCached<StoreItem>('stores');
      if (cached.length) {
        setStores(cached);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from('stores')
        .select('*, offices(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStores(data || []);
      void setCached('stores', data || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useRealtimeSubscription({
    table: 'stores',
    onInsert: (newStore) => {
      setStores(prev => [newStore, ...prev]);
      void upsertCached('stores', newStore);
    },
    onUpdate: (updated) => {
      setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
      void upsertCached('stores', updated);
    },
    onDelete: (deleted) => {
      setStores(prev => prev.filter(s => s.id !== deleted.id));
      void deleteCached('stores', deleted.id);
    }
  });

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copied');
  };

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.store_code.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="flex items-center gap-3">
          <div className="icon-container" style={{ background: 'linear-gradient(135deg, hsl(142 71% 45%), hsl(142 60% 40%))' }}>
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">All Stores</h1>
            <p className="page-description">Manage all stores across offices</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredStores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No stores found</h3>
            <p className="text-sm text-muted-foreground">
              Create stores from the Office Dashboard
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((store, index) => (
            <Card 
              key={store.id}
              className="border-border/50 hover:border-primary/30 transition-all animate-slide-up cursor-pointer group"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/admin/stores/${store.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="icon-container" style={{ background: 'linear-gradient(135deg, hsl(142 71% 45%), hsl(142 60% 40%))' }}>
                    <Store className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{store.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-secondary px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {store.store_code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyId(store.store_code);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{store.offices?.name || 'Unknown Office'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      store.status === 'active' ? 'status-active' : 'status-inactive'
                    }`}>
                      {store.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllStoresPage;
