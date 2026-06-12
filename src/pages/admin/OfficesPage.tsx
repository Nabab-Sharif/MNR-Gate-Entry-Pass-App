import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  Plus, 
  MapPin, 
  DoorOpen, 
  Store, 
  Users, 
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getCached, setCached, upsertCached, deleteCached } from '@/lib/indexedDBCache';

interface Office {
  id: string;
  name: string;
  location: string | null;
  status: string | null;
  created_at: string;
  gates_count?: number;
  stores_count?: number;
  departments_count?: number;
}

const OfficesPage: React.FC = () => {
  const navigate = useNavigate();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    status: 'active' as 'active' | 'inactive',
  });

  const fetchOffices = async () => {
    try {
      const cached = await getCached<Office>('offices');
      if (cached.length) {
        setOffices(cached);
        setLoading(false);
      }

      // Fetch offices with counts
      const { data: officesData, error } = await supabase
        .from('offices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch counts for each office
      const officesWithCounts = await Promise.all(
        (officesData || []).map(async (office) => {
          const [gatesRes, storesRes, deptsRes] = await Promise.all([
            supabase.from('gates').select('id', { count: 'exact', head: true }).eq('office_id', office.id),
            supabase.from('stores').select('id', { count: 'exact', head: true }).eq('office_id', office.id),
            supabase.from('departments').select('id', { count: 'exact', head: true }).eq('office_id', office.id),
          ]);
          
          return {
            ...office,
            gates_count: gatesRes.count || 0,
            stores_count: storesRes.count || 0,
            departments_count: deptsRes.count || 0,
          };
        })
      );

      setOffices(officesWithCounts);
      void setCached('offices', officesWithCounts);
    } catch (error) {
      console.error('Error fetching offices:', error);
      toast.error('Failed to load offices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);

  useRealtimeSubscription({
    table: 'offices',
    onInsert: (office) => {
      setOffices(prev => [office, ...prev]);
      void upsertCached('offices', office);
      void fetchOffices();
    },
    onUpdate: (office) => {
      setOffices(prev => prev.map(item => item.id === office.id ? { ...item, ...office } : item));
      void upsertCached('offices', office);
      void fetchOffices();
    },
    onDelete: (office) => {
      setOffices(prev => prev.filter(item => item.id !== office.id));
      void deleteCached('offices', office.id);
    }
  });

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    office.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter office name');
      return;
    }

    setSaving(true);

    try {
      if (editingOffice) {
        const { error } = await supabase
          .from('offices')
          .update({
            name: formData.name,
            location: formData.location || null,
            status: formData.status,
          })
          .eq('id', editingOffice.id);

        if (error) throw error;
        toast.success('Office updated successfully');
      } else {
        const { error } = await supabase
          .from('offices')
          .insert({
            name: formData.name,
            location: formData.location || null,
            status: formData.status,
          });

        if (error) throw error;
        toast.success('Office created successfully');
      }

      setIsDialogOpen(false);
      setEditingOffice(null);
      setFormData({ name: '', location: '', status: 'active' });
      fetchOffices();
    } catch (error: any) {
      console.error('Error saving office:', error);
      toast.error(error.message || 'Failed to save office');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setFormData({
      name: office.name,
      location: office.location || '',
      status: (office.status as 'active' | 'inactive') || 'active',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (office: Office) => {
    if (window.confirm(`Are you sure you want to delete "${office.name}"?`)) {
      try {
        const { error } = await supabase
          .from('offices')
          .delete()
          .eq('id', office.id);

        if (error) throw error;
        toast.success('Office deleted successfully');
        fetchOffices();
      } catch (error: any) {
        console.error('Error deleting office:', error);
        toast.error(error.message || 'Failed to delete office');
      }
    }
  };

  const openCreateDialog = () => {
    setEditingOffice(null);
    setFormData({ name: '', location: '', status: 'active' });
    setIsDialogOpen(true);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Offices / Units</h1>
          <p className="page-description">Manage all your offices and units</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Office
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOffice ? 'Edit Office' : 'Create New Office'}</DialogTitle>
              <DialogDescription>
                {editingOffice ? 'Update the office details' : 'Add a new office or unit to your system'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Office Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter office name"
                  className="form-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location"
                  className="form-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'inactive') => 
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="form-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingOffice ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search offices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 form-input"
        />
      </div>

      {filteredOffices.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/50 mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? 'No offices found' : 'No offices yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? 'Try adjusting your search query' 
              : 'Create your first office to start managing gates, stores, and departments'}
          </p>
          {!searchQuery && (
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Office
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOffices.map((office, index) => (
            <div 
              key={office.id}
              className="office-card animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="office-card-header">
                <div className="icon-container">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{office.name}</h3>
                  {office.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{office.location}</span>
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(office)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(office)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div 
                className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => navigate(`/admin/offices/${office.id}`)}
              >
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-secondary/50">
                    <DoorOpen className="h-5 w-5 mx-auto text-info mb-1" />
                    <p className="text-lg font-bold text-foreground">{office.gates_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Gates</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/50">
                    <Store className="h-5 w-5 mx-auto text-success mb-1" />
                    <p className="text-lg font-bold text-foreground">{office.stores_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Stores</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/50">
                    <Users className="h-5 w-5 mx-auto text-warning mb-1" />
                    <p className="text-lg font-bold text-foreground">{office.departments_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Depts</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    office.status === 'active' ? 'status-active' : 'status-inactive'
                  }`}>
                    {office.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click to manage
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OfficesPage;
