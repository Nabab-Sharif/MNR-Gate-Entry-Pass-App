import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SubAdmin {
  id: string;
  name: string;
  access_id: string;
  status: string;
  user_id: string | null;
  created_at: string;
}

const generateId = () => `SA${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const SubAdminManager: React.FC = () => {
  const [items, setItems] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubAdmin | null>(null);
  const [name, setName] = useState('');
  const [accessId, setAccessId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('sub_admins').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(''); setAccessId(''); setOpen(true); };
  const openEdit = (s: SubAdmin) => { setEditing(s); setName(s.name); setAccessId(s.access_id); setOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const finalId = accessId.trim() || generateId();
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('sub_admins').update({ name: name.trim(), access_id: finalId }).eq('id', editing.id);
        if (error) throw error;
        toast.success('Sub admin updated');
      } else {
        const { error } = await supabase.from('sub_admins').insert({ name: name.trim(), access_id: finalId });
        if (error) throw error;
        toast.success(`Sub admin created · Access ID: ${finalId}`);
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: SubAdmin) => {
    if (!confirm(`Delete sub admin "${s.name}"?`)) return;
    const { error } = await supabase.from('sub_admins').delete().eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Sub admin deleted');
    load();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Sub Admins
        </CardTitle>
        <Button size="sm" onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No sub admins yet. Add one to grant read-only multi-office access.</p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">ID: {s.access_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === 'active' ? 'default' : 'outline'} className="text-[10px] capitalize">{s.status}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Sub Admin' : 'Add Sub Admin'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sub admin name" />
              </div>
              <div className="space-y-1">
                <Label>Access ID</Label>
                <Input value={accessId} onChange={(e) => setAccessId(e.target.value)} placeholder="Leave blank to auto-generate" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SubAdminManager;
