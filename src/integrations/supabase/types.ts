export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      departments: {
        Row: {
          created_at: string
          department_code: string
          id: string
          name: string
          office_id: string
          status: string | null
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          department_code: string
          id?: string
          name: string
          office_id: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          department_code?: string
          id?: string
          name?: string
          office_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_pass_items: {
        Row: {
          created_at: string | null
          gate_pass_id: string
          id: string
          name: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          gate_pass_id: string
          id?: string
          name: string
          quantity?: number
        }
        Update: {
          created_at?: string | null
          gate_pass_id?: string
          id?: string
          name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "gate_pass_items_gate_pass_id_fkey"
            columns: ["gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_pass_timeline: {
        Row: {
          action_by: string | null
          action_by_name: string | null
          action_role: string | null
          created_at: string | null
          gate_pass_id: string
          id: string
          status: string
        }
        Insert: {
          action_by?: string | null
          action_by_name?: string | null
          action_role?: string | null
          created_at?: string | null
          gate_pass_id: string
          id?: string
          status: string
        }
        Update: {
          action_by?: string | null
          action_by_name?: string | null
          action_role?: string | null
          created_at?: string | null
          gate_pass_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_pass_timeline_gate_pass_id_fkey"
            columns: ["gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_passes: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          expected_date: string | null
          gate_id: string | null
          id: string
          last_action_at: string | null
          last_action_by: string | null
          last_action_role: string | null
          office_id: string
          product_name: string
          purpose: string | null
          quantity: number | null
          receiver_company: string | null
          receiver_name: string | null
          rejection_reason: string | null
          remarks: string | null
          sender_company: string | null
          sender_name: string | null
          status: string | null
          store_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expected_date?: string | null
          gate_id?: string | null
          id?: string
          last_action_at?: string | null
          last_action_by?: string | null
          last_action_role?: string | null
          office_id: string
          product_name: string
          purpose?: string | null
          quantity?: number | null
          receiver_company?: string | null
          receiver_name?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          sender_company?: string | null
          sender_name?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expected_date?: string | null
          gate_id?: string | null
          id?: string
          last_action_at?: string | null
          last_action_by?: string | null
          last_action_role?: string | null
          office_id?: string
          product_name?: string
          purpose?: string | null
          quantity?: number | null
          receiver_company?: string | null
          receiver_name?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          sender_company?: string | null
          sender_name?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gate_passes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gates: {
        Row: {
          created_at: string
          gate_code: string
          id: string
          name: string
          office_id: string
          status: string | null
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          gate_code: string
          id?: string
          name: string
          office_id: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          gate_code?: string
          id?: string
          name?: string
          office_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      login_sessions: {
        Row: {
          browser: string | null
          device_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_seen_at: string
          login_at: string
          logout_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen_at?: string
          login_at?: string
          logout_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen_at?: string
          login_at?: string
          logout_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          gate_pass_id: string | null
          id: string
          is_read: boolean | null
          message: string
          office_id: string
          product_id: string | null
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          gate_pass_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          office_id: string
          product_id?: string | null
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          gate_pass_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          office_id?: string
          product_id?: string | null
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_gate_pass_id_fkey"
            columns: ["gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          office_id: string
          related_gate_pass_id: string | null
          related_product_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          office_id: string
          related_gate_pass_id?: string | null
          related_product_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          office_id?: string
          related_gate_pass_id?: string | null
          related_product_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_gate_pass_id_fkey"
            columns: ["related_gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_items: {
        Row: {
          created_at: string | null
          id: string
          name: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_timeline: {
        Row: {
          action_by: string | null
          action_by_name: string | null
          action_role: string | null
          created_at: string | null
          id: string
          product_id: string
          status: string
        }
        Insert: {
          action_by?: string | null
          action_by_name?: string | null
          action_role?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          status: string
        }
        Update: {
          action_by?: string | null
          action_by_name?: string | null
          action_role?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_timeline_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          gate_id: string | null
          id: string
          image_url: string | null
          last_action_at: string | null
          last_action_by: string | null
          last_action_role: string | null
          name: string
          office_id: string
          phone: string | null
          quantity: number | null
          receiver_company: string | null
          receiver_name: string | null
          remarks: string | null
          sender_company: string | null
          sender_name: string | null
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gate_id?: string | null
          id?: string
          image_url?: string | null
          last_action_at?: string | null
          last_action_by?: string | null
          last_action_role?: string | null
          name: string
          office_id: string
          phone?: string | null
          quantity?: number | null
          receiver_company?: string | null
          receiver_name?: string | null
          remarks?: string | null
          sender_company?: string | null
          sender_name?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gate_id?: string | null
          id?: string
          image_url?: string | null
          last_action_at?: string | null
          last_action_by?: string | null
          last_action_role?: string | null
          name?: string
          office_id?: string
          phone?: string | null
          quantity?: number | null
          receiver_company?: string | null
          receiver_name?: string | null
          remarks?: string | null
          sender_company?: string | null
          sender_name?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          id: string
          name: string
          office_id: string
          status: string | null
          store_code: string
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          office_id: string
          status?: string | null
          store_code: string
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          office_id?: string
          status?: string | null
          store_code?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_admins: {
        Row: {
          access_id: string
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_id: string
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_office_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      jwt_user_role: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "gate" | "store" | "department" | "sub_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gate", "store", "department", "sub_admin"],
    },
  },
} as const
