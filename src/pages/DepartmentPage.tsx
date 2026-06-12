import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ProductCard from "@/components/ProductCard";
import GatePassCard from "@/components/GatePassCard";
import ChatDialog from "@/components/ChatDialog";
import MultiItemInput, { ItemEntry } from "@/components/MultiItemInput";
import MobileStatsMenu from "@/components/MobileStatsMenu";
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
  Users, Package, FileText, Plus, Building2, CheckCircle2, Clock, Loader2, MessageSquare, DoorOpen, Store as StoreIcon, TrendingUp, AlertCircle, Search,
} from "lucide-react";
import { toast } from "sonner";
import { endOfDay, startOfDay } from "date-fns";
import { useRealtimeSubscription, useVoiceAlert } from "@/hooks/useRealtimeSubscription";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { sendNotificationsToEntities } from "@/utils/sendNotification";
import { getCached, setCached, upsertCached, deleteCached } from "@/lib/indexedDBCache";

interface DepartmentInfo {
  id: string;
  name: string;
  department_code: string;
  office_id: string;
  offices?: { name: string };
}

interface Store {
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
  sender_name: string | null;
  receiver_name: string | null;
  created_at: string;
  stores?: { name: string };
  departments?: { name: string };
  gate_pass_items?: { id: string; name: string; quantity: number }[];
}

const DepartmentPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightProductId = searchParams.get('highlight_product');
  const highlightGatePassId = searchParams.get('highlight_gatepass');

  useEffect(() => {
    if (highlightProductId || highlightGatePassId) {
      // Switch to the appropriate tab based on the highlighted item
      if (highlightGatePassId) {
        setActiveTab("gatepass");
      } else if (highlightProductId) {
        setActiveTab("products");
      }
      const timeout = setTimeout(() => setSearchParams({}, { replace: true }), 1000);
      return () => clearTimeout(timeout);
    }
  }, [highlightProductId, highlightGatePassId, setSearchParams]);

  const [deptInfo, setDeptInfo] = useState<DepartmentInfo | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [gates, setGates] = useState<GateInfo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [activeTab, setActiveTabState] = useState("products");

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    resetPaginationOnTabChange(tab);
  };

  // Pagination state
  const [gatePassPage, setGatePassPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const itemsPerPage = 6;

  const [productSearch, setProductSearch] = useState("");
  const [productDateFrom, setProductDateFrom] = useState("");
  const [productDateTo, setProductDateTo] = useState("");
  const [gatePassSearch, setGatePassSearch] = useState("");
  const [gatePassDateFrom, setGatePassDateFrom] = useState("");
  const [gatePassDateTo, setGatePassDateTo] = useState("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filterDialogTab, setFilterDialogTab] = useState<'products' | 'gatepass'>('products');

  // Form state
  const [selectedStore, setSelectedStore] = useState("");
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

  // Details modal state
  const [selectedDetailsType, setSelectedDetailsType] = useState<'total-entries' | 'today-entries' | 'pending-entries' | 'total-passes' | 'today-passes' | 'pending-passes' | 'received-products' | 'gate-out-passes' | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { playAlert } = useVoiceAlert();
  const { sendGatePassAlert, sendProductStatusAlert, permission } = usePushNotifications();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await Promise.all([fetchDepartmentInfo(session?.user), fetchUserInfo(session?.user)]);
    };
    init();
  }, []);

  const fetchUserInfo = async (sessionUser?: any) => {
    const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || "Department User");
    }
  };

  const fetchDepartmentInfo = async (sessionUser?: any) => {
    try {
      const user = sessionUser || (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;

      const cachedDept = (await getCached<DepartmentInfo & { user_id?: string }>('departments', 'user_id', user.id))[0];
      if (cachedDept) setDeptInfo(cachedDept);

      const entityId = user.user_metadata?.entity_id;
      let dept = cachedDept || null;

      const { data: deptByUser } = await supabase
        .from("departments").select("*, offices(name)").eq("user_id", user.id).maybeSingle();

      if (deptByUser) {
        dept = deptByUser;
      } else if (entityId) {
        const { data: deptByEntity } = await supabase
          .from("departments").select("*, offices(name)").eq("id", entityId).maybeSingle();
        if (deptByEntity) {
          dept = deptByEntity;
          await supabase.from("departments").update({ user_id: user.id }).eq("id", entityId);
        }
      }

      if (!dept) { toast.error("Department not found."); return; }
      setDeptInfo(dept);

      if (dept?.office_id) {
        const [cachedStores, cachedGates] = await Promise.all([
          getCached<Store>('stores', 'office_id', dept.office_id),
          getCached<GateInfo>('gates', 'office_id', dept.office_id),
        ]);
        if (cachedStores.length) setStores(cachedStores);
        if (cachedGates.length) setGates(cachedGates);

        const [storesRes, gatesRes] = await Promise.all([
          supabase
            .from("stores")
            .select("id, name, whatsapp_number")
            .eq("office_id", dept.office_id)
            .eq("status", "active"),
          supabase
            .from("gates")
            .select("id, name, whatsapp_number")
            .eq("office_id", dept.office_id)
            .eq("status", "active"),
        ]);
        setStores(storesRes.data || []);
        setGates(gatesRes.data || []);
        void setCached('stores', storesRes.data || [], 'office_id', dept.office_id);
        void setCached('gates', gatesRes.data || [], 'office_id', dept.office_id);
      }

      if (dept?.id) {
        await Promise.all([fetchProducts(dept.id), fetchGatePasses(dept.id)]);
      }
    } catch (error) {
      console.error("Error fetching department info:", error);
      toast.error("Failed to load department information");
    }
  };

  const fetchProducts = async (deptId: string) => {
    const cached = await getCached<Product>('products', 'department_id', deptId);
    if (cached.length) setProducts(cached);
    const { data } = await supabase
      .from("products")
      .select("*, gates(name, whatsapp_number), departments(name, whatsapp_number), stores(name, whatsapp_number), product_items(id, name, quantity)")
      .eq("department_id", deptId)
      .order("created_at", { ascending: false });
    if (data) {
      setProducts(data);
      void setCached('products', data as any, 'department_id', deptId);
    }
  };

  const fetchGatePasses = async (deptId: string) => {
    const cached = await getCached<GatePass>('gate_passes', 'department_id', deptId);
    if (cached.length) setGatePasses(cached);
    const { data } = await supabase
      .from("gate_passes")
      .select("*, stores(name, whatsapp_number), departments(name, whatsapp_number), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)")
      .eq("department_id", deptId)
      .order("created_at", { ascending: false });
    if (data) {
      setGatePasses(data);
      void setCached('gate_passes', data as any, 'department_id', deptId);
    }
  };

  const fetchGatePassById = async (gatePassId: string) => {
    const { data } = await supabase
      .from('gate_passes')
      .select('*, stores(name, whatsapp_number), departments(name, whatsapp_number), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)')
      .eq('id', gatePassId)
      .single();
    return data;
  };

  // Pagination functions
  const getCurrentPageItems = (items: any[], currentPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const filterProducts = (items: any[]) => {
    const normalizedSearch = productSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name?.toLowerCase().includes(normalizedSearch) ||
        item.store_name?.toLowerCase().includes(normalizedSearch) ||
        item.department_name?.toLowerCase().includes(normalizedSearch);
      const createdAt = item.created_at ? new Date(item.created_at) : null;
      const matchesFrom = !productDateFrom || (createdAt && createdAt >= startOfDay(new Date(productDateFrom)));
      const matchesTo = !productDateTo || (createdAt && createdAt <= endOfDay(new Date(productDateTo)));
      return matchesSearch && matchesFrom && matchesTo;
    });
  };

  const filterGatePasses = (items: any[]) => {
    const normalizedSearch = gatePassSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.product_name?.toLowerCase().includes(normalizedSearch) ||
        item.status?.toLowerCase().includes(normalizedSearch) ||
        item.stores?.name?.toLowerCase().includes(normalizedSearch) ||
        item.gates?.name?.toLowerCase().includes(normalizedSearch);
      const createdAt = item.created_at ? new Date(item.created_at) : null;
      const matchesFrom = !gatePassDateFrom || (createdAt && createdAt >= startOfDay(new Date(gatePassDateFrom)));
      const matchesTo = !gatePassDateTo || (createdAt && createdAt <= endOfDay(new Date(gatePassDateTo)));
      return matchesSearch && matchesFrom && matchesTo;
    });
  };

  const isProductFilterActive = Boolean(productSearch || productDateFrom || productDateTo);
  const isGatePassFilterActive = Boolean(gatePassSearch || gatePassDateFrom || gatePassDateTo);

  const openFilterDialog = (tab: 'products' | 'gatepass') => {
    setFilterDialogTab(tab);
    setFilterDialogOpen(true);
  };

  const clearProductFilters = () => {
    setProductSearch("");
    setProductDateFrom("");
    setProductDateTo("");
    setProductPage(1);
  };

  const clearGatePassFilters = () => {
    setGatePassSearch("");
    setGatePassDateFrom("");
    setGatePassDateTo("");
    setGatePassPage(1);
  };

  const applyFilterDialog = () => {
    setFilterDialogOpen(false);
  };

  const resetPaginationOnTabChange = (tab: string) => {
    if (tab === 'products') {
      setProductPage(1);
    } else if (tab === 'gatepass') {
      setGatePassPage(1);
    }
  };

  useRealtimeSubscription({
    table: "products",
    filter: deptInfo ? { column: "department_id", value: deptInfo.id } : undefined,
    onInsert: (newProduct) => {
      setProducts((prev) => prev.some(p => p.id === newProduct.id) ? prev : [newProduct, ...prev]);
      setProductPage(1); // Reset to first page when new product is added
      void upsertCached('products', newProduct);
      playAlert("New product entry for your department");
      toast.info("New product received!");
    },
    onUpdate: (updated) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      void upsertCached('products', updated);
    },
    onDelete: (deleted) => {
      setProducts((prev) => {
        const updated = prev.filter(p => p.id !== deleted.id);
        // Adjust page if current page becomes empty
        const totalPages = Math.ceil(updated.length / itemsPerPage);
        if (productPage > totalPages && totalPages > 0) {
          setProductPage(totalPages);
        }
        return updated;
      });
      void deleteCached('products', deleted.id);
    },
    enabled: !!deptInfo,
  });

  useRealtimeSubscription({
    table: "gate_passes",
    filter: deptInfo ? { column: "department_id", value: deptInfo.id } : undefined,
    onInsert: async (newPass) => {
      setGatePasses((prev) => prev.some(p => p.id === newPass.id) ? prev : [newPass, ...prev]);
      setGatePassPage(1); // Reset to first page when new gate pass is added
      void upsertCached('gate_passes', newPass);
      const fullPass = await fetchGatePassById(newPass.id);
      if (fullPass) {
        setGatePasses((prev) => prev.some(p => p.id === fullPass.id) ? prev.map(p => p.id === fullPass.id ? fullPass : p) : [fullPass, ...prev]);
        void upsertCached('gate_passes', fullPass);
      }
      playAlert("New gate pass created for your department");
      toast.info("New gate pass!");
    },
    onUpdate: (updated) => {
      setGatePasses((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      void upsertCached('gate_passes', updated);
      playAlert("Gate pass status updated");
      toast.info("Gate pass updated!");
    },
    onDelete: (deleted) => {
      setGatePasses((prev) => {
        const updated = prev.filter(p => p.id !== deleted.id);
        // Adjust page if current page becomes empty
        const totalPages = Math.ceil(updated.length / itemsPerPage);
        if (gatePassPage > totalPages && totalPages > 0) {
          setGatePassPage(totalPages);
        }
        return updated;
      });
      void deleteCached('gate_passes', deleted.id);
    },
    enabled: !!deptInfo,
  });

  // Utility functions for stat cards
  const getTodayDate = () => {
    const today = new Date();
    return startOfDay(today);
  };

  const getTodaysProducts = () => {
    const today = getTodayDate();
    return products.filter(p => new Date(p.created_at) >= today);
  };

  const getPendingProducts = () => {
    return products.filter(p => p.status !== 'received' && p.status !== 'know_about');
  };

  const getTodaysGatePasses = () => {
    const today = getTodayDate();
    return gatePasses.filter(gp => new Date(gp.created_at) >= today);
  };

  const getPendingGatePasses = () => {
    return gatePasses.filter(gp => gp.status === 'created' || gp.status === 'entered');
  };

  const getReceivedProducts = () => {
    return products.filter(p => p.status === 'received');
  };

  const getGateOutPasses = () => {
    return gatePasses.filter(gp => gp.status === 'gate_out');
  };

  const handleCreateGatePass = async () => {
    const validItems = productItems.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    if (!deptInfo) return;

    if (!selectedStore) {
      toast.error("Please select a store");
      return;
    }

    if (!selectedGate) {
      toast.error("Please select a gate");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login again");

      const productNameSummary = validItems.map(i => i.name.trim()).join(', ');
      const totalQuantity = validItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

      const { data: newPass, error } = await supabase
        .from("gate_passes")
        .insert({
          office_id: deptInfo.office_id,
          store_id: selectedStore || null,
          department_id: deptInfo.id,
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
          last_action_role: "department",
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
          action_by_name: userName || "Department",
          action_role: "department",
        });
      }

      // Send notifications to selected store and gate
      if (newPass?.id) {
        const targets: { table: 'departments' | 'stores' | 'gates'; id: string }[] = [];
        if (selectedStore) targets.push({ table: 'stores', id: selectedStore });
        if (selectedGate) targets.push({ table: 'gates', id: selectedGate });

        const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || '';
        const selectedGateName = gates.find(g => g.id === selectedGate)?.name || '';

        console.log('📤 Attempting to send notifications...', { selectedStore, selectedGate, targets });

        await sendNotificationsToEntities({
          officeId: deptInfo.office_id,
          title: '📋 New Gate Pass',
          message: `${productNameSummary} (Qty: ${totalQuantity}) - Dept: ${deptInfo.name}${selectedStoreName ? ` - Store: ${selectedStoreName}` : ''}${selectedGateName ? ` - Gate: ${selectedGateName}` : ''}`,
          type: 'gate_pass',
          relatedGatePassId: newPass.id,
          targetEntityIds: targets,
        }).catch(err => console.error('💥 Notification send failed:', err));
      }

      toast.success("Gate pass created!");
      playAlert("Gate pass created");

      // WhatsApp to store
      const selectedStoreInfo = stores.find((s) => s.id === selectedStore);
      if (selectedStoreInfo?.whatsapp_number) {
        let phoneNumber = selectedStoreInfo.whatsapp_number.replace(/\D/g, "");
        if (phoneNumber.startsWith("0")) phoneNumber = "880" + phoneNumber.substring(1);
        const message = encodeURIComponent(
          `New Gate Pass\nProducts: ${productNameSummary}\nQty: ${totalQuantity}\nSender: ${senderName || "N/A"}\nReceiver: ${receiverName || "N/A"}\nDepartment: ${deptInfo?.name}\nStore: ${selectedStoreInfo.name}\nPurpose: ${purpose || "Transfer"}`
        );
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
      }

      setCreateDialog(false);
      setSelectedStore("");
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

  const filteredProducts = filterProducts(products);
  const filteredGatePasses = filterGatePasses(gatePasses);

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
            />
            <div className="icon-container w-10 h-10 sm:w-12 sm:h-12" style={{ background: "linear-gradient(135deg, hsl(38 92% 50%), hsl(38 80% 45%))" }}>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="page-title text-lg sm:text-xl">{deptInfo?.name || "Department"}</h1>
              <p className="page-description text-xs sm:text-sm">{deptInfo?.offices?.name || "Office"}</p>
            </div>
          </div>
          
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
          <Card className="border-border/50 bg-warning/5">
            <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Dept</p>
                <p className="font-semibold text-xs sm:text-sm truncate max-w-[60px] sm:max-w-none">{deptInfo?.name}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-success/5">
            <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
                <StoreIcon className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Stores</p>
                <p className="font-semibold text-xs sm:text-sm">{stores.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-primary/5">
            <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <DoorOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Gates</p>
                <p className="font-semibold text-xs sm:text-sm">{gates.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stat Cards for Department */}
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-2 mt-4 sm:mt-6">
          {/* Total Gate Entries */}
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

          {/* Today's Gate Entries */}
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

          {/* Pending Gate Entries */}
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

          {/* Total Gate Passes */}
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

          {/* Today's Gate Passes */}
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

          {/* Pending Gate Passes */}
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

          {/* Received Products */}
          <Card 
            className="border-border/50 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500 hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('received-products');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-emerald-500/10">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Received</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getReceivedProducts().length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Gate Pass Out Total */}
          <Card 
            className="border-border/50 bg-cyan-500/5 cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSelectedDetailsType('gate-out-passes');
              setShowDetailsModal(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="p-1.5 rounded-md bg-cyan-500/10">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-600" />
                </div>
                <p className="text-[8px] sm:text-xs text-muted-foreground font-medium leading-tight">Out Total</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{getGateOutPasses().length}</p>
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
          </TabsList>

          <TabsContent value="gatepass">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Gate Passes</CardTitle>
                <Button className="gap-2" onClick={() => setCreateDialog(true)}>
                  <Plus className="h-4 w-4" /> Create Gate Pass
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openFilterDialog('gatepass')}>
                      <Search className="h-4 w-4" /> Filter
                    </Button>
                    {isGatePassFilterActive && (
                      <Button variant="ghost" size="sm" onClick={clearGatePassFilters}>
                        Clear
                      </Button>
                    )}
                  </div>
                  {isGatePassFilterActive && (
                    <p className="text-sm text-muted-foreground">Gate pass filter active</p>
                  )}
                </div>
                {filteredGatePasses.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">No gate passes</p>
                    <p className="text-sm text-muted-foreground">
                      {gatePassSearch || gatePassDateFrom || gatePassDateTo ? "No gate passes match your filters." : "Gate passes for your department will appear here"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getCurrentPageItems(filteredGatePasses, gatePassPage).map((pass, index) => (
                        <div key={pass.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                          <GatePassCard
                            gatePass={pass}
                            userRole="department"
                            userName={userName}
                            onStatusUpdate={() => deptInfo && fetchGatePasses(deptInfo.id)}
                            showEditButton
                            showDeleteButton
                            autoOpen={highlightGatePassId === pass.id}
                          />
                        </div>
                      ))}
                    </div>
                    {getTotalPages(filteredGatePasses.length) > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGatePassPage(prev => Math.max(1, prev - 1))}
                          disabled={gatePassPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {gatePassPage} of {getTotalPages(filteredGatePasses.length)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGatePassPage(prev => Math.min(getTotalPages(filteredGatePasses.length), prev + 1))}
                          disabled={gatePassPage === getTotalPages(filteredGatePasses.length)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader><CardTitle className="text-lg">Incoming Gate Entries</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openFilterDialog('products')}>
                      <Search className="h-4 w-4" /> Filter
                    </Button>
                    {isProductFilterActive && (
                      <Button variant="ghost" size="sm" onClick={clearProductFilters}>
                        Clear
                      </Button>
                    )}
                  </div>
                  {isProductFilterActive && (
                    <p className="text-sm text-muted-foreground">Gate entry filter active</p>
                  )}
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-medium text-foreground mb-1">No incoming gate entries</p>
                    <p className="text-sm text-muted-foreground">
                      {productSearch || productDateFrom || productDateTo ? "No gate entries match your filters." : "Gate entries sent to your department will appear here"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getCurrentPageItems(filteredProducts, productPage).map((product, index) => (
                        <div key={product.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                          <ProductCard product={product} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchProducts(deptInfo.id)} autoOpen={highlightProductId === product.id} />
                        </div>
                      ))}
                    </div>
                    {getTotalPages(filteredProducts.length) > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                          disabled={productPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {productPage} of {getTotalPages(filteredProducts.length)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProductPage(prev => Math.min(getTotalPages(filteredProducts.length), prev + 1))}
                          disabled={productPage === getTotalPages(filteredProducts.length)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" /> Filter {filterDialogTab === 'gatepass' ? 'Gate Passes' : 'Gate Entries'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder={filterDialogTab === 'gatepass' ? 'Search gate passes...' : 'Search gate entries...'}
                value={filterDialogTab === 'gatepass' ? gatePassSearch : productSearch}
                onChange={(e) => filterDialogTab === 'gatepass' ? setGatePassSearch(e.target.value) : setProductSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={filterDialogTab === 'gatepass' ? gatePassDateFrom : productDateFrom}
                  onChange={(e) => filterDialogTab === 'gatepass' ? setGatePassDateFrom(e.target.value) : setProductDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  value={filterDialogTab === 'gatepass' ? gatePassDateTo : productDateTo}
                  onChange={(e) => filterDialogTab === 'gatepass' ? setGatePassDateTo(e.target.value) : setProductDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button className="w-full" onClick={applyFilterDialog}>
                Apply
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={filterDialogTab === 'gatepass' ? clearGatePassFilters : clearProductFilters}
                disabled={filterDialogTab === 'gatepass' ? !isGatePassFilterActive : !isProductFilterActive}
              >
                Clear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Label>Store <span className="text-destructive">*</span></Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gate <span className="text-destructive">*</span></Label>
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

            <Button className="w-full" onClick={handleCreateGatePass} disabled={submitting || productItems.filter(i => i.name.trim()).length === 0 || !selectedStore || !selectedGate}>
              {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>) : "Create Gate Pass"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal for Stat Cards */}
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
              {selectedDetailsType === 'received-products' && 'Received Products'}
              {selectedDetailsType === 'gate-out-passes' && 'Gate Out Passes'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {selectedDetailsType?.includes('entries') && (
              <>
                {selectedDetailsType === 'total-entries' && products.length === 0 && <p className="text-muted-foreground">No gate entries found.</p>}
                {selectedDetailsType === 'today-entries' && getTodaysProducts().length === 0 && <p className="text-muted-foreground">No today entries found.</p>}
                {selectedDetailsType === 'pending-entries' && getPendingProducts().length === 0 && <p className="text-muted-foreground">No pending entries found.</p>}
                
                {selectedDetailsType === 'total-entries' && products.map((product) => (
                  <ProductCard key={product.id} product={product} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchProducts(deptInfo.id)} />
                ))}
                {selectedDetailsType === 'today-entries' && getTodaysProducts().map((product) => (
                  <ProductCard key={product.id} product={product} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchProducts(deptInfo.id)} />
                ))}
                {selectedDetailsType === 'pending-entries' && getPendingProducts().map((product) => (
                  <ProductCard key={product.id} product={product} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchProducts(deptInfo.id)} />
                ))}
              </>
            )}

            {selectedDetailsType?.includes('passes') && (
              <>
                {selectedDetailsType === 'total-passes' && gatePasses.length === 0 && <p className="text-muted-foreground">No gate passes found.</p>}
                {selectedDetailsType === 'today-passes' && getTodaysGatePasses().length === 0 && <p className="text-muted-foreground">No today passes found.</p>}
                {selectedDetailsType === 'pending-passes' && getPendingGatePasses().length === 0 && <p className="text-muted-foreground">No pending passes found.</p>}
                {selectedDetailsType === 'gate-out-passes' && getGateOutPasses().length === 0 && <p className="text-muted-foreground">No gate out passes found.</p>}
                
                {selectedDetailsType === 'total-passes' && gatePasses.map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchGatePasses(deptInfo.id)} />
                ))}
                {selectedDetailsType === 'today-passes' && getTodaysGatePasses().map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchGatePasses(deptInfo.id)} />
                ))}
                {selectedDetailsType === 'pending-passes' && getPendingGatePasses().map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchGatePasses(deptInfo.id)} />
                ))}
                {selectedDetailsType === 'gate-out-passes' && getGateOutPasses().map((pass) => (
                  <GatePassCard key={pass.id} gatePass={pass} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchGatePasses(deptInfo.id)} />
                ))}
              </>
            )}

            {selectedDetailsType === 'received-products' && (
              <>
                {getReceivedProducts().length === 0 && <p className="text-muted-foreground">No received products found.</p>}
                {getReceivedProducts().map((product) => (
                  <ProductCard key={product.id} product={product} userRole="department" userName={userName} onStatusUpdate={() => deptInfo && fetchProducts(deptInfo.id)} />
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {deptInfo && (
        <ChatDialog open={showChat} onOpenChange={setShowChat} officeId={deptInfo.office_id} currentUserId={userId} currentUserRole="department" currentUserName={userName} title="Department Chat" />
      )}
    </div>
  );
};

export default DepartmentPage;
