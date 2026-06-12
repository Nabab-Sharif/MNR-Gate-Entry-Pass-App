 import React, { useState } from 'react';
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
 import { Loader2, Save, Pencil } from 'lucide-react';
 import { toast } from 'sonner';
 
 interface Department {
   id: string;
   name: string;
 }
 
 interface Product {
   id: string;
   name: string;
   quantity: number;
   status: string;
   image_url: string;
   office_id: string;
   sender_name: string | null;
   receiver_name: string | null;
   remarks?: string | null;
   department_id?: string | null;
   departments?: { name: string };
 }
 
 interface GateEntryEditDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   product: Product;
   departments: Department[];
   onUpdate: () => void;
 }
 
 const GateEntryEditDialog: React.FC<GateEntryEditDialogProps> = ({
   open,
   onOpenChange,
   product,
   departments,
   onUpdate
 }) => {
   const [saving, setSaving] = useState(false);
   const [formData, setFormData] = useState({
     name: product.name,
     quantity: product.quantity.toString(),
     sender_name: product.sender_name || '',
     receiver_name: product.receiver_name || '',
     remarks: product.remarks || '',
     department_id: product.department_id || ''
   });
 
   const handleSave = async () => {
     setSaving(true);
     try {
       const { error } = await supabase
         .from('products')
         .update({
           name: formData.name,
           quantity: parseInt(formData.quantity) || 1,
           sender_name: formData.sender_name || null,
           receiver_name: formData.receiver_name || null,
           remarks: formData.remarks || null,
           department_id: formData.department_id || null
         })
         .eq('id', product.id);
 
       if (error) throw error;
 
       toast.success('Entry updated successfully');
       onUpdate();
       onOpenChange(false);
     } catch (error) {
       console.error('Error updating entry:', error);
       toast.error('Failed to update entry');
     } finally {
       setSaving(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto border border-primary/20 rounded-lg shadow-lg">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Pencil className="h-5 w-5 text-primary" />
             Edit Gate Entry
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           <div className="space-y-2">
             <Label>Product Name</Label>
             <Input
               value={formData.name}
               onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
               placeholder="Product name"
             />
           </div>
 
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label>Quantity</Label>
               <Input
                 type="number"
                 min="1"
                 value={formData.quantity}
                 onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
               />
             </div>
             <div className="space-y-2">
               <Label>Department</Label>
               <Select
                 value={formData.department_id}
                 onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select" />
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
           </div>
 
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label>Sender Name</Label>
               <Input
                 value={formData.sender_name}
                 onChange={(e) => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                 placeholder="Sender"
               />
             </div>
             <div className="space-y-2">
               <Label>Receiver Name</Label>
               <Input
                 value={formData.receiver_name}
                 onChange={(e) => setFormData(prev => ({ ...prev, receiver_name: e.target.value }))}
                 placeholder="Receiver"
               />
             </div>
           </div>
 
           <div className="space-y-2">
             <Label>Remarks</Label>
             <Textarea
               value={formData.remarks}
               onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
               placeholder="Additional notes"
               rows={2}
             />
           </div>
         </div>
 
         <div className="flex justify-end gap-2">
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button onClick={handleSave} disabled={saving}>
             {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
             Save Changes
           </Button>
         </div>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default GateEntryEditDialog;