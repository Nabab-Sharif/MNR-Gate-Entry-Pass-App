import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import CameraCapture from '@/components/CameraCapture';
import ProductCard from '@/components/ProductCard';
import GatePassCard from '@/components/GatePassCard';
import ChatDialog from '@/components/ChatDialog';
import MultiItemInput, { ItemEntry } from '@/components/MultiItemInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  DoorOpen, 
  Camera, 
  Send, 
  Building2,
  FileText,
  Loader2,
  Package,
  MessageSquare,
  Store as StoreIcon,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription, useVoiceAlert } from '@/hooks/useRealtimeSubscription';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchFilterBar from '@/components/SearchFilterBar';
import GateEntryEditDialog from '@/components/GateEntryEditDialog';
import { sendNotificationsToEntities } from '@/utils/sendNotification';
import { getCached, setCached, upsertCached, deleteCached } from '@/lib/indexedDBCache';
import GateEntryPrintDialog from '@/components/GateEntryPrintDialog';
import DepartmentStatsCard from '@/components/DepartmentStatsCard';
import MobileStatsMenu from '@/components/MobileStatsMenu';
import { Printer, Pencil, Building, Search } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';

interface GateInfo {
  id: string;
  name: string;
  gate_code: string;
  office_id: string;
  offices?: { name: string };
}

interface Department {
  id: string;
  name: string;
  whatsapp_number?: string | null;
}

interface StoreInfo {
  id: string;
  name: string;
  whatsapp_number?: string | null;
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
  sender_company: string | null;
  receiver_company: string | null;
  created_at: string;
  departments?: { name: string };
  gates?: { name: string };
  product_items?: { id: string; name: string; quantity: number }[];
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
  sender_company: string | null;
  receiver_company: string | null;
  created_at: string;
  created_by?: string | null;
  departments?: { name: string; user_id?: string | null };
  stores?: { name: string; user_id?: string | null };
  gate_pass_items?: { id: string; name: string; quantity: number }[];
}

