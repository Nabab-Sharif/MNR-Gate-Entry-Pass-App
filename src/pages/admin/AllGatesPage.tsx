import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DoorOpen, Search, Building2, Copy, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getCached, setCached, upsertCached, deleteCached } from '@/lib/indexedDBCache';

interface Gate {
  id: string;
  name: string;
  gate_code: string;
  status: string;
  created_at: string;
  office_id: string;
  offices?: { name: string };
}

const AllGatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchGates = async () => {
    try {
      const cached = await getCached<Gate>('gates');
      if (cached.length) {
        setGates(cached);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from('gates')
        .select('*, offices(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGates(data || []);
      void setCached('gates', data || []);
    } catch (error) {
      console.error('Error fetching gates:', error);
      toast.error('Failed to load gates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGates();
  }, []);

  useRealtimeSubscription({
    table: 'gates',
    onInsert: (newGate) => {
      setGates(prev => [newGate, ...prev]);
      void upsertCached('gates', newGate);
    },
    onUpdate: (updated) => {
      setGates(prev => prev.map(g => g.id === updated.id ? updated : g));
      void upsertCached('gates', updated);
    },
    onDelete: (deleted) => {
      setGates(prev => prev.filter(g => g.id !== deleted.id));
      void deleteCached('gates', deleted.id);
    }
  });

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copied');
  };

  const filteredGates = gates.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.gate_code.toLowerCase().includes(search.toLowerCase())
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
          <div className="icon-container">
            <DoorOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">All Gates</h1>
            <p className="page-description">Manage all gates across offices</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search gates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredGates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No gates found</h3>
            <p className="text-sm text-muted-foreground">
              Create gates from the Office Dashboard
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGates.map((gate, index) => (
            <Card 
              key={gate.id}
              className="border-border/50 hover:border-primary/30 transition-all animate-slide-up cursor-pointer group"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/admin/gates/${gate.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="icon-container">
                    <DoorOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{gate.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-secondary px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {gate.gate_code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyId(gate.gate_code);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{gate.offices?.name || 'Unknown Office'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      gate.status === 'active' ? 'status-active' : 'status-inactive'
                    }`}>
                      {gate.status}
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

export default AllGatesPage;
