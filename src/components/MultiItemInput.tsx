import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Package } from 'lucide-react';

export interface ItemEntry {
  id: string;
  name: string;
  quantity: number;
}

interface MultiItemInputProps {
  items: ItemEntry[];
  onChange: (items: ItemEntry[]) => void;
  productLabel?: string;
}

const MultiItemInput: React.FC<MultiItemInputProps> = ({ items, onChange, productLabel = 'Product' }) => {
  const addItem = () => {
    onChange([...items, { id: crypto.randomUUID(), name: '', quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    onChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: 'name' | 'quantity', value: string | number) => {
    onChange(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Package className="h-4 w-4 text-primary" />
          {productLabel}s
        </label>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Total Qty: <strong>{totalQuantity}</strong>
        </span>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
          <span className="text-xs text-muted-foreground w-5 text-center font-medium">{index + 1}</span>
          <Input
            value={item.name}
            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
            placeholder={`${productLabel} name`}
            className="flex-1 h-9 text-sm"
          />
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
            className="w-20 h-9 text-sm text-center"
            placeholder="Qty"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => removeItem(item.id)}
            disabled={items.length <= 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs h-8 border-dashed"
        onClick={addItem}
      >
        <Plus className="h-3.5 w-3.5" />
        Add {productLabel}
      </Button>
    </div>
  );
};

export default MultiItemInput;
