import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ProductCard from "@/components/ProductCard";
import GatePassCard from "@/components/GatePassCard";
import GateEntryPrintDialog from "@/components/GateEntryPrintDialog";
import ChatDialog from "@/components/ChatDialog";
import MultiItemInput, { ItemEntry } from "@/components/MultiItemInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Store as StoreIcon, Package, FileText, Plus, Building2, Loader2, MessageSquare, DoorOpen, Users, TrendingUp, Clock, AlertCircle, Undo2, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { useRealtimeSubscription, useVoiceAlert } from "@/hooks/useRealtimeSubscription";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { sendNotificationsToEntities } from "@/utils/sendNotification";
import { getCached, setCached, upsertCached, deleteCached } from "@/lib/indexedDBCache";
import MobileStatsMenu from "@/components/MobileStatsMenu";

interface Office {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role: string;
    office_id: string;
  };
}

interface ProductItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
}

interface TimelineEntry {
  id: string;
  created_at: string;
  product_id: string;
  status: string;
  action_by: string;
  action_by_name: string;
  action_role: string;
}

interface Gate {
  id: string;
  name: string;
}

interface StoreInfo {
  id: string;
  name: string;
  store_code: string;
  office_id: string;
  offices?: { name: string };
}

interface Department {
  id: string;
  name: string;
  whatsapp_number?: string | null;
}

interface GateInfo {
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
  department_id?: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  created_at: string;
  departments?: { name: string };
  stores?: { name: string };
  gate_pass_items?: { id: string; name: string; quantity: number }[];
}

const StorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightProductId = searchParams.get('highlight_product');
  const highlightGatePassId = searchParams.get('highlight_gatepass');

  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [gates, setGates] = useState<GateInfo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [printMode, setPrintMode] = useState<'entries' | 'passes'>('entries');
  const [activeTab, setActiveTab] = useState("products");

  useEffect(() => {
    if (highlightProductId || highlightGatePassId) {
      // Switch to the appropriate tab based on the highlighted item
      if (highlightGatePassId) {
        setActiveTab("gatepass");
        const highlightedIndex = gatePasses.findIndex((gp) => gp.id === highlightGatePassId);
        if (highlightedIndex >= 0) {
          setGatePassPage(Math.floor(highlightedIndex / ITEMS_PER_PAGE) + 1);
        }
      } else if (highlightProductId) {
        setActiveTab("products");
        const highlightedIndex = products.findIndex((p) => p.id === highlightProductId);
        if (highlightedIndex >= 0) {
          setProductPage(Math.floor(highlightedIndex / ITEMS_PER_PAGE) + 1);
        }
      }
      const timeout = setTimeout(() => setSearchParams({}, { replace: true }), 1000);
      return () => clearTimeout(timeout);
    }
  }, [highlightProductId, highlightGatePassId, setSearchParams, gatePasses, products]);

  // Form state
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [receiverCompany, setReceiverCompany] = useState("");
  const [selectedGate, setSelectedGate] = useState("");
  const [productItems, setProductItems] = useState<ItemEntry[]>([
    { id: crypto.randomUUID(), name: '', quantity: 1 }
  ]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsType, setSelectedDetailsType] = useState<'total-passes' | 'today-passes' | 'pending-entries' | 'pending-passes' | 'total-entries' | 'today-entries' | null>(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Pagination state
  const [productPage, setProductPage] = useState(1);
  const [gatePassPage, setGatePassPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Search and filter state
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [gatePassSearch, setGatePassSearch] = useState('');
  const [gatePassStatusFilter, setGatePassStatusFilter] = useState('all');
  const [departmentSearch, setDepartmentSearch] = useState('');

  const { playAlert } = useVoiceAlert();
  const { sendGatePassAlert, sendProductStatusAlert, permission } = usePushNotifications();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await Promise.all([fetchStoreInfo(session?.user), fetchUserInfo(session?.user)]);
    };
    init();
  }, []);

  const fetchUserInfo = async (sessionUser?: any) => {
    const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || "Store User");
    }
  };

  const fetchStoreInfo = async (sessionUser?: any) => {
    try {
      const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;

      const cachedStore = (await getCached<StoreInfo & { user_id?: string }>('stores', 'user_id', user.id))[0];
      if (cachedStore) setStoreInfo(cachedStore);

      const entityId = user.user_metadata?.entity_id;
      let store = cachedStore || null;

      const { data: storeByUser } = await supabase
        .from("stores").select("*, offices(name)").eq("user_id", user.id).maybeSingle();

      if (storeByUser) {
        store = storeByUser;
      } else if (entityId) {
        const { data: storeByEntity } = await supabase
          .from("stores").select("*, offices(name)").eq("id", entityId).maybeSingle();
        if (storeByEntity) {
          store = storeByEntity;
          await supabase.from("stores").update({ user_id: user.id }).eq("id", entityId);
        }
      }

      if (!store) { toast.error("Store not found."); return; }
      setStoreInfo(store);

      if (store?.office_id) {
        const [cachedDepts, cachedGates] = await Promise.all([
          getCached<Department>('departments', 'office_id', store.office_id),
          getCached<GateInfo>('gates', 'office_id', store.office_id),
        ]);
        if (cachedDepts.length) setDepartments(cachedDepts);
        if (cachedGates.length) setGates(cachedGates);

        const [deptsRes, gatesRes] = await Promise.all([
          supabase
            .from("departments")
            .select("id, name, whatsapp_number")
            .eq("office_id", store.office_id)
            .eq("status", "active"),
          supabase
            .from("gates")
            .select("id, name, whatsapp_number")
            .eq("office_id", store.office_id)
            .eq("status", "active"),
        ]);
        setDepartments(deptsRes.data || []);
        setGates(gatesRes.data || []);
        void setCached('departments', deptsRes.data || [], 'office_id', store.office_id);
        void setCached('gates', gatesRes.data || [], 'office_id', store.office_id);

        await Promise.all([fetchProducts(store.id), fetchGatePasses(store.id)]);
      }
    } catch (error) {
      console.error("Error fetching store info:", error);
      toast.error("Failed to load store information");
    }
  };

  const fetchProducts = async (storeId: string) => {
    const cached = await getCached<Product>('products', 'store_id', storeId);
    if (cached.length) setProducts(cached);
    const { data } = await supabase
      .from("products")
      .select("*, departments(name, whatsapp_number), gates(name, whatsapp_number), stores(name, whatsapp_number), product_items(id, name, quantity)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (data) {
      setProducts(data);
      void setCached('products', data as any, 'store_id', storeId);
    }
  };

  const fetchGatePasses = async (storeId: string) => {
    const cached = await getCached<GatePass>('gate_passes', 'store_id', storeId);
    if (cached.length) setGatePasses(cached);
    const { data } = await supabase
      .from("gate_passes")
      .select("*, departments(name, whatsapp_number), stores(name, whatsapp_number), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (data) {
      setGatePasses(data);
      void setCached('gate_passes', data as any, 'store_id', storeId);
    }
  };

  const fetchGatePassById = async (gatePassId: string) => {
    const { data } = await supabase
      .from('gate_passes')
      .select('*, departments(name, whatsapp_number), stores(name, whatsapp_number), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)')
      .eq('id', gatePassId)
      .single();
    return data;
  };

  // Stats calculation functions
  const getTodayDate = () => {
    const today = new Date();
    return startOfDay(today);
  };

  const getTodaysGatePasses = () => {
    const today = getTodayDate();
    return gatePasses.filter(gp => new Date(gp.created_at) >= today);
  };

  const getPendingProducts = () => {
    return products.filter(p => p.status !== 'received' && p.status !== 'know_about');
  };

  const getPendingGatePasses = () => {
    return gatePasses.filter(gp => gp.status === 'created' || gp.status === 'entered');
  };

  const getTodaysPendingProducts = () => {
    const today = getTodayDate();
    return products.filter(p => (p.status !== 'received' && p.status !== 'know_about') && new Date(p.created_at) >= today);
  };

  const getTodaysPendingGatePasses = () => {
    const today = getTodayDate();
    return gatePasses.filter(gp => (gp.status === 'created' || gp.status === 'entered') && new Date(gp.created_at) >= today);
  };

  const getTodaysProducts = () => {
    const today = getTodayDate();
    return products.filter(p => new Date(p.created_at) >= today);
  };

  // Department utility functions
  const getDepartmentEntries = (deptId: string) => {
    return products.filter(p => p.departments?.name === departments.find(d => d.id === deptId)?.name);
  };

  const getDepartmentPasses = (deptId: string) => {
    return gatePasses.filter(gp => gp.department_id === deptId);
  };

  const getUniqueDepartmentsWithData = () => {
    const deptIds = new Set<string>();
    // Add departments with products
    products.forEach(p => {
      if (p.departments?.name) {
        const dept = departments.find(d => d.name === p.departments.name);
        if (dept) deptIds.add(dept.id);
      }
    });
    // Add departments with gate passes
    gatePasses.forEach(gp => {
      if (gp.department_id) deptIds.add(gp.department_id);
    });
    return Array.from(deptIds).map(id => departments.find(d => d.id === id)!).filter(Boolean);
  };

  const filteredDepartmentsWithData = getUniqueDepartmentsWithData().filter(dept => dept.name.toLowerCase().includes(departmentSearch.toLowerCase()));

  // Filter products
  const getFilteredProducts = () => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sender_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.receiver_name?.toLowerCase().includes(productSearch.toLowerCase());
      
      const matchesStatus = productStatusFilter === 'all' || p.status === productStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  // Filter gate passes
  const getFilteredGatePasses = () => {
    return gatePasses.filter(gp => {
      const matchesSearch = gp.product_name.toLowerCase().includes(gatePassSearch.toLowerCase()) ||
        gp.sender_name?.toLowerCase().includes(gatePassSearch.toLowerCase()) ||
        gp.receiver_name?.toLowerCase().includes(gatePassSearch.toLowerCase());
      
      const matchesStatus = gatePassStatusFilter === 'all' || gp.status === gatePassStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredProducts = getFilteredProducts();
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

  const productStatusOptions = [
    { value: 'entered', label: 'Entered' },
    { value: 'on_the_way_store', label: 'On The Way' },
    { value: 'in_store', label: 'In Store' },
    { value: 'received', label: 'Received' },
  ];

  const gatePassStatusOptions = [
    { value: 'created', label: 'Created' },
    { value: 'approved', label: 'Approved' },
    { value: 'on_the_way', label: 'On The Way' },
    { value: 'received', label: 'Received' },
  ];

  // Realtime for products
  // Realtime for products — granular conflict-free merges
  useRealtimeSubscription({
    table: "products",
    filter: storeInfo ? { column: "store_id", value: storeInfo.id } : undefined,
    onInsert: (newProduct) => {
      setProducts((prev) => prev.some(p => p.id === newProduct.id) ? prev : [newProduct, ...prev]);
      void upsertCached('products', newProduct);
      playAlert("New product entry received");
      toast.info("New product entry!");
    },
    onUpdate: (updated) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      void upsertCached('products', updated);
    },
    onDelete: (deleted) => {
      setProducts((prev) => prev.filter(p => p.id !== deleted.id));
      void deleteCached('products', deleted.id);
    },
    enabled: !!storeInfo,
  });

  // Realtime for gate passes
  useRealtimeSubscription({
    table: "gate_passes",
    filter: storeInfo ? { column: "store_id", value: storeInfo.id } : undefined,
    onInsert: async (newPass) => {
      setGatePasses((prev) => prev.some(p => p.id === newPass.id) ? prev : [newPass, ...prev]);
      void upsertCached('gate_passes', newPass);
      const fullPass = await fetchGatePassById(newPass.id);
      if (fullPass) {
        setGatePasses((prev) => prev.some(p => p.id === fullPass.id) ? prev.map(p => p.id === fullPass.id ? fullPass : p) : [fullPass, ...prev]);
        void upsertCached('gate_passes', fullPass);
      }
    },
    onUpdate: (updated) => {
      setGatePasses((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      void upsertCached('gate_passes', updated);
      playAlert("Gate pass status updated");
      toast.info("Gate pass updated!");
    },
    onDelete: (deleted) => {
      setGatePasses((prev) => prev.filter(p => p.id !== deleted.id));
      void deleteCached('gate_passes', deleted.id);
    },
    enabled: !!storeInfo,
  });

  const handleCreateGatePass = async () => {
    const validItems = productItems.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    if (!selectedDepartment) {
      toast.error("Please select a department");
      return;
    }
    if (!selectedGate) {
      toast.error("Please select a gate");
      return;
    }
    if (!storeInfo) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login again");

      const productNameSummary = validItems.map(i => i.name.trim()).join(', ');
      const totalQuantity = validItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

      const { data: newPass, error } = await supabase
        .from("gate_passes")
        .insert({
          office_id: storeInfo.office_id,
          store_id: storeInfo.id,
          department_id: selectedDepartment || null,
          gate_id: selectedGate || null,
          product_name: productNameSummary,
          quantity: totalQuantity,
          purpose: purpose || "transfer",
          expected_date: expectedDate || null,
          remarks: remarks || null,
          sender_name: senderName || null,
          receiver_name: receiverName || null,
          sender_company: senderCompany || null,
          receiver_company: receiverCompany || null,
          created_by: user.id,
          status: "created",
          last_action_by: user.id,
          last_action_role: "store",
        } as any)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      // Insert gate pass items
      if (newPass?.id && validItems.length > 0) {
        await supabase.from("gate_pass_items").insert(
          validItems.map(item => ({
            gate_pass_id: newPass.id,
            name: item.name.trim(),
            quantity: item.quantity || 1
          }))
        );
      }

      if (newPass?.id) {
        await supabase.from("gate_pass_timeline").insert({
          gate_pass_id: newPass.id,
          status: "created",
          action_by: user.id,
          action_by_name: userName || "Store",
          action_role: "store",
        });
      }

      // Send notifications to selected department and gate
      if (newPass?.id) {
        const targets: { table: 'departments' | 'stores' | 'gates'; id: string }[] = [];
        if (selectedDepartment) targets.push({ table: 'departments', id: selectedDepartment });
        if (selectedGate) targets.push({ table: 'gates', id: selectedGate });

        const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || '';
        const selectedGateName = gates.find(g => g.id === selectedGate)?.name || '';

        console.log('📤 Attempting to send notifications...', { selectedDepartment, selectedGate, targets });

        await sendNotificationsToEntities({
          officeId: storeInfo.office_id,
          title: '📋 New Gate Pass',
          message: `${productNameSummary} (Qty: ${totalQuantity}) - Store: ${storeInfo.name}${selectedDeptName ? ` - Dept: ${selectedDeptName}` : ''}${selectedGateName ? ` - Gate: ${selectedGateName}` : ''}`,
          type: 'gate_pass',
          relatedGatePassId: newPass.id,
          targetEntityIds: targets,
        }).catch(err => console.error('💥 Notification send failed:', err));
      }

      toast.success("Gate pass created!");
      playAlert("Gate pass created");

      // WhatsApp
      const selectedDept = departments.find((d) => d.id === selectedDepartment);
      if (selectedDept?.whatsapp_number) {
        let rawNumber = selectedDept.whatsapp_number.split(",")[0].trim();
        let cleanNumber = rawNumber.replace(/[^0-9]/g, "");
        if (cleanNumber.startsWith("0")) cleanNumber = "880" + cleanNumber.substring(1);
        const message = encodeURIComponent(
          `New Gate Pass\nProducts: ${productNameSummary}\nQty: ${totalQuantity}\nSender: ${senderName || 'N/A'}\nReceiver: ${receiverName || 'N/A'}\nStore: ${storeInfo?.name}\nPurpose: ${purpose || 'Transfer'}`
        );
        window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
      }

      setCreateDialog(false);
      setSelectedDepartment("");
      setSelectedGate("");
      setProductItems([{ id: crypto.randomUUID(), name: '', quantity: 1 }]);
      setPurpose("");
      setExpectedDate("");
      setRemarks("");
      setSenderName("");
      setReceiverName("");
      setSenderCompany("");
      setReceiverCompany("");
    } catch (error: any) {
      console.error("Error creating gate pass:", error);
      toast.error(error?.message || "Failed to create gate pass");
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
              todayEntries={getTodaysProducts().length}
              pendingEntries={getPendingProducts().length}
              totalPasses={gatePasses.length}
              todayPasses={getTodaysGatePasses().length}
              pendingPasses={getPendingGatePasses().length}
              onSelectStat={(t) => { setSelectedDetailsType(t); setShowDetailsModal(true); }}
              tabs={[
                { value: 'products', label: 'Gate Entries', icon: <Package className="h-3.5 w-3.5" /> },
                { value: 'gatepass', label: 'Passes', icon: <FileText className="h-3.5 w-3.5" /> },
                { value: 'departments', label: 'Depts', icon: <Users className="h-3.5 w-3.5" /> },
              ]}
              infoItems={[
                { label: 'Store', value: storeInfo?.name || '-', icon: <StoreIcon className="h-4 w-4 text-success" /> },
                { label: 'Gates', value: gates.length, icon: <DoorOpen className="h-4 w-4 text-primary" /> },
                { label: 'Depts', value: departments.length, icon: <Users className="h-4 w-4 text-warning" /> },
              ]}
            />
            <div className="icon-container w-10 h-10 sm:w-12 sm:h-12" style={{ background: "linear-gradient(135deg, hsl(142 71% 45%), hsl(142 60% 40%))" }}>
              <StoreIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="page-title text-lg sm:text-xl">{storeInfo?.name || "Store"}</h1>
              <p className="page-description text-xs sm:text-sm">{storeInfo?.offices?.name || "Office"}</p>
            </div>
          </div>
        </div>

       

        {/* Quick Stats Cards - Compact & Smart Design */}
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-2 mt-4 sm:mt-6">
          {/* Total Entry */}
          <Card 
            className="border-border/50 bg-sky-500/5 cursor-pointer hover:bg-sky-500/10 hover:border-sky-500 hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('total-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-sky-500/10">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Total Entry</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{products.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Today Entry */}
          <Card 
            className="border-border/50 bg-violet-500/5 cursor-pointer hover:bg-violet-500/10 hover:border-violet-500 hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('today-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-violet-500/10">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Today Entry</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getTodaysProducts().length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pending Entry */}
          <Card 
            className="border-border/50 bg-warning/5 cursor-pointer hover:bg-warning/10 hover:border-warning hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('pending-entries');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-warning/10">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Pending Entry</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getPendingProducts().length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Total Pass */}
          <Card 
            className="border-border/50 bg-primary/5 cursor-pointer hover:bg-primary/10 hover:border-primary hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('total-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Total Pass</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{gatePasses.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Today Pass */}
          <Card 
            className="border-border/50 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 hover:border-blue-500 hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('today-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Today Pass</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getTodaysGatePasses().length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pending Pass */}
          <Card 
            className="border-border/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('pending-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Pending Pass</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getPendingGatePasses().length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 sm:mt-8">
          <TabsList className="mb-4 sm:mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="products" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Gate </span>Entries
            </TabsTrigger>
            <TabsTrigger value="gatepass" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Gate </span>Pass
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              Depts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gatepass">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Gate Passes</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintMode('passes'); setShowPrint(true); }}>
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button className="gap-2" onClick={() => setCreateDialog(true)}>
                    <Plus className="h-4 w-4" /> Create Gate Pass
                  </Button>
                </div>
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
                      {gatePassSearch || gatePassStatusFilter !== 'all' ? 'No gate passes match your filters' : 'Create a gate pass to allow products to leave'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {paginatedGatePasses.map((pass, index) => (
                        <div key={pass.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                          <GatePassCard
                            gatePass={pass}
                            userRole="store"
                            userName={userName}
                            onStatusUpdate={() => storeInfo && fetchGatePasses(storeInfo.id)}
                            showEditButton
                            showDeleteButton
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
            <div className="">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg">Incoming Gate Entries</CardTitle>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintMode('entries'); setShowPrint(true); }}>
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search and Filter */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="product-search" className="text-xs">Search</Label>
                        <Input
                          id="product-search"
                          placeholder="Search by name or company..."
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setProductPage(1);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-status" className="text-xs">Status</Label>
                        <Select value={productStatusFilter} onValueChange={(value) => {
                          setProductStatusFilter(value);
                          setProductPage(1);
                        }}>
                          <SelectTrigger className="h-9 text-sm" id="product-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {productStatusOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                    </div>

                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="font-medium text-foreground mb-1">No gate entries</p>
                        <p className="text-sm text-muted-foreground">
                          {productSearch || productStatusFilter !== 'all' ? 'No gate entries match your filters' : 'Gate entries will appear here'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {paginatedProducts.map((product, index) => (
                            <div key={product.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                              <ProductCard
                                product={product}
                                userRole="store"
                                userName={userName}
                                onStatusUpdate={() => storeInfo && fetchProducts(storeInfo.id)}
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Department Overview
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
                {filteredDepartmentsWithData.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">
                      {getUniqueDepartmentsWithData().length === 0 ? 'No department data' : 'No departments match your search'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getUniqueDepartmentsWithData().length === 0 ? 'Departments with entries or passes will appear here' : 'Try another department name.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDepartmentsWithData.map((dept) => {
                      const entries = getDepartmentEntries(dept.id);
                      const passes = getDepartmentPasses(dept.id);
                      return (
                        <Card
                          key={dept.id}
                          className="border-border/50 cursor-pointer bg-primary/5 hover:bg-primary/10 hover:border-primary hover:shadow-lg transition-all duration-200"
                          onClick={() => navigate(`/department-details/${dept.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-lg bg-primary/10">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-foreground">{dept.name}</h3>
                                  <p className="text-xs text-muted-foreground">{dept.whatsapp_number && `📱 ${dept.whatsapp_number}`}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-lg bg-blue-500/10">
                                  <p className="text-xs text-muted-foreground">Gate Entries</p>
                                  <p className="font-bold text-lg text-blue-600">{entries.length}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-emerald-500/10">
                                  <p className="text-xs text-muted-foreground">Gate Passes</p>
                                  <p className="font-bold text-lg text-emerald-600">{passes.length}</p>
                                </div>
                              </div>
                              <p className="text-center text-xs text-muted-foreground mt-2 italic">Click to view details</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Gate Pass Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Create Gate Pass
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Department <span className="text-destructive">*</span></Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">Gate <span className="text-destructive">*</span></Label>
              <Select value={selectedGate} onValueChange={setSelectedGate}>
                <SelectTrigger><SelectValue placeholder="Select Gate" /></SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {gates.map((gate) => (
                    <SelectItem key={gate.id} value={gate.id}>{gate.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-Product Items */}
            <MultiItemInput items={productItems} onChange={setProductItems} productLabel="Product" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sender Name</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Sender" />
              </div>
              <div className="space-y-2">
                <Label>Sender Company</Label>
                <Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} placeholder="Company" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Receiver Name</Label>
                <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Receiver" />
              </div>
              <div className="space-y-2">
                <Label>Receiver Company</Label>
                <Input value={receiverCompany} onChange={(e) => setReceiverCompany(e.target.value)} placeholder="Company" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional notes..." rows={3} />
            </div>

            <Button className="w-full" onClick={handleCreateGatePass} disabled={submitting || productItems.filter(i => i.name.trim()).length === 0}>
              {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>) : "Create Gate Pass"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {storeInfo && (
        <ChatDialog open={showChat} onOpenChange={setShowChat} officeId={storeInfo.office_id} currentUserId={userId} currentUserRole="store" currentUserName={userName} title="Store Chat" />
      )}

      <GateEntryPrintDialog
        open={showPrint}
        onOpenChange={setShowPrint}
        mode={printMode}
        items={printMode === 'passes' ? gatePasses : products}
        departments={departments}
        gateName={storeInfo?.name || ''}
        officeName={storeInfo?.offices?.name || 'Office'}
      />

      {/* Department Details Modal */}
      <Dialog open={showDeptModal} onOpenChange={setShowDeptModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {selectedDeptId && departments.find(d => d.id === selectedDeptId)?.name} - Details
            </DialogTitle>
          </DialogHeader>

          {selectedDeptId && (
            <div className="space-y-6 py-4">
              {/* Gate Entries Section */}
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  Gate Entries ({getDepartmentEntries(selectedDeptId).length})
                </h3>
                {getDepartmentEntries(selectedDeptId).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No gate entries for this department</p>
                ) : (
                  <div className="space-y-2">
                    {getDepartmentEntries(selectedDeptId).map((product) => (
                      <div key={product.id} className="p-4 rounded-lg border border-border/50 bg-blue-500/5">
                        <div className="flex items-start justify-between gap-3">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded object-cover" />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{product.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">Qty: {product.quantity} • {format(new Date(product.created_at), 'dd MMM yyyy, h:mm a')}</p>
                            {product.sender_name && <p className="text-xs text-muted-foreground mt-1">From: {product.sender_name}</p>}
                            {product.receiver_name && <p className="text-xs text-muted-foreground">To: {product.receiver_name}</p>}
                          </div>
                          <div className="bg-blue-500/10 px-3 py-1.5 rounded-full flex-shrink-0">
                            <span className="text-xs font-semibold text-blue-600 capitalize">{product.status.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gate Passes Section */}
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  Gate Passes ({getDepartmentPasses(selectedDeptId).length})
                </h3>
                {getDepartmentPasses(selectedDeptId).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No gate passes for this department</p>
                ) : (
                  <div className="space-y-2">
                    {getDepartmentPasses(selectedDeptId).map((pass) => (
                      <div key={pass.id} className="p-4 rounded-lg border border-border/50 bg-emerald-500/5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{pass.product_name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">Qty: {pass.quantity} • {format(new Date(pass.created_at), 'dd MMM yyyy, h:mm a')}</p>
                            <p className="text-xs text-muted-foreground mt-1">Purpose: {pass.purpose}</p>
                            {pass.sender_name && <p className="text-xs text-muted-foreground">From: {pass.sender_name}</p>}
                            {pass.receiver_name && <p className="text-xs text-muted-foreground">To: {pass.receiver_name}</p>}
                          </div>
                          <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full flex-shrink-0">
                            <span className="text-xs font-semibold text-emerald-600 capitalize">{pass.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDetailsType === 'total-entries' && 'All Gate Entries'}
              {selectedDetailsType === 'today-entries' && "Today's Gate Entries"}
              {selectedDetailsType === 'pending-entries' && 'Pending Gate Entries'}
              {selectedDetailsType === 'total-passes' && 'All Gate Passes'}
              {selectedDetailsType === 'today-passes' && "Today's Gate Passes"}
              {selectedDetailsType === 'pending-passes' && 'Pending Gate Passes'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {(() => {
              let entryList: Product[] = [];
              if (selectedDetailsType === 'total-entries') entryList = products;
              else if (selectedDetailsType === 'today-entries') entryList = getTodaysProducts();
              else if (selectedDetailsType === 'pending-entries') entryList = getPendingProducts();

              let passList: GatePass[] = [];
              if (selectedDetailsType === 'total-passes') passList = gatePasses;
              else if (selectedDetailsType === 'today-passes') passList = getTodaysGatePasses();
              else if (selectedDetailsType === 'pending-passes') passList = getPendingGatePasses();

              const isEntries = selectedDetailsType?.includes('entries');
              const isPasses = selectedDetailsType?.includes('passes');

              if (isEntries) {
                if (entryList.length === 0) return <p className="text-center text-muted-foreground py-8">No entries found.</p>;
                return entryList.map((product) => (
                  <ProductCard key={product.id} product={product as any} userRole="store" userName={userName} onStatusUpdate={() => storeInfo && fetchProducts(storeInfo.id)} />
                ));
              }
              if (isPasses) {
                if (passList.length === 0) return <p className="text-center text-muted-foreground py-8">No gate passes found.</p>;
                return passList.map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass as any} userRole="store" userName={userName} onStatusUpdate={() => storeInfo && fetchGatePasses(storeInfo.id)} />
                ));
              }
              return null;
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorePage;
