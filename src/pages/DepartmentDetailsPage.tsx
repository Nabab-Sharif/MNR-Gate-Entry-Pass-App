import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import ProductCard from '@/components/ProductCard';
import GatePassCard from '@/components/GatePassCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import GateEntryPrintDialog from '@/components/GateEntryPrintDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  Package,
  FileText,
  Loader2,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { startOfDay, endOfDay } from 'date-fns';
 
 interface Department {
   id: string;
   name: string;
   office_id: string;
   offices?: { name: string };
 }
 
 interface Product {
   id: string;
   name: string;
   quantity: number;
   status: string;
   image_url: string;
   phone: string | null;
   office_id: string;
   sender_name: string | null;
   receiver_name: string | null;
   created_at: string;
   departments?: { name: string };
   gates?: { name: string };
 }
 
 interface GatePass {
   id: string;
   product_name: string;
   quantity: number;
   status: string;
   purpose: string;
   office_id: string;
   sender_name: string | null;
   receiver_name: string | null;
   created_at: string;
   departments?: { name: string };
   stores?: { name: string };
 }
 
 const DepartmentDetailsPage: React.FC = () => {
   const { departmentId } = useParams<{ departmentId: string }>();
   const navigate = useNavigate();
   const [department, setDepartment] = useState<Department | null>(null);
   const [products, setProducts] = useState<Product[]>([]);
   const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
   const [loading, setLoading] = useState(true);
   const [userName, setUserName] = useState('');
   const [showPrint, setShowPrint] = useState(false);
   const [currentRole, setCurrentRole] = useState<'gate' | 'store' | 'department'>('department');
 
   // Search and filter state
   const [searchValue, setSearchValue] = useState('');
   const [statusFilter, setStatusFilter] = useState('all');
   const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
     from: undefined,
     to: undefined
   });
 
   useEffect(() => {
     if (departmentId) {
       fetchData();
     }
   }, [departmentId]);
 
   const fetchData = async () => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
         setUserName(user.user_metadata?.name || 'User');
         const role = user.user_metadata?.role;
         if (role === 'gate' || role === 'store' || role === 'department') {
           setCurrentRole(role);
         } else {
           setCurrentRole('department');
         }
       }
 
       // Fetch department info
       const { data: deptData } = await supabase
         .from('departments')
         .select('*, offices(name)')
         .eq('id', departmentId)
         .single();
 
       if (deptData) {
         setDepartment(deptData);
 
         // Fetch products for this department
         const { data: productData } = await supabase
           .from('products')
           .select('*, departments(name, whatsapp_number), gates(name, whatsapp_number), stores(name, whatsapp_number)')
           .eq('department_id', departmentId)
           .order('created_at', { ascending: false });

         setProducts(productData || []);

         // Fetch gate passes for this department
         const { data: passData } = await supabase
           .from('gate_passes')
           .select('*, departments(name, whatsapp_number), stores(name, whatsapp_number), gates(name, whatsapp_number)')
           .eq('department_id', departmentId)
           .order('created_at', { ascending: false });
 
         setGatePasses(passData || []);
       }
     } catch (error) {
       console.error('Error fetching data:', error);
       toast.error('Failed to load department data');
     } finally {
       setLoading(false);
     }
   };
 
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
 
   const statusOptions = [
     { value: 'entered', label: 'Entered' },
     { value: 'on_the_way_store', label: 'On The Way' },
     { value: 'in_store', label: 'In Store' },
     { value: 'received', label: 'Received' },
   ];
 
   if (loading) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!department) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <p className="text-muted-foreground">Department not found</p>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background">
       <Header />
 
       <main className="w-full py-4 sm:py-6 px-2 sm:px-4 md:px-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="icon-container w-10 h-10 sm:w-12 sm:h-12 bg-warning">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-warning-foreground" />
              </div>
              <div>
                <h1 className="page-title text-lg sm:text-xl">{department.name}</h1>
                <p className="page-description text-xs sm:text-sm">
                  {department.offices?.name || 'Office'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPrint(true)}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
 
         {/* Stats Cards */}
         <div className="grid grid-cols-2 gap-3 mb-6">
           <Card className="border-border/50 bg-info/5">
             <CardContent className="p-4 flex items-center gap-3">
               <div className="p-2 rounded-lg bg-info/10">
                 <Package className="h-5 w-5 text-info" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-info">{products.length}</p>
                 <p className="text-xs text-muted-foreground">Gate Entries</p>
               </div>
             </CardContent>
           </Card>
           <Card className="border-border/50 bg-success/5">
             <CardContent className="p-4 flex items-center gap-3">
               <div className="p-2 rounded-lg bg-success/10">
                 <FileText className="h-5 w-5 text-success" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-success">{gatePasses.length}</p>
                 <p className="text-xs text-muted-foreground">Gate Passes</p>
               </div>
             </CardContent>
           </Card>
         </div>
 
         {/* Search & Filter */}
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
 
         <Tabs defaultValue="entries" className="mt-6">
           <TabsList className="mb-4">
             <TabsTrigger value="entries" className="gap-2">
               <Package className="h-4 w-4" />
               Entries ({filteredProducts.length})
             </TabsTrigger>
             <TabsTrigger value="passes" className="gap-2">
               <FileText className="h-4 w-4" />
               Passes ({filteredPasses.length})
             </TabsTrigger>
           </TabsList>
 
           <TabsContent value="entries">
             {filteredProducts.length === 0 ? (
               <div className="text-center py-12">
                 <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                 <p className="text-muted-foreground">No gate entries found</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                 {filteredProducts.map((product) => (
                   <ProductCard
                     key={product.id}
                     product={product}
                     userRole={currentRole}
                     userName={userName}
                     onStatusUpdate={fetchData}
                   />
                 ))}
               </div>
             )}
           </TabsContent>
 
           <TabsContent value="passes">
             {filteredPasses.length === 0 ? (
               <div className="text-center py-12">
                 <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                 <p className="text-muted-foreground">No gate passes found</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                 {filteredPasses.map((pass) => (
                   <GatePassCard
                     key={pass.id}
                     gatePass={pass}
                     userRole={currentRole}
                     userName={userName}
                     onStatusUpdate={fetchData}
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
        </main>
      </div>
    );
  };

  export default DepartmentDetailsPage;