const GatePage: React.FC = () => {
  const [gateInfo, setGateInfo] = useState<GateInfo | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printMode, setPrintMode] = useState<'entries' | 'passes'>('entries');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightProductId = searchParams.get('highlight_product');
  const highlightGatePassId = searchParams.get('highlight_gatepass');

  // Clear highlight params after reading
  useEffect(() => {
    if (highlightProductId || highlightGatePassId) {
      // Switch to the appropriate tab based on the highlighted item
      if (highlightGatePassId) {
        setActiveTab("gatepass");
      } else if (highlightProductId) {
        setActiveTab("products");
      }
      // Make sure the highlighted item is on the current page so it can auto-open
      if (highlightGatePassId) {
        const highlightedIndex = gatePasses.findIndex((gp) => gp.id === highlightGatePassId);
        if (highlightedIndex >= 0) {
          setGatePassPage(Math.floor(highlightedIndex / ITEMS_PER_PAGE) + 1);
        }
      } else if (highlightProductId) {
        const highlightedIndex = products.findIndex((p) => p.id === highlightProductId);
        if (highlightedIndex >= 0) {
          setProductPage(Math.floor(highlightedIndex / ITEMS_PER_PAGE) + 1);
        }
      }

      const timeout = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [highlightProductId, highlightGatePassId, setSearchParams]);

  // Search and filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [statsFilter, setStatsFilter] = useState<'all' | 'today' | 'pending' | 'today-pending'>("all");
  const [departmentSearch, setDepartmentSearch] = useState('');
  
  // Pagination state
  const [gatePassPage, setGatePassPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  
  // Gate pass search and filter
  const [gatePassSearch, setGatePassSearch] = useState('');
  const [gatePassStatusFilter, setGatePassStatusFilter] = useState('all');

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsType, setDetailsType] = useState<'total-entries' | 'today-entries' | 'pending-entries' | 'total-passes' | 'today-passes' | 'pending-passes' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  // Scroll to top state
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Active tab state (controlled so we can switch from buttons)
  const [activeTab, setActiveTab] = useState<string>('products');

  // Form state
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [remarks, setRemarks] = useState('');
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [receiverCompany, setReceiverCompany] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [productItems, setProductItems] = useState<ItemEntry[]>([
    { id: crypto.randomUUID(), name: '', quantity: 1 }
  ]);

  const getFirstWhatsAppNumber = (whatsapp?: string | null) => {
    const numbers = whatsapp
      ? whatsapp.split(',').map((num) => num.trim()).filter((item) => item.length > 0)
      : [];
    return numbers[0] || '';
  };

  const { playAlert } = useVoiceAlert();
  const { sendGateEntryAlert, sendGatePassAlert, sendProductStatusAlert, permission } = usePushNotifications();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await Promise.all([fetchGateInfo(session?.user), fetchUserInfo(session?.user)]);
    };
    init();
  }, []);

  // Scroll to top effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Department stats calculation
  const getDepartmentStats = () => {
    return departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      productCount: products.filter(p => p.departments?.name === dept.name).length,
      gatePassCount: gatePasses.filter(gp => gp.departments?.name === dept.name).length
    }));
  };

  const departmentStats = getDepartmentStats();
  const filteredDepartmentStats = departmentStats.filter(dept => dept.name.toLowerCase().includes(departmentSearch.toLowerCase()));

  // Filter products
  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        product.sender_name?.toLowerCase().includes(searchValue.toLowerCase()) ||
        product.receiver_name?.toLowerCase().includes(searchValue.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      
      let matchesDate = true;
      if (dateRange.from) {
        const productDate = new Date(product.created_at);
        matchesDate = productDate >= startOfDay(dateRange.from);
        if (dateRange.to) {
          matchesDate = matchesDate && productDate <= endOfDay(dateRange.to);
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const filteredProducts = getFilteredProducts();

  const statusOptions = [
    { value: 'entered', label: 'Entered' },
    { value: 'on_the_way_store', label: 'On The Way' },
    { value: 'in_store', label: 'In Store' },
    { value: 'received', label: 'Received' },
  ];

  // Filter gate passes
  const getFilteredGatePasses = () => {
    return gatePasses.filter(pass => {
      const matchesSearch = pass.product_name.toLowerCase().includes(gatePassSearch.toLowerCase()) ||
        pass.sender_name?.toLowerCase().includes(gatePassSearch.toLowerCase()) ||
        pass.receiver_name?.toLowerCase().includes(gatePassSearch.toLowerCase());
      
      const matchesStatus = gatePassStatusFilter === 'all' || pass.status === gatePassStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredGatePasses = getFilteredGatePasses();

  // Pagination helpers
  const getPaginatedItems = <T,>(items: T[], page: number) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items: any[]) => Math.ceil(items.length / ITEMS_PER_PAGE);

  const paginatedProducts = getPaginatedItems(filteredProducts, productPage);
  const paginatedGatePasses = getPaginatedItems(filteredGatePasses, gatePassPage);

  const gatePassStatusOptions = [
    { value: 'created', label: 'Created' },
    { value: 'approved', label: 'Approved' },
    { value: 'on_the_way', label: 'On The Way' },
    { value: 'received', label: 'Received' },
  ];

  // Stats calculation functions
  const getTodayDate = () => {
    const today = new Date();
    return startOfDay(today);
  };

  const getTodaysEntries = () => {
    const today = getTodayDate();
    return products.filter(p => new Date(p.created_at) >= today);
  };

  const getTodaysGatePasses = () => {
    const today = getTodayDate();
    return gatePasses.filter(gp => new Date(gp.created_at) >= today);
  };

  const getPendingProducts = () => {
    return products.filter(p => p.status === 'entered');
  };

  const getPendingGatePasses = () => {
    return gatePasses.filter(gp => gp.status === 'entered');
  };

  const getTodaysPendingProducts = () => {
    const today = getTodayDate();
    return products.filter(p => p.status === 'entered' && new Date(p.created_at) >= today);
  };

  const getTodaysPendingGatePasses = () => {
    const today = getTodayDate();
    return gatePasses.filter(gp => gp.status === 'entered' && new Date(gp.created_at) >= today);
  };

  const fetchUserInfo = async (sessionUser?: any) => {
    const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || 'Gate User');
    }
  };

  const fetchGateInfo = async (sessionUser?: any) => {
    try {
      const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
      if (!user) {
        return;
      }

      const cachedGate = (await getCached<GateInfo & { user_id?: string }>('gates', 'user_id', user.id))[0];
      if (cachedGate) setGateInfo(cachedGate);

      const entityId = user.user_metadata?.entity_id;
      let gate = cachedGate || null;
      
      const { data: gateByUser } = await supabase
        .from('gates')
        .select('*, offices(name)')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (gateByUser) {
        gate = gateByUser;
      } else if (entityId) {
        const { data: gateByEntity } = await supabase
          .from('gates')
          .select('*, offices(name)')
          .eq('id', entityId)
          .maybeSingle();
          
        if (gateByEntity) {
          gate = gateByEntity;
          await supabase.from('gates').update({ user_id: user.id }).eq('id', entityId);
        }
      }

      if (!gate) {
        toast.error('Gate not found. Please login again.');
        return;
      }

      setGateInfo(gate);

      if (gate?.office_id) {
        const [cachedDepts, cachedStores] = await Promise.all([
          getCached<Department>('departments', 'office_id', gate.office_id),
          getCached<StoreInfo>('stores', 'office_id', gate.office_id),
        ]);
        if (cachedDepts.length) setDepartments(cachedDepts);
        if (cachedStores.length) setStores(cachedStores);

        const [deptsRes, storesRes] = await Promise.all([
          supabase
            .from('departments')
            .select('id, name, whatsapp_number')
            .eq('office_id', gate.office_id)
            .eq('status', 'active'),
          supabase
            .from('stores')
            .select('id, name, whatsapp_number')
            .eq('office_id', gate.office_id)
            .eq('status', 'active'),
        ]);
        setDepartments(deptsRes.data || []);
        setStores(storesRes.data || []);
        void setCached('departments', deptsRes.data || [], 'office_id', gate.office_id);
        void setCached('stores', storesRes.data || [], 'office_id', gate.office_id);
      }

      await Promise.all([fetchProducts(gate.id), fetchGatePasses(gate.id)]);
    } catch (error) {
      console.error('Error fetching gate info:', error);
      toast.error('Failed to load gate information');
    }
  };

  const fetchProducts = async (gateId: string) => {
    // 1) Instant: load from IndexedDB so the UI renders immediately.
    const cached = await getCached<Product>('products', 'gate_id', gateId);
    if (cached.length) setProducts(cached);

    // 2) Silent: refresh from server in the background and merge.
    const { data } = await supabase
      .from('products')
      .select('*, departments(name, whatsapp_number), gates(name, whatsapp_number), stores(name, whatsapp_number), product_items(id, name, quantity)')
      .eq('gate_id', gateId)
      .order('created_at', { ascending: false });
    if (data) {
      setProducts(data);
      void setCached('products', data as any, 'gate_id', gateId);
    }
  };

  const fetchGatePasses = async (gateId: string) => {
    const cached = await getCached<GatePass>('gate_passes', 'gate_id', gateId);
    if (cached.length) setGatePasses(cached);

    const { data } = await supabase
      .from('gate_passes')
      .select('*, departments(name, whatsapp_number, user_id), stores(name, whatsapp_number, user_id), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)')
      .eq('gate_id', gateId)
      .order('created_at', { ascending: false });
    if (data) {
      setGatePasses(data);
      void setCached('gate_passes', data as any, 'gate_id', gateId);
    }
  };

  const fetchGatePassById = async (gatePassId: string) => {
    const { data } = await supabase
      .from('gate_passes')
      .select('*, departments(name, whatsapp_number, user_id), stores(name, whatsapp_number, user_id), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)')
      .eq('id', gatePassId)
      .single();
    return data;
  };

  // Realtime updates for products — granular, conflict-free merges.
  useRealtimeSubscription({
    table: 'products',
    filter: gateInfo ? { column: 'gate_id', value: gateInfo.id } : undefined,
    onInsert: (newProduct) => {
      setProducts(prev => prev.some(p => p.id === newProduct.id) ? prev : [newProduct, ...prev]);
      void upsertCached('products', newProduct);
      playAlert('New product entry');
      toast.info('New product entry!');
      if (permission === 'granted') {
        sendGateEntryAlert(newProduct.name, newProduct.sender_name, gateInfo?.name);
      }
    },
    onUpdate: (updated) => {
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      void upsertCached('products', updated);
      if (permission === 'granted') {
        sendProductStatusAlert(updated.name, updated.status);
      }
    },
    onDelete: (deleted) => {
      setProducts(prev => prev.filter(p => p.id !== deleted.id));
      void deleteCached('products', deleted.id);
    },
    enabled: !!gateInfo
  });

  // Realtime updates for gate passes
  useRealtimeSubscription({
    table: 'gate_passes',
    filter: gateInfo ? { column: 'gate_id', value: gateInfo.id } : undefined,
    onInsert: async (newPass) => {
      setGatePasses(prev => prev.some(p => p.id === newPass.id) ? prev : [newPass, ...prev]);
      void upsertCached('gate_passes', newPass);

      const fullPass = await fetchGatePassById(newPass.id);
      if (fullPass) {
        setGatePasses(prev => prev.some(p => p.id === fullPass.id) ? prev.map(p => p.id === fullPass.id ? fullPass : p) : [fullPass, ...prev]);
        void upsertCached('gate_passes', fullPass);
      }

      playAlert('New gate pass received');
      toast.info('New gate pass received!');
      if (permission === 'granted') {
        sendGatePassAlert(newPass.product_name, newPass.status, newPass.stores?.name);
      }
    },
    onUpdate: (updated) => {
      setGatePasses(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      void upsertCached('gate_passes', updated);
      playAlert('Gate pass status updated');
      if (permission === 'granted') {
        sendGatePassAlert(updated.product_name, updated.status, updated.stores?.name);
      }
    },
    onDelete: (deleted) => {
      setGatePasses(prev => prev.filter(p => p.id !== deleted.id));
      void deleteCached('gate_passes', deleted.id);
    },
    enabled: !!gateInfo
  });

  const handleCapture = (imageData: string, file: File) => {
    setCapturedImage(imageData);
    setCapturedFile(file);
    setShowCamera(false);
  };

  const handleSubmitEntry = async () => {
    if (!selectedDepartment) {
      toast.error('Please select a department');
      return;
    }

    if (!selectedStore) {
      toast.error('Please select a store');
      return;
    }

    if (!gateInfo) {
      toast.error('Gate information not loaded');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Upload image if provided
      let imageUrl = '';
      if (capturedFile) {
        const fileName = `${Date.now()}-${capturedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, capturedFile);

        if (uploadError) {
          console.warn('Image upload failed:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      // Build product name summary from items
      const validItems = productItems.filter(i => i.name.trim());
      const productNameSummary = validItems.map(i => i.name.trim()).join(', ') || 'Unknown Product';
      const totalQuantity = validItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

      const { data: newProduct, error: insertError } = await supabase.from('products').insert({
        office_id: gateInfo.office_id,
        gate_id: gateInfo.id,
        department_id: selectedDepartment || null,
        store_id: selectedStore || null,
        name: productNameSummary,
        quantity: totalQuantity,
        image_url: imageUrl,
        phone: phone || null,
        remarks: remarks || null,
        sender_name: senderName || null,
        receiver_name: receiverName || null,
        sender_company: senderCompany || null,
        receiver_company: receiverCompany || null,
        status: 'entered',
        created_by: user?.id
      } as any).select().single();

      if (insertError) throw insertError;

      // Insert product items
      if (newProduct && validItems.length > 0) {
        await supabase.from('product_items').insert(
          validItems.map(item => ({
            product_id: newProduct.id,
            name: item.name.trim(),
            quantity: item.quantity || 1
          }))
        );
      }

      // Add timeline entry
      if (newProduct) {
        await supabase.from('product_timeline').insert({
          product_id: newProduct.id,
          status: 'entered',
          action_by: user?.id,
          action_by_name: userName || 'Gate',
          action_role: 'gate'
        });
      }

      // Send notifications to selected department and store
      if (newProduct) {
        const targets: { table: 'departments' | 'stores' | 'gates'; id: string }[] = [];
        if (selectedDepartment) targets.push({ table: 'departments', id: selectedDepartment });
        if (selectedStore) targets.push({ table: 'stores', id: selectedStore });

        const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || '';
        const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || '';

        console.log('📤 Attempting to send notifications...', { selectedDepartment, selectedStore, targets });

        await sendNotificationsToEntities({
          officeId: gateInfo.office_id,
          title: '🚚 New Gate Entry',
          message: `${productNameSummary} (Qty: ${totalQuantity}) - From: ${senderName || 'N/A'} - Gate: ${gateInfo.name}${selectedDeptName ? ` - Dept: ${selectedDeptName}` : ''}${selectedStoreName ? ` - Store: ${selectedStoreName}` : ''}`,
          type: 'product',
          relatedProductId: newProduct.id,
          targetEntityIds: targets,
        }).catch(err => console.error('💥 Notification send failed:', err));
      }

      toast.success('Entry submitted successfully!');
      
      // Refresh products list without page reload
      if (gateInfo?.id) {
        await fetchProducts(gateInfo.id);
      }

      // Open WhatsApp
      const selectedDept = departments.find(d => d.id === selectedDepartment);
      const firstDeptNumber = getFirstWhatsAppNumber(selectedDept?.whatsapp_number);
      if (firstDeptNumber) {
        const message = encodeURIComponent(
          `New Gate Entry\nProducts: ${productNameSummary}\nQty: ${totalQuantity}\nSender: ${senderName || 'N/A'} (${senderCompany || 'N/A'})\nReceiver: ${receiverName || 'N/A'} (${receiverCompany || 'N/A'})\nDepartment: ${selectedDept?.name || 'N/A'}\nGate: ${gateInfo?.name || 'Gate'}\nRemarks: ${remarks || 'None'}`
        );
        let cleanNumber = firstDeptNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0')) cleanNumber = '880' + cleanNumber.substring(1);
        window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
      }

      // Reset form
      setCapturedImage(null);
      setCapturedFile(null);
      setSelectedDepartment('');
      setSelectedStore('');
      setProductItems([{ id: crypto.randomUUID(), name: '', quantity: 1 }]);
      setPhone('');
      setRemarks('');
      setSenderName('');
      setReceiverName('');
      setSenderCompany('');
      setReceiverCompany('');
      // Switch to Gate Entries tab after successful submit
      setActiveTab('products');
    } catch (error: any) {
      console.error('Error submitting entry:', error);
      toast.error('Failed to submit entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PWAInstallPrompt />
      
      <main className="w-full py-4 sm:py-6 px-2 sm:px-4 md:px-6">
        <div className="page-header flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileStatsMenu
              totalEntries={products.length}
              todayEntries={getTodaysEntries().length}
              pendingEntries={getPendingProducts().length}
              totalPasses={gatePasses.length}
              todayPasses={getTodaysGatePasses().length}
              pendingPasses={getPendingGatePasses().length}
              onSelectStat={(t) => { setDetailsType(t); setShowDetailsModal(true); }}
              onSelectTab={(v) => setActiveTab(v)}
              tabs={[
                { value: 'products', label: 'Gate Entries', icon: <Package className="h-3.5 w-3.5" /> },
                { value: 'gatepass', label: 'Passes', icon: <FileText className="h-3.5 w-3.5" /> },
                { value: 'entry', label: 'New Entry', icon: <Camera className="h-3.5 w-3.5" /> },
                { value: 'departments', label: 'Depts', icon: <Users className="h-3.5 w-3.5" /> },
              ]}
            />
            <div className="icon-container w-10 h-10 sm:w-12 sm:h-12">
              <DoorOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="page-title text-lg sm:text-xl">{gateInfo?.name || 'Gate'}</h1>
              <p className="page-description text-xs sm:text-sm">
                {gateInfo?.offices?.name || 'Office'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mt-4 sm:mt-6">
          {/* Total Entry */}
          <Card 
            className="border-border/50 bg-sky-500/5 cursor-pointer hover:bg-sky-500/10 hover:border-sky-500 hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('total-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Entry</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today Entry */}
          <Card 
            className="border-border/50 bg-violet-500/5 cursor-pointer hover:bg-violet-500/10 hover:border-violet-500 hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('today-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Today Entry</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{getTodaysEntries().length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Entry */}
          <Card 
            className="border-border/50 bg-warning/5 cursor-pointer hover:bg-warning/10 hover:border-warning hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('pending-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pending Entry</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{getPendingProducts().length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Pass */}
          <Card 
            className="border-border/50 bg-primary/5 cursor-pointer hover:bg-primary/10 hover:border-primary hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('total-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Pass</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{gatePasses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today Pass */}
          <Card 
            className="border-border/50 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 hover:border-blue-500 hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('today-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Today Pass</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{getTodaysGatePasses().length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Pass */}
          <Card 
            className="border-border/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => {
              setDetailsType('pending-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pending Pass</p>
                  <p className="font-bold text-sm sm:text-lg text-foreground">{getPendingGatePasses().length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 sm:mt-8">
          <TabsList className="mb-4 sm:mb-6 w-full justify-start overflow-x-auto flex-wrap">
            <TabsTrigger value="products" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              Gate Entries
            </TabsTrigger>
            <TabsTrigger value="gatepass" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Gate </span>Passes
            </TabsTrigger>
            <TabsTrigger value="entry" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">New </span>Entry
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Dept </span>Depts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gatepass">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Gate Passes
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintMode('passes'); setShowPrintDialog(true); }}>
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="gatepass-search" className="text-xs">Search</Label>
                    <Input
                      id="gatepass-search"
                      placeholder="Search by name or company..."
                      value={gatePassSearch}
                      onChange={(e) => {
                        setGatePassSearch(e.target.value);
                        setGatePassPage(1);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gatepass-status" className="text-xs">Status</Label>
                    <Select value={gatePassStatusFilter} onValueChange={(value) => {
                      setGatePassStatusFilter(value);
                      setGatePassPage(1);
                    }}>
                      <SelectTrigger className="h-9 text-sm" id="gatepass-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {gatePassStatusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                 
                </div>

                {filteredGatePasses.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">No gate passes</p>
                    <p className="text-sm text-muted-foreground">
                      {gatePassSearch || gatePassStatusFilter !== 'all' ? 'No gate passes match your filters' : 'Gate passes from stores will appear here'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {paginatedGatePasses.map((pass, index) => (
                        <div key={pass.id} className="animate-slide-up h-full" style={{ animationDelay: `${index * 50}ms` }}>
                          <GatePassCard
                            gatePass={pass}
                            userRole="gate"
                            userName={userName}
                            createdByRole={pass.created_by && pass.stores?.user_id && pass.created_by === pass.stores.user_id ? 'store' : 'department'}
                            onStatusUpdate={() => gateInfo && fetchGatePasses(gateInfo.id)}
                            autoOpen={highlightGatePassId === pass.id}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {getTotalPages(filteredGatePasses) > 1 && (
                      <div className="flex flex-col items-center pt-4 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">
                          Page {gatePassPage} of {getTotalPages(filteredGatePasses)}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGatePassPage(prev => Math.max(1, prev - 1))}
                            disabled={gatePassPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGatePassPage(prev => Math.min(getTotalPages(filteredGatePasses), prev + 1))}
                            disabled={gatePassPage === getTotalPages(filteredGatePasses)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Gate Entries ({filteredProducts.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setActiveTab('entry')}
                  >
                    <Camera className="h-4 w-4" />
                    <span className="hidden xs:inline">New Entry</span>
                    <span className="xs:hidden">New</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintMode('entries'); setShowPrintDialog(true); }}>
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <SearchFilterBar
                    searchPlaceholder="Search products..."
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    statusOptions={statusOptions}
                    statusValue={statusFilter}
                    onStatusChange={setStatusFilter}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    showDateFilter
                  />
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">No gate entries</p>
                    <p className="text-sm text-muted-foreground">
                      {searchValue || statusFilter !== 'all' ? 'No gate entries match your filters' : 'Gate entries will appear here'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {paginatedProducts.map((product, index) => (
                        <div key={product.id} className="animate-slide-up h-full" style={{ animationDelay: `${index * 50}ms` }}>
                          <ProductCard
                            product={product}
                            userRole="gate"
                            userName={userName}
                            onStatusUpdate={() => gateInfo && fetchProducts(gateInfo.id)}
                            onEdit={() => setEditingProduct(product)}
                            showEditButton
                            showDeleteButton
                            autoOpen={highlightProductId === product.id}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {getTotalPages(filteredProducts) > 1 && (
                      <div className="flex flex-col items-center pt-4 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">
                          Page {productPage} of {getTotalPages(filteredProducts)}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                            disabled={productPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductPage(prev => Math.min(getTotalPages(filteredProducts), prev + 1))}
                            disabled={productPage === getTotalPages(filteredProducts)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entry">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Camera className="h-5 w-5 text-primary" />
                      New Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Camera/Image Section */}
                      {showCamera ? (
                        <CameraCapture 
                          onCapture={handleCapture}
                          onClose={() => setShowCamera(false)}
                        />
                      ) : capturedImage ? (
                        <div className="relative inline-block">
                          <img 
                            src={capturedImage} 
                            alt="Captured" 
                            className="w-32 h-24 rounded-lg object-cover border border-border"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 text-[10px] px-2"
                            onClick={() => setShowCamera(true)}
                          >
                            Retake
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => setShowCamera(true)}
                        >
                          <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="font-medium text-foreground mb-1">Capture Product Image</p>
                          <p className="text-sm text-muted-foreground">
                            Click to use camera or upload (Optional)
                          </p>
                        </div>
                      )}

                      {/* Department & Store Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            Department <span className="text-destructive">*</span>
                          </Label>
                          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger className={`border-2 rounded-md ${!selectedDepartment ? 'border-destructive/70 shadow-sm shadow-destructive/20' : 'border-border'}`}>
                              <SelectValue placeholder="Select Department (Required)" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border z-50">
                              {departments.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedDepartment && departments.find(d => d.id === selectedDepartment)?.whatsapp_number && (
                            <p className="text-xs text-success flex items-center gap-1 mt-1">
                              📱 WhatsApp: {departments.find(d => d.id === selectedDepartment)?.whatsapp_number}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            Store
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger className={`border-2 rounded-md ${!selectedStore ? 'border-destructive/70 shadow-sm shadow-destructive/20' : 'border-border'}`}>
                              <SelectValue placeholder="Select Store (Required)" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border z-50">
                              {stores.map(store => (
                                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedStore && stores.find(s => s.id === selectedStore)?.whatsapp_number && (
                            <p className="text-xs text-success flex items-center gap-1 mt-1">
                              📱 WhatsApp: {stores.find(s => s.id === selectedStore)?.whatsapp_number}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Multi-Product Items */}
                      <MultiItemInput
                        items={productItems}
                        onChange={setProductItems}
                        productLabel="Product"
                      />

                      {/* Sender/Receiver Names & Company */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sender Name</Label>
                          <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Who is sending?" />
                        </div>
                        <div className="space-y-2">
                          <Label>Sender Company</Label>
                          <Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} placeholder="Company name" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Receiver Name</Label>
                          <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Who will receive?" />
                        </div>
                        <div className="space-y-2">
                          <Label>Receiver Company</Label>
                          <Input value={receiverCompany} onChange={(e) => setReceiverCompany(e.target.value)} placeholder="Company name" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact number" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional notes..." rows={3} />
                      </div>

                      <Button 
                        className="w-full gap-2" 
                        size="lg"
                        onClick={handleSubmitEntry}
                        disabled={submitting || !selectedDepartment}
                      >
                        {submitting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Send className="h-4 w-4" /> Submit Entry</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Department Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 max-w-sm">
                  <Input
                    placeholder="Search departments..."
                    value={departmentSearch}
                    onChange={(e) => setDepartmentSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                {filteredDepartmentStats.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">
                      {departmentStats.length === 0 ? 'No departments' : 'No departments match your search'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {departmentStats.length === 0 ? 'No department data is available yet.' : 'Try another department name.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDepartmentStats.map(dept => (
                      <DepartmentStatsCard 
                        key={dept.id} 
                        department={dept} 
                        onClick={() => {
                          navigate(`/department-details/${dept.id}`);
                        }} 
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={(open) => {
        setShowDetailsModal(open);
        if (!open) {
          setSelectedDepartmentId(null);
          setDetailsType(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsType === 'total-entries' && 'All Gate Entries'}
              {detailsType === 'today-entries' && "Today's Gate Entries"}
              {detailsType === 'pending-entries' && 'Pending Gate Entries'}
              {detailsType === 'total-passes' && 'All Gate Passes'}
              {detailsType === 'today-passes' && "Today's Gate Passes"}
              {detailsType === 'pending-passes' && 'Pending Gate Passes'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {(() => {
              let entryList: Product[] = [];
              if (detailsType === 'total-entries') entryList = products;
              else if (detailsType === 'today-entries') entryList = getTodaysEntries();
              else if (detailsType === 'pending-entries') entryList = getPendingProducts();

              let passList: GatePass[] = [];
              if (detailsType === 'total-passes') passList = gatePasses;
              else if (detailsType === 'today-passes') passList = getTodaysGatePasses();
              else if (detailsType === 'pending-passes') passList = getPendingGatePasses();

              const isEntries = detailsType?.includes('entries');
              const isPasses = detailsType?.includes('passes');

              if (isEntries) {
                if (entryList.length === 0) return <p className="text-center text-muted-foreground py-8">No entries found.</p>;
                return entryList.map((product) => (
                  <ProductCard key={product.id} product={product as any} userRole="gate" userName={userName} onStatusUpdate={() => gateInfo && fetchProducts(gateInfo.id)} />
                ));
              }
              if (isPasses) {
                if (passList.length === 0) return <p className="text-center text-muted-foreground py-8">No gate passes found.</p>;
                return passList.map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass as any} userRole="gate" userName={userName} onStatusUpdate={() => gateInfo && fetchGatePasses(gateInfo.id)} />
                ));
              }
              return null;
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 z-40"
          size="icon"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {/* Edit Dialog */}
      {editingProduct && (
        <GateEntryEditDialog
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          product={editingProduct}
          departments={departments}
          onUpdate={() => gateInfo && fetchProducts(gateInfo.id)}
        />
      )}

      {/* Print Dialog */}
      <GateEntryPrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        items={printMode === 'passes' ? filteredGatePasses : filteredProducts}
        mode={printMode}
        departments={departments}
        gateName={gateInfo?.name || 'Gate'}
        officeName={gateInfo?.offices?.name || 'Office'}
      />

      {/* Chat */}
      {gateInfo && (
        <ChatDialog
          open={showChat}
          onOpenChange={setShowChat}
          officeId={gateInfo.office_id}
          currentUserId={userId}
          currentUserRole="gate"
          currentUserName={userName}
          title="Gate Chat"
        />
      )}
    </div>
  );
};

export default GatePage;
