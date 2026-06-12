import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Truck,
  CheckCircle2,
  ArrowRightFromLine,
  ArrowLeftToLine,
  Loader2,
  ClipboardCheck,
  Undo2,
  Clock,
  Pencil,
  Trash2,
  MessageCircle,
  DoorOpen,
  Users,
  ChevronRight,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import GatePassFlowTimeline, {
  GatePassStatusBadge,
  GatePassFlowProgress,
  getGatePassStatusConfig,
} from "./GatePassFlowTimeline";
import GatePassEditDialog from "./GatePassEditDialog";
import ChatButton from "./ChatIcon";
import ChatDialog from "./ChatDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";

interface TimelineEvent {
  id: string;
  status: string;
  action_by_name: string | null;
  action_role: string | null;
  created_at: string;
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
  sender_company?: string | null;
  receiver_company?: string | null;
  created_at: string;
  created_by?: string;
  remarks?: string | null;
  department_id?: string | null;
  store_id?: string | null;
  departments?: { name: string; whatsapp_number?: string | null };
  stores?: { name: string; whatsapp_number?: string | null };
  gates?: { name: string; whatsapp_number?: string | null };
  gate_pass_items?: { id: string; name: string; quantity: number }[];
}

interface GatePassCardProps {
  gatePass: GatePass;
  userRole: "gate" | "store" | "department";
  userName: string;
  onStatusUpdate?: () => void;
  createdByRole?: "department" | "store";
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  autoOpen?: boolean;
}

