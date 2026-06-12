import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  ArrowLeft, 
  Building2, 
  DoorOpen, 
  Store as StoreIcon, 
  Users,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  MapPin,
  Loader2,
  Phone,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getCached, setCached } from '@/lib/indexedDBCache';

type EntityType = 'gate' | 'store' | 'department';

interface Office {
  id: string;
  name: string;
  location: string | null;
  status: string | null;
}

interface Gate {
  id: string;
  name: string;
  gate_code: string;
  status: string | null;
  office_id: string;
  whatsapp_number?: string | null;
}

interface Store {
  id: string;
  name: string;
  store_code: string;
  status: string | null;
  office_id: string;
  whatsapp_number?: string | null;
}

interface Department {
  id: string;
  name: string;
  department_code: string;
  status: string | null;
  office_id: string;
  whatsapp_number?: string | null;
}

interface EntityFormData {
  name: string;
  entityId: string;
  status: 'active' | 'inactive';
  whatsapp_numbers: string[];
}

const OfficeDashboard: React.FC = () => {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();

  const [office, setOffice] = useState<Office | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState<EntityType>('gate');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Gate | Store | Department | null>(null);
  const [formData, setFormData] = useState<EntityFormData>({
    name: '',
    entityId: '',
    status: 'active',
    whatsapp_numbers: [],
  });
  const [newWhatsappNumber, setNewWhatsappNumber] = useState('');
  const [editingWhatsappIndex, setEditingWhatsappIndex] = useState<number | null>(null);
  const [editingWhatsappValue, setEditingWhatsappValue] = useState('');

  const fetchOfficeData = async () => {
    if (!officeId) return;

    try {
      const [cachedOffices, cachedGates, cachedStores, cachedDepartments] = await Promise.all([
        getCached<Office>('offices'),
        getCached<Gate>('gates', 'office_id', officeId),
        getCached<Store>('stores', 'office_id', officeId),
        getCached<Department>('departments', 'office_id', officeId),
      ]);
      const cachedOffice = cachedOffices.find((item) => item.id === officeId);
      if (cachedOffice || cachedGates.length || cachedStores.length || cachedDepartments.length) {
        if (cachedOffice) setOffice(cachedOffice);
        if (cachedGates.length) setGates(cachedGates);
        if (cachedStores.length) setStores(cachedStores);
        if (cachedDepartments.length) setDepartments(cachedDepartments);
        setLoading(false);
      }

      const [officeRes, gatesRes, storesRes, deptsRes] = await Promise.all([
        supabase.from('offices').select('*').eq('id', officeId).single(),
        supabase.from('gates').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
        supabase.from('stores').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
        supabase.from('departments').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
      ]);

      if (officeRes.error) throw officeRes.error;
      
      setOffice(officeRes.data);
      setGates(gatesRes.data || []);
      setStores(storesRes.data || []);
      setDepartments(deptsRes.data || []);
      void setCached('offices', [officeRes.data]);
      void setCached('gates', gatesRes.data || [], 'office_id', officeId);
      void setCached('stores', storesRes.data || [], 'office_id', officeId);
      void setCached('departments', deptsRes.data || [], 'office_id', officeId);
    } catch (error) {
      console.error('Error fetching office data:', error);
      toast.error('Failed to load office data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficeData();
  }, [officeId]);

  useRealtimeSubscription({
    table: 'gates',
    onInsert: () => fetchOfficeData(),
    onUpdate: () => fetchOfficeData(),
    onDelete: () => fetchOfficeData()
  });

  useRealtimeSubscription({
    table: 'stores',
    onInsert: () => fetchOfficeData(),
    onUpdate: () => fetchOfficeData(),
    onDelete: () => fetchOfficeData()
  });

  useRealtimeSubscription({
    table: 'departments',
    onInsert: () => fetchOfficeData(),
    onUpdate: () => fetchOfficeData(),
    onDelete: () => fetchOfficeData()
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!office) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-foreground mb-2">Office not found</h2>
        <Button variant="outline" onClick={() => navigate('/admin/offices')}>
          Back to Offices
        </Button>
      </div>
    );
  }

  const generateId = () => {
    const prefix = activeTab.toUpperCase().slice(0, 3);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    const accessId = formData.entityId.trim() || generateId();

    setSaving(true);

    try {
      const whatsappValue = formData.whatsapp_numbers.filter(n => n.trim()).join(', ') || null;
      
      if (editingEntity) {
        // Update existing entity
        let error;
        switch (activeTab) {
          case 'gate':
            ({ error } = await supabase
              .from('gates')
              .update({ name: formData.name, gate_code: accessId, status: formData.status, whatsapp_number: whatsappValue })
              .eq('id', editingEntity.id));
            break;
          case 'store':
            ({ error } = await supabase
              .from('stores')
              .update({ name: formData.name, store_code: accessId, status: formData.status, whatsapp_number: whatsappValue })
              .eq('id', editingEntity.id));
            break;
          case 'department':
            ({ error } = await supabase
              .from('departments')
              .update({ name: formData.name, department_code: accessId, status: formData.status, whatsapp_number: whatsappValue })
              .eq('id', editingEntity.id));
            break;
        }
        if (error) throw error;
        toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} updated`);
      } else {
        // Create new entity
        let error;
        switch (activeTab) {
          case 'gate':
            ({ error } = await supabase
              .from('gates')
              .insert({ name: formData.name, gate_code: accessId, status: formData.status, office_id: officeId, whatsapp_number: whatsappValue }));
            break;
          case 'store':
            ({ error } = await supabase
              .from('stores')
              .insert({ name: formData.name, store_code: accessId, status: formData.status, office_id: officeId, whatsapp_number: whatsappValue }));
            break;
          case 'department':
            ({ error } = await supabase
              .from('departments')
              .insert({ name: formData.name, department_code: accessId, status: formData.status, office_id: officeId, whatsapp_number: whatsappValue }));
            break;
        }
        if (error) throw error;
        toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} created`);
      }

      setIsDialogOpen(false);
      setEditingEntity(null);
      setFormData({ name: '', entityId: '', status: 'active', whatsapp_numbers: [] });
      setNewWhatsappNumber('');
      fetchOfficeData();
    } catch (error: any) {
      console.error('Error saving entity:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entity: Gate | Store | Department, type: EntityType) => {
    setActiveTab(type);
    setEditingEntity(entity);
    setFormData({
      name: entity.name,
      entityId: type === 'gate' 
        ? (entity as Gate).gate_code 
        : type === 'store' 
          ? (entity as Store).store_code 
          : (entity as Department).department_code,
      status: (entity.status as 'active' | 'inactive') || 'active',
      whatsapp_numbers: (entity as any).whatsapp_number 
        ? (entity as any).whatsapp_number.split(',').map((n: string) => n.trim()).filter(Boolean)
        : [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entity: Gate | Store | Department, type: EntityType) => {
    if (window.confirm(`Are you sure you want to delete "${entity.name}"?`)) {
      try {
        let error;
        switch (type) {
          case 'gate':
            ({ error } = await supabase.from('gates').delete().eq('id', entity.id));
            break;
          case 'store':
            ({ error } = await supabase.from('stores').delete().eq('id', entity.id));
            break;
          case 'department':
            ({ error } = await supabase.from('departments').delete().eq('id', entity.id));
            break;
        }
        if (error) throw error;
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
        fetchOfficeData();
      } catch (error: any) {
        console.error('Error deleting entity:', error);
        toast.error(error.message || 'Failed to delete');
      }
    }
  };

  const openCreateDialog = () => {
    setEditingEntity(null);
    setFormData({ name: '', entityId: generateId(), status: 'active', whatsapp_numbers: [] });
    setIsDialogOpen(true);
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copied to clipboard');
  };

  const getEntityLabel = () => {
    switch (activeTab) {
      case 'gate': return 'Gate';
      case 'store': return 'Store';
      case 'department': return 'Department';
    }
  };

  const renderEntityList = (entities: (Gate | Store | Department)[], type: EntityType) => {
    const getEntityId = (entity: Gate | Store | Department) => {
      switch (type) {
        case 'gate': return (entity as Gate).gate_code;
        case 'store': return (entity as Store).store_code;
        case 'department': return (entity as Department).department_code;
      }
    };

    const getIcon = () => {
      switch (type) {
        case 'gate': return <DoorOpen className="h-5 w-5 text-primary-foreground" />;
        case 'store': return <StoreIcon className="h-5 w-5 text-primary-foreground" />;
        case 'department': return <Users className="h-5 w-5 text-primary-foreground" />;
      }
    };

    if (entities.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/50 mb-4">
            {type === 'gate' && <DoorOpen className="h-7 w-7 text-muted-foreground" />}
            {type === 'store' && <StoreIcon className="h-7 w-7 text-muted-foreground" />}
            {type === 'department' && <Users className="h-7 w-7 text-muted-foreground" />}
          </div>
          <h3 className="font-semibold text-foreground mb-2">No {type}s yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first {type} for this office
          </p>
          <Button onClick={openCreateDialog} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add {getEntityLabel()}
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entities.map((entity, index) => (
          <div 
            key={entity.id}
            className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="icon-container">
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{entity.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-secondary px-2 py-0.5 rounded font-mono text-muted-foreground">
                  {getEntityId(entity)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => copyId(getEntityId(entity))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              entity.status === 'active' ? 'status-active' : 'status-inactive'
            }`}>
              {entity.status}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(entity, type)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDelete(entity, type)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/admin/offices')}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="icon-container">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{office.name}</h1>
              {office.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{office.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full ${
          office.status === 'active' ? 'status-active' : 'status-inactive'
        }`}>
          {office.status}
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityType)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="h-auto p-1">
            <TabsTrigger value="gate" className="gap-2 px-4">
              <DoorOpen className="h-4 w-4" />
              Gates ({gates.length})
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-2 px-4">
              <StoreIcon className="h-4 w-4" />
              Stores ({stores.length})
            </TabsTrigger>
            <TabsTrigger value="department" className="gap-2 px-4">
              <Users className="h-4 w-4" />
              Departments ({departments.length})
            </TabsTrigger>
          </TabsList>

          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add {getEntityLabel()}
          </Button>
        </div>

        <TabsContent value="gate" className="mt-6">
          {renderEntityList(gates, 'gate')}
        </TabsContent>
        <TabsContent value="store" className="mt-6">
          {renderEntityList(stores, 'store')}
        </TabsContent>
        <TabsContent value="department" className="mt-6">
          {renderEntityList(departments, 'department')}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntity ? `Edit ${getEntityLabel()}` : `Create New ${getEntityLabel()}`}
            </DialogTitle>
            <DialogDescription>
              {editingEntity 
                ? `Update the ${activeTab} details` 
                : `Add a new ${activeTab} to ${office.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">{getEntityLabel()} Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Enter ${activeTab} name`}
                className="form-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="entityId">{getEntityLabel()} ID</Label>
              <div className="flex gap-2">
                <Input
                  id="entityId"
                  value={formData.entityId}
                  onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                  placeholder={`Enter ${activeTab} ID`}
                  className="form-input font-mono"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setFormData({ ...formData, entityId: generateId() })}
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Blank rakhle automatic ID create hobe. Je digit/letter diben, shetai login ID hobe.
              </p>
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

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                WhatsApp Numbers
              </Label>
              
              {/* Existing numbers */}
              {formData.whatsapp_numbers.map((num, index) => (
                <div key={index} className="flex items-center gap-2">
                  {editingWhatsappIndex === index ? (
                    <>
                      <Input
                        value={editingWhatsappValue}
                        onChange={(e) => setEditingWhatsappValue(e.target.value)}
                        placeholder="e.g. 8801XXXXXXXXX"
                        className="form-input flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (editingWhatsappValue.trim()) {
                            const updated = [...formData.whatsapp_numbers];
                            updated[index] = editingWhatsappValue.trim();
                            setFormData({ ...formData, whatsapp_numbers: updated });
                          }
                          setEditingWhatsappIndex(null);
                          setEditingWhatsappValue('');
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingWhatsappIndex(null); setEditingWhatsappValue(''); }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {num}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => { setEditingWhatsappIndex(index); setEditingWhatsappValue(num); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          const updated = formData.whatsapp_numbers.filter((_, i) => i !== index);
                          setFormData({ ...formData, whatsapp_numbers: updated });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {/* Add new number */}
              <div className="flex items-center gap-2">
                <Input
                  value={newWhatsappNumber}
                  onChange={(e) => setNewWhatsappNumber(e.target.value)}
                  placeholder="e.g. 8801XXXXXXXXX"
                  className="form-input flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newWhatsappNumber.trim()) {
                        setFormData({ ...formData, whatsapp_numbers: [...formData.whatsapp_numbers, newWhatsappNumber.trim()] });
                        setNewWhatsappNumber('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (newWhatsappNumber.trim()) {
                      setFormData({ ...formData, whatsapp_numbers: [...formData.whatsapp_numbers, newWhatsappNumber.trim()] });
                      setNewWhatsappNumber('');
                    }
                  }}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Multiple WhatsApp numbers can be added for notifications
              </p>
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
                  editingEntity ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfficeDashboard;
