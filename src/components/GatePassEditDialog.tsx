import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface GatePass {
  id: string;
  product_name: string;
  quantity: number;
  purpose: string;
  sender_name: string | null;
  receiver_name: string | null;
  remarks?: string | null;
  department_id?: string | null;
  store_id?: string | null;
  office_id: string;
}

interface GatePassEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatePass: GatePass;
  onSave?: () => void;
}

const GatePassEditDialog: React.FC<GatePassEditDialogProps> = ({
  open,
  onOpenChange,
  gatePass,
  onSave
}) => {
  const [formData, setFormData] = useState({
    product_name: '',
    quantity: 1,
    purpose: '',
    sender_name: '',
    receiver_name: '',
    remarks: '',
    department_id: '',
    store_id: ''
  });
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (gatePass) {
      setFormData({
        product_name: gatePass.product_name || '',
        quantity: gatePass.quantity || 1,
        purpose: gatePass.purpose || '',
        sender_name: gatePass.sender_name || '',
        receiver_name: gatePass.receiver_name || '',
        remarks: gatePass.remarks || '',
        department_id: gatePass.department_id || '',
        store_id: gatePass.store_id || ''
      });
      fetchOptions();
    }
  }, [gatePass]);

  const fetchOptions = async () => {
    const [deptRes, storeRes] = await Promise.all([
      supabase
        .from('departments')
        .select('id, name')
        .eq('office_id', gatePass.office_id)
        .eq('status', 'active'),
      supabase
        .from('stores')
        .select('id, name')
        .eq('office_id', gatePass.office_id)
        .eq('status', 'active')
    ]);
    setDepartments(deptRes.data || []);
    setStores(storeRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_name.trim()) {
      toast.error('Product name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('gate_passes')
        .update({
          product_name: formData.product_name.trim(),
          quantity: formData.quantity,
          purpose: formData.purpose.trim(),
          sender_name: formData.sender_name.trim() || null,
          receiver_name: formData.receiver_name.trim() || null,
          remarks: formData.remarks.trim() || null,
          department_id: formData.department_id || null,
          store_id: formData.store_id || null
        })
        .eq('id', gatePass.id);

      if (error) throw error;

      toast.success('Gate pass updated successfully');
      onOpenChange(false);
      onSave?.();
    } catch (error: any) {
      console.error('Error updating gate pass:', error);
      toast.error(error.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto border border-primary/20 rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Edit Gate Pass
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              placeholder="Enter product name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Purpose"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sender Name</Label>
              <Input
                value={formData.sender_name}
                onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                placeholder="Sender"
              />
            </div>
            <div className="space-y-2">
              <Label>Receiver Name</Label>
              <Input
                value={formData.receiver_name}
                onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                placeholder="Receiver"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={formData.department_id}
              onValueChange={(value) => setFormData({ ...formData, department_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Store</Label>
            <Select
              value={formData.store_id}
              onValueChange={(value) => setFormData({ ...formData, store_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GatePassEditDialog;