const GatePassCard: React.FC<GatePassCardProps> = ({
  gatePass,
  userRole,
  userName,
  onStatusUpdate,
  createdByRole = "department",
  showEditButton = false,
  showDeleteButton = false,
  autoOpen = false,
}) => {
  const [showDetail, setShowDetail] = useState(autoOpen);
  const [showChat, setShowChat] = useState(false);
  const [showBackDialog, setShowBackDialog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [backRemark, setBackRemark] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [updating, setUpdating] = useState(false);
  const [clickedWhatsAppNumbers, setClickedWhatsAppNumbers] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const cardRef = React.useRef<HTMLDivElement>(null);
  const { color: themeColor } = useTheme();

  const borderClass = React.useMemo(() => {
    switch (themeColor) {
      case 'navy': return 'border-blue-500/30';
      case 'emerald': return 'border-emerald-500/30';
      case 'purple': return 'border-purple-500/30';
      case 'rose': return 'border-rose-500/30';
      case 'amber': return 'border-amber-500/30';
      case 'slate': return 'border-slate-500/30';
      default: return 'border-primary/30';
    }
  }, [themeColor]);

  // React to autoOpen from notification deep links: open detail + scroll into view
  React.useEffect(() => {
    if (autoOpen) {
      setShowDetail(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      fetchTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const fetchTimeline = async () => {
    const { data } = await supabase
      .from("gate_pass_timeline")
      .select("*")
      .eq("gate_pass_id", gatePass.id)
      .order("created_at", { ascending: false });
    setTimeline(data || []);
  };

  const handleOpenDetail = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    setShowDetail(true);
    fetchTimeline();
  };

  const handleOpenChat = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    setShowChat(true);
  };

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Get gate pass details for notifications
      const { data: gatePassData } = await supabase
        .from("gate_passes")
        .select(
          "office_id, department_id, store_id, departments(user_id), stores(user_id)",
        )
        .eq("id", gatePass.id)
        .single();

      // Also get gates for this office
      let gateUsers: string[] = [];
      if (gatePassData?.office_id) {
        const { data: gates } = await supabase
          .from("gates")
          .select("user_id")
          .eq("office_id", gatePassData.office_id)
          .not("user_id", "is", null);
        gateUsers = gates?.map((g) => g.user_id).filter(Boolean) || [];
      }

      await supabase
        .from("gate_passes")
        .update({
          status: newStatus,
          last_action_by: user?.id,
          last_action_role: userRole,
          last_action_at: new Date().toISOString(),
        })
        .eq("id", gatePass.id);

      await supabase.from("gate_pass_timeline").insert({
        gate_pass_id: gatePass.id,
        status: newStatus,
        action_by: user?.id,
        action_by_name: userName || "Unknown",
        action_role: userRole,
      });

      //.............. Start Here Auto WhatsApp on gate_out......................
      if (newStatus === "gate_out") {
        // Fetch store & department whatsapp numbers
        const { data: gpData } = await supabase
          .from("gate_passes")
          .select(
            "stores(name, whatsapp_number), departments(name, whatsapp_number)",
          )
          .eq("id", gatePass.id)
          .single();

        const message = encodeURIComponent(
          `  Gate Out: Your ${gatePass.product_name} has successfully exited the gate.

             Product: ${gatePass.product_name}
             Qty: ${gatePass.quantity}
             Store: ${gpData?.stores?.name || "N/A"}
             Department: ${gpData?.departments?.name || "N/A"}
             Purpose: ${gatePass.purpose || "N/A"}
             Time: ${new Date().toLocaleString()}
             Gate Out by: ${userName}`,
                    );

        // Priority: Store number first, then Department
        const rawNumber =
          gpData?.stores?.whatsapp_number?.split(",")[0]?.trim() ||
          gpData?.departments?.whatsapp_number?.split(",")[0]?.trim() ||
          "";

        if (!rawNumber) return;

        // Clean number
        let cleanNumber = rawNumber.replace(/[^0-9]/g, "");

        // Convert 017 → 88017
        if (cleanNumber.startsWith("0")) {
          cleanNumber = "880" + cleanNumber.substring(1);
        }

        // Open single WhatsApp chat
        const url = `https://wa.me/${cleanNumber}?text=${message}`;
        window.open(url, "_blank");
      }
      //.............. End Here Auto WhatsApp on gate_out.......................


      // Create notifications for relevant users
      if (gatePassData) {
        const notifications = [];
        const statusLabel = getGatePassStatusConfig(newStatus).label;

        // Notify store user
        if (
          gatePassData.stores?.user_id &&
          gatePassData.stores.user_id !== user?.id
        ) {
          notifications.push({
            user_id: gatePassData.stores.user_id,
            office_id: gatePassData.office_id,
            title: `Gate Pass ${statusLabel}`,
            message: `${gatePass.product_name} status updated to ${statusLabel} by ${userName}`,
            type: "gate_pass",
            is_read: false,
            related_gate_pass_id: gatePass.id,
          });
        }

        // Notify department user
        if (
          gatePassData.departments?.user_id &&
          gatePassData.departments.user_id !== user?.id
        ) {
          notifications.push({
            user_id: gatePassData.departments.user_id,
            office_id: gatePassData.office_id,
            title: `Gate Pass ${statusLabel}`,
            message: `${gatePass.product_name} status updated to ${statusLabel} by ${userName}`,
            type: "gate_pass",
            is_read: false,
            related_gate_pass_id: gatePass.id,
          });
        }

        // Notify gate users for relevant statuses
        if (
          gateUsers.length > 0 &&
          (newStatus === "on_the_way_gate" ||
            newStatus === "gate_out" ||
            newStatus === "gate_in")
        ) {
          for (const gateUserId of gateUsers) {
            if (gateUserId !== user?.id) {
              notifications.push({
                user_id: gateUserId,
                office_id: gatePassData.office_id,
                title: `Gate Pass ${statusLabel}`,
                message: `${gatePass.product_name} status updated to ${statusLabel}`,
                type: "gate_pass",
                is_read: false,
                related_gate_pass_id: gatePass.id,
              });
            }
          }
        }

        if (notifications.length > 0) {
          const { error: notifError } = await supabase.from("notifications").insert(notifications);
          if (notifError) {
            console.error('Notification creation failed:', notifError);
          }
        }
      }

      toast.success(
        `Status updated to ${getGatePassStatusConfig(newStatus).label}`,
      );
      fetchTimeline();
      onStatusUpdate?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  // Handle back with remark
  const handleBackWithRemark = async () => {
    if (!backRemark.trim()) {
      toast.error("Please enter a reason for returning");
      return;
    }

    setUpdating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase
        .from("gate_passes")
        .update({
          status: "created",
          rejection_reason: backRemark.trim(),
          last_action_by: user?.id,
          last_action_role: userRole,
          last_action_at: new Date().toISOString(),
        })
        .eq("id", gatePass.id);

      await supabase.from("gate_pass_timeline").insert({
        gate_pass_id: gatePass.id,
        status: "returned",
        action_by: user?.id,
        action_by_name: `${userName} - ${backRemark.trim()}`,
        action_role: userRole,
      });

      toast.success("Gate pass returned");
      setShowBackDialog(false);
      setBackRemark("");
      fetchTimeline();
      onStatusUpdate?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to return gate pass");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this gate pass?"))
      return;

    try {
      // First delete timeline entries
      await supabase
        .from("gate_pass_timeline")
        .delete()
        .eq("gate_pass_id", gatePass.id);

      const { error } = await supabase
        .from("gate_passes")
        .delete()
        .eq("id", gatePass.id);

      if (error) throw error;

      toast.success("Gate pass deleted");
      onStatusUpdate?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to delete gate pass");
    }
  };

  const getActionButtons = () => {
    const buttons: {
      label: string;
      status: string;
      icon: React.ReactNode;
      variant: "default" | "destructive" | "outline";
    }[] = [];
    const status = gatePass.status.toLowerCase();

    // Store actions
    if (userRole === "store") {
      if (status === "created") {
        buttons.push({
          label: "Check",
          status: "store_check",
          icon: <ClipboardCheck className="h-4 w-4" />,
          variant: "outline",
        });
        buttons.push({
          label: "Ready & Send",
          status: "on_the_way_gate",
          icon: <Truck className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "store_check") {
        buttons.push({
          label: "Ready Gate Pass",
          status: "ready_gate_pass",
          icon: <CheckCircle2 className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "ready_gate_pass") {
        buttons.push({
          label: "Send to Gate",
          status: "on_the_way_gate",
          icon: <Truck className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "on_the_way_store") {
        buttons.push({
          label: "Received",
          status: "store_received",
          icon: <CheckCircle2 className="h-4 w-4" />,
          variant: "default",
        });
      }
    }

    // Gate actions
    if (userRole === "gate") {
      if (status === "on_the_way_gate") {
        buttons.push({
          label: "Received",
          status: "gate_received",
          icon: <CheckCircle2 className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "gate_received") {
        buttons.push({
          label: "Gate IN",
          status: "gate_in",
          icon: <ArrowLeftToLine className="h-4 w-4" />,
          variant: "default",
        });
        buttons.push({
          label: "Gate OUT",
          status: "gate_out",
          icon: <ArrowRightFromLine className="h-4 w-4" />,
          variant: "destructive",
        });
      }
      if (status === "gate_out") {
        buttons.push({
          label: "Gate IN",
          status: "gate_in",
          icon: <ArrowLeftToLine className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "gate_in") {
        buttons.push({
          label: "Send to Store",
          status: "on_the_way_store",
          icon: <Truck className="h-4 w-4" />,
          variant: "default",
        });
        buttons.push({
          label: "Gate OUT",
          status: "gate_out",
          icon: <ArrowRightFromLine className="h-4 w-4" />,
          variant: "destructive",
        });
      }
    }

    // Department actions
    if (userRole === "department") {
      if (status === "store_received") {
        buttons.push({
          label: "Request Delivery",
          status: "on_the_way_dept",
          icon: <Truck className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (status === "on_the_way_dept") {
        buttons.push({
          label: "Received",
          status: "dept_received",
          icon: <CheckCircle2 className="h-4 w-4" />,
          variant: "default",
        });
      }
    }

    return buttons;
  };

  const actionButtons = getActionButtons();

  // Get clickable statuses for this role
  const getClickableStatuses = (): string[] => {
    const status = gatePass.status.toLowerCase();
    if (userRole === "store") {
      if (status === "created") return ["store_check", "on_the_way_gate"];
      if (status === "store_check") return ["ready_gate_pass"];
      if (status === "ready_gate_pass") return ["on_the_way_gate"];
      if (status === "on_the_way_store") return ["store_received"];
    }
    if (userRole === "gate") {
      if (status === "on_the_way_gate") return ["gate_received"];
      if (status === "gate_received") return ["gate_in", "gate_out"];
      if (status === "gate_in") return ["on_the_way_store", "gate_out"];
      if (status === "gate_out") return ["gate_in"];
    }
    if (userRole === "department") {
      if (status === "store_received") return ["on_the_way_dept"];
      if (status === "on_the_way_dept") return ["dept_received"];
    }
    return [];
  };

  return (
    <>
      <div
        ref={cardRef}
        className={`group flex flex-col h-full p-2.5 sm:p-4 rounded-xl border-2 ${borderClass} bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer`}
        onClick={handleOpenDetail}
      >
        {/* Clickable Flow Progress at TOP */}
        <div onClick={(e) => e.stopPropagation()} className="mb-2 sm:mb-3 -mt-1">
          <GatePassFlowProgress
            currentStatus={gatePass.status}
            createdBy={createdByRole}
            onStepClick={updateStatus}
            clickableStatuses={getClickableStatuses()}
            disabled={updating}
          />
        </div>

        {/* Reverse Entity Hierarchy - Department > Store > Gate */}
        {(gatePass.departments?.name || gatePass.stores?.name || gatePass.gates?.name) && (
          <div className="mb-2 sm:mb-3 p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-amber-500/8 via-purple-500/8 to-blue-500/8 border border-border/50">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap text-[10px] sm:text-xs">
              {/* Department page: Show store and gate */}
              {userRole === 'department' && (
                <>
                  {gatePass.stores?.name && (
                    <>
                      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-emerald-500/10">
                        <Building2 className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-emerald-700 truncate text-[10px] sm:text-xs">{gatePass.stores.name}</span>
                      </div>
                      {gatePass.gates?.name && (
                        <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </>
                  )}
                  {gatePass.gates?.name && (
                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-blue-500/10">
                      <DoorOpen className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-blue-600 flex-shrink-0" />
                      <span className="font-semibold text-blue-700 truncate text-[10px] sm:text-xs">{gatePass.gates.name}</span>
                    </div>
                  )}
                </>
              )}

              {/* Store page: Show gate and department */}
              {userRole === 'store' && (
                <>
                  {gatePass.gates?.name && (
                    <>
                      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-blue-500/10">
                        <DoorOpen className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-blue-700 truncate text-[10px] sm:text-xs">{gatePass.gates.name}</span>
                      </div>
                      {gatePass.departments?.name && (
                        <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </>
                  )}
                  {gatePass.departments?.name && (
                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-500/10">
                      <Users className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-amber-600 flex-shrink-0" />
                      <span className="font-semibold text-amber-700 truncate text-[10px] sm:text-xs">{gatePass.departments.name}</span>
                    </div>
                  )}
                </>
              )}

              {/* Gate page: creator first (Dept>Store>Gate or Store>Dept>Gate) */}
              {userRole === 'gate' && (
                <>
                  {createdByRole === 'store' ? (
                    <>
                      {gatePass.stores?.name && (
                        <>
                          <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-emerald-500/10">
                            <Building2 className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="font-semibold text-emerald-700 truncate text-[10px] sm:text-xs">{gatePass.stores.name}</span>
                          </div>
                          {(gatePass.departments?.name || gatePass.gates?.name) && (
                            <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </>
                      )}
                      {gatePass.departments?.name && (
                        <>
                          <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-500/10">
                            <Users className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-amber-600 flex-shrink-0" />
                            <span className="font-semibold text-amber-700 truncate text-[10px] sm:text-xs">{gatePass.departments.name}</span>
                          </div>
                          {gatePass.gates?.name && (
                            <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {gatePass.departments?.name && (
                        <>
                          <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-500/10">
                            <Users className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-amber-600 flex-shrink-0" />
                            <span className="font-semibold text-amber-700 truncate text-[10px] sm:text-xs">{gatePass.departments.name}</span>
                          </div>
                          {(gatePass.stores?.name || gatePass.gates?.name) && (
                            <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </>
                      )}
                      {gatePass.stores?.name && (
                        <>
                          <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-emerald-500/10">
                            <Building2 className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="font-semibold text-emerald-700 truncate text-[10px] sm:text-xs">{gatePass.stores.name}</span>
                          </div>
                          {gatePass.gates?.name && (
                            <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {gatePass.gates?.name && (
                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-blue-500/10">
                      <DoorOpen className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-blue-600 flex-shrink-0" />
                      <span className="font-semibold text-blue-700 truncate text-[10px] sm:text-xs">{gatePass.gates.name}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-3 sm:h-4 w-3 sm:w-4 text-primary" />
              </div>
              <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate">
                {gatePass.product_name}
              </h4>
            </div>

            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2 ml-4 sm:ml-8">
              Qty: {gatePass.quantity} • {gatePass.purpose}
              {gatePass.sender_company && ` • From: ${gatePass.sender_company}`}
              {gatePass.receiver_company && ` • To: ${gatePass.receiver_company}`}
            </p>
            {/* Show individual items */}
            {gatePass.gate_pass_items && gatePass.gate_pass_items.length > 0 && (
              <div className="mt-1 sm:mt-1.5 ml-4 sm:ml-8 space-y-0.5">
                {gatePass.gate_pass_items.map((item, idx) => (
                  <p key={item.id} className="text-[8px] sm:text-[10px] text-muted-foreground pl-1.5 sm:pl-2 border-l-2 border-primary/30">
                    {idx + 1}. {item.name} × {item.quantity}
                  </p>
                ))}
              </div>
            )}
            {/* Created time */}
            <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-1 ml-4 sm:ml-8 flex items-center gap-1">
              <Clock className="h-2 sm:h-3 w-2 sm:w-3" />
              {format(new Date(gatePass.created_at), "dd MMM yyyy, h:mm a")}
            </p>
          </div>
          <GatePassStatusBadge status={gatePass.status} />
        </div>

        {/* Quick Actions */}
        <div
          className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border flex-wrap gap-1 sm:gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <ChatButton
              officeId={gatePass.office_id}
              gatePassId={gatePass.id}
              currentUserId={userId}
              onClick={handleOpenChat}
            />

            {/*Start Whatsapp icons - separate for each entity */}
            {(() => {
              const waEntries: { label: string; number: string; color: string }[] = [];
              
              // Show all WhatsApp numbers only on department and store pages
              if (userRole === 'department' || userRole === 'store') {
                // Department WhatsApp numbers - hide on department page
                if (userRole !== 'department' && gatePass.departments?.whatsapp_number) {
                  gatePass.departments.whatsapp_number.split(',').forEach(num => {
                    const n = num.trim();
                    if (n) waEntries.push({ label: 'Dept', number: n, color: 'from-amber-500 to-orange-500' });
                  });
                }
                // Store WhatsApp numbers - hide on store page
                if (userRole !== 'store' && gatePass.stores?.whatsapp_number) {
                  gatePass.stores.whatsapp_number.split(',').forEach(num => {
                    const n = num.trim();
                    if (n) waEntries.push({ label: 'Store', number: n, color: 'from-emerald-500 to-teal-500' });
                  });
                }
                // Gate WhatsApp numbers
                if (gatePass.gates?.whatsapp_number) {
                  gatePass.gates.whatsapp_number.split(',').forEach(num => {
                    const n = num.trim();
                    if (n) waEntries.push({ label: 'Gate', number: n, color: 'from-blue-500 to-indigo-500' });
                  });
                }
              }

              const handleWhatsAppClick = (cleanNumber: string) => {
                setClickedWhatsAppNumbers((prev) =>
                  prev.includes(cleanNumber) ? prev : [...prev, cleanNumber]
                );
              };

              if (waEntries.length === 0) return null;

              const message = encodeURIComponent(
                `New Gate Pass\nProducts: ${gatePass.product_name}\n Qty: ${gatePass.quantity}\n Store: ${gatePass.stores?.name || 'N/A'}\n Dept: ${gatePass.departments?.name || 'N/A'}\n Purpose: ${gatePass.purpose || 'N/A'}`
              );

              // On mobile, use dropdown; on desktop, show inline buttons
              const isMobile = window.innerWidth < 768;

              if (isMobile && waEntries.length > 1) {
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 sm:h-8 gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2"
                      >
                        <MessageCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {waEntries.map((entry, idx) => {
                        let cleanNumber = entry.number.replace(/[^0-9]/g, '');
                        if (cleanNumber.startsWith('0')) cleanNumber = '880' + cleanNumber.substring(1);
                        return (
                          <DropdownMenuItem key={idx} asChild>
                            <a
                              href={`https://wa.me/${cleanNumber}?text=${message}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleWhatsAppClick(cleanNumber)}
                              className={`flex items-center gap-2 cursor-pointer rounded-md px-2 py-2 transition-colors ${clickedWhatsAppNumbers.includes(cleanNumber) ? 'bg-slate-700 text-white' : 'hover:bg-muted/80 text-foreground'}`}
                            >
                              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${entry.color}`} />
                              <span>{entry.label}: {entry.number}</span>
                            </a>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // Desktop: show inline buttons
              return waEntries.map((entry, idx) => {
                let cleanNumber = entry.number.replace(/[^0-9]/g, '');
                if (cleanNumber.startsWith('0')) cleanNumber = '880' + cleanNumber.substring(1);
                const isClicked = clickedWhatsAppNumbers.includes(cleanNumber);
                return (
                  <a
                    key={idx}
                    href={`https://wa.me/${cleanNumber}?text=${message}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleWhatsAppClick(cleanNumber)}
                    className={`flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 font-semibold transition-all shadow-sm h-7 sm:h-8 ${isClicked ? 'bg-slate-700 text-white border border-slate-500' : `text-white bg-gradient-to-r ${entry.color}`} hover:shadow-md`}
                    title={`${entry.label}: ${entry.number}`}
                  >
                    <MessageCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                    <span className="text-[8px] sm:text-[10px]">{entry.label}</span>
                  </a>
                );
              });
            })()}
            {/*End Whatsapp icons */}

            {showEditButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 sm:h-8 w-7 sm:w-8"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-3 sm:h-4 w-3 sm:w-4 text-muted-foreground" />
              </Button>
            )}
            {showDeleteButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 sm:h-8 w-7 sm:w-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 sm:h-4 w-3 sm:w-4" />
              </Button>
            )}
          </div>

          {actionButtons.length > 0 && (
            <div className="flex gap-1.5">
              {actionButtons.slice(0, 2).map((btn) => (
                <Button
                  key={btn.status}
                  size="sm"
                  variant={btn.variant}
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => updateStatus(btn.status)}
                  disabled={updating}
                >
                  {updating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    btn.icon
                  )}
                  {btn.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto border border-primary/20 rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Gate Pass Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{gatePass.product_name}</h3>
              <GatePassStatusBadge status={gatePass.status} />
            </div>

            {/* Clickable Flow Progress */}
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Gate Pass Progress (Click to update)
              </p>
              <GatePassFlowProgress
                currentStatus={gatePass.status}
                createdBy={createdByRole}
                onStepClick={updateStatus}
                clickableStatuses={getClickableStatuses()}
                disabled={updating}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-semibold">{gatePass.quantity}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Purpose</p>
                <p className="font-semibold capitalize">{gatePass.purpose}</p>
              </div>
              {gatePass.sender_name && (
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Sender</p>
                  <p className="font-semibold">{gatePass.sender_name}</p>
                </div>
              )}
              {gatePass.receiver_name && (
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Receiver</p>
                  <p className="font-semibold">{gatePass.receiver_name}</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-success/5 border border-primary/10 text-sm">
              <p className="text-xs text-muted-foreground">Route</p>
              <p className="font-semibold">
                {gatePass.stores?.name || "Store"} ↔{" "}
                {gatePass.departments?.name || "Department"}
              </p>
            </div>

            {/* Action Buttons */}
            {actionButtons.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {actionButtons.map((btn) => (
                  <Button
                    key={btn.status}
                    variant={btn.variant}
                    className="gap-2 flex-1 min-w-[120px]"
                    onClick={() => updateStatus(btn.status)}
                    disabled={updating}
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      btn.icon
                    )}
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Chat Button */}
            <div onClick={(e) => e.stopPropagation()}>
              <ChatButton
                officeId={gatePass.office_id}
                gatePassId={gatePass.id}
                currentUserId={userId}
                onClick={handleOpenChat}
                variant="outline"
                size="default"
              />
            </div>

            {/* Back with Remark Button */}
            {userRole === "gate" &&
              (gatePass.status === "on_the_way_gate" ||
                gatePass.status === "gate_received") && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-warning border-warning/30"
                  onClick={() => setShowBackDialog(true)}
                >
                  <Undo2 className="h-4 w-4" />
                  Return with Remark
                </Button>
              )}

            {/* Timeline */}
            <div className="bg-muted/20 rounded-xl p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Live Timeline
              </h4>
              <GatePassFlowTimeline
                events={timeline}
                currentStatus={gatePass.status}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      {userId && (
        <ChatDialog
          open={showChat}
          onOpenChange={setShowChat}
          officeId={gatePass.office_id}
          gatePassId={gatePass.id}
          currentUserId={userId}
          currentUserRole={userRole}
          currentUserName={userName}
          title={`Chat: ${gatePass.product_name}`}
        />
      )}

      {/* Back with Remark Dialog */}
      <Dialog open={showBackDialog} onOpenChange={setShowBackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-warning" />
              Return Gate Pass
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please enter the reason for returning this gate pass:
            </p>
            <Textarea
              placeholder="Enter reason for returning..."
              value={backRemark}
              onChange={(e) => setBackRemark(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowBackDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleBackWithRemark}
                disabled={updating || !backRemark.trim()}
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                Return
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <GatePassEditDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        gatePass={gatePass}
        onSave={onStatusUpdate}
      />
    </>
  );
};

export default GatePassCard;
