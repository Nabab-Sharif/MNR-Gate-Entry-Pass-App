import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/ProductCard';
import GatePassCard from '@/components/GatePassCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import GateEntryPrintDialog from '@/components/GateEntryPrintDialog';
import GateEntryEditDialog from '@/components/GateEntryEditDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  ArrowLeft,
  Users,
  Package,
  FileText,
  Loader2,
  Building2,
  Printer,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { startOfDay, endOfDay, format } from 'date-fns';
import { exportToExcel } from '@/utils/exportToExcel';

interface Department {
  id: string;
  name: string;
  department_code: string;
  office_id: string;
  offices?: { name: string };
}

const AdminDepartmentDataPage: React.FC = () => {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<Department | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  const fetchData = useCallback(async () => {
    if (!departmentId) return;
    
    try {
      const { data: deptData } = await supabase
        .from('departments')
        .select('*, offices(name)')
        .eq('id', departmentId)
        .single();

      if (deptData) {
        setDepartment(deptData);

        const [productRes, passRes, allDeptsRes] = await Promise.all([
          supabase
            .from('products')
            .select('*, departments(name, whatsapp_number), gates(name, whatsapp_number), stores(name, whatsapp_number)')
            .eq('department_id', departmentId)
            .order('created_at', { ascending: false }),
          supabase
            .from('gate_passes')
            .select('*, departments(name, whatsapp_number), stores(name, whatsapp_number), gates(name, whatsapp_number)')
            .eq('department_id', departmentId)
            .order('created_at', { ascending: false }),
          supabase
            .from('departments')
            .select('id, name')
            .eq('office_id', deptData.office_id)
        ]);

        setProducts(productRes.data || []);
        setGatePasses(passRes.data || []);
        setDepartments(allDeptsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching department data:', error);
      toast.error('Failed to load department data');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (departmentId) fetchData();
  }, [departmentId, fetchData]);

  // Real-time updates
  useRealtimeSubscription({
    table: 'products',
    onInsert: fetchData,
    onUpdate: fetchData,
    onDelete: fetchData,
    enabled: !!departmentId
  });

  useRealtimeSubscription({
    table: 'gate_passes',
    onInsert: fetchData,
    onUpdate: fetchData,
    onDelete: fetchData,
    enabled: !!departmentId
  });

  const filterItems = <T extends { name?: string; product_name?: string; status: string; created_at: string }>(items: T[]) => {
    return items.filter(item => {
      const name = ('name' in item ? item.name : item.product_name) || '';
      const matchesSearch = name.toLowerCase().includes(searchValue.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      let matchesDate = true;
      if (dateRange.from) {
        const itemDate = new Date(item.created_at);
        matchesDate = itemDate >= startOfDay(dateRange.from);
        if (dateRange.to) {
          matchesDate = matchesDate && itemDate <= endOfDay(dateRange.to);
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const filteredProducts = filterItems(products);
  const filteredPasses = filterItems(gatePasses);

  const handleExportProducts = () => {
    if (filteredProducts.length === 0) {
      toast.error('No data to export');
      return;
    }
    const columns = [
      { key: 'name', label: 'Product Name' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'sender_name', label: 'Sender' },
      { key: 'receiver_name', label: 'Receiver' },
      { key: 'departments.name', label: 'Department' },
      { key: 'created_at', label: 'Entry Date', format: (d: string) => d ? format(new Date(d), 'dd/MM/yyyy') : '' },
    ];
    exportToExcel(filteredProducts, columns, `dept-entries`);
    toast.success('Exported successfully');
  };

  const handleExportPasses = () => {
    if (filteredPasses.length === 0) {
      toast.error('No data to export');
      return;
    }
    const columns = [
      { key: 'product_name', label: 'Product Name' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'stores.name', label: 'Store' },
      { key: 'departments.name', label: 'Department' },
      { key: 'created_at', label: 'Created Date', format: (d: string) => d ? format(new Date(d), 'dd/MM/yyyy') : '' },
    ];
    exportToExcel(filteredPasses, columns, `dept-gate-passes`);
    toast.success('Exported successfully');
  };

  const statusOptions = [
    { value: 'entered', label: 'Entered' },
    { value: 'on_the_way_store', label: 'On The Way' },
    { value: 'received', label: 'Received' },
    { value: 'know_about', label: 'Acknowledged' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Department not found</h2>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="self-start">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="icon-container flex-shrink-0" style={{ background: 'linear-gradient(135deg, hsl(38 92% 50%), hsl(38 80% 45%))' }}>
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">{department.name}</h1>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{department.offices?.name}</span>
              <span className="mx-1">•</span>
              <code className="text-[10px] sm:text-xs bg-secondary px-1.5 py-0.5 rounded">{department.department_code}</code>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPrint(true)}>
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">Print</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50 bg-info/5">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10 flex-shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-info">{products.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Gate Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-success/5">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 flex-shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-success">{gatePasses.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Gate Passes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SearchFilterBar
        searchPlaceholder="Search by name..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusOptions={statusOptions}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showDateFilter
      />

      <Tabs defaultValue="entries">
        <TabsList className="mb-4 w-full sm:w-auto">
          <TabsTrigger value="entries" className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Entries ({filteredProducts.length})
          </TabsTrigger>
          <TabsTrigger value="passes" className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Passes ({filteredPasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportProducts}>
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Export Excel</span>
            </Button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No gate entries found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  userRole="department"
                  userName="Admin"
                  onStatusUpdate={fetchData}
                  showEditButton
                  showDeleteButton
                  onEdit={() => setEditProduct(product)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="passes">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPasses}>
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Export Excel</span>
            </Button>
          </div>

          {filteredPasses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No gate passes found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPasses.map((pass) => (
                <GatePassCard
                  key={pass.id}
                  gatePass={pass}
                  userRole="department"
                  userName="Admin"
                  onStatusUpdate={fetchData}
                  showEditButton
                  showDeleteButton
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GateEntryPrintDialog
        open={showPrint}
        onOpenChange={setShowPrint}
        products={products}
        gateName={department.name}
        officeName={department.offices?.name || 'Office'}
      />

      {editProduct && (
        <GateEntryEditDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          product={editProduct}
          departments={departments}
          onUpdate={() => {
            setEditProduct(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default AdminDepartmentDataPage;
