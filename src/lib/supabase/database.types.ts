export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string
          client_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string | null
          subject: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          subject: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          subject?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      advisors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_type: Database["public"]["Enums"]["org_type"] | null
          region_id: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_type?: Database["public"]["Enums"]["org_type"] | null
          region_id: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_type?: Database["public"]["Enums"]["org_type"] | null
          region_id?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          last_activity_at: string | null
          notes: string | null
          opportunity_id: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          last_activity_at?: string | null
          notes?: string | null
          opportunity_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          last_activity_at?: string | null
          notes?: string | null
          opportunity_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          contract_value: number
          created_at: string
          currency: string
          expected_delivery_date: string
          id: string
          is_at_risk: boolean
          opportunity_id: string
          signed_date: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_value: number
          created_at?: string
          currency: string
          expected_delivery_date: string
          id?: string
          is_at_risk?: boolean
          opportunity_id: string
          signed_date: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_value?: number
          created_at?: string
          currency?: string
          expected_delivery_date?: string
          id?: string
          is_at_risk?: boolean
          opportunity_id?: string
          signed_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          country_of_origin: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          country_of_origin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          country_of_origin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          advisor_id: string | null
          budget_status: Database["public"]["Enums"]["budget_status"] | null
          client_id: string | null
          country: string
          created_at: string
          currency: string | null
          description: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          is_at_risk: boolean
          last_activity_at: string | null
          lead_source: Database["public"]["Enums"]["lead_source"]
          next_step: string | null
          probability_pct: number | null
          prospect_company_name: string
          prospect_contact_email: string | null
          prospect_contact_name: string | null
          prospect_contact_phone: string | null
          prospect_organization_type:
            | Database["public"]["Enums"]["org_type"]
            | null
          prospect_website: string | null
          region_id: string
          registration_date: string
          requirement_type: string
          rsm_id: string
          sector_id: string
          special_license_required: boolean
          stage_id: string
          updated_at: string
        }
        Insert: {
          advisor_id?: string | null
          budget_status?: Database["public"]["Enums"]["budget_status"] | null
          client_id?: string | null
          country: string
          created_at?: string
          currency?: string | null
          description: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          is_at_risk?: boolean
          last_activity_at?: string | null
          lead_source: Database["public"]["Enums"]["lead_source"]
          next_step?: string | null
          probability_pct?: number | null
          prospect_company_name: string
          prospect_contact_email?: string | null
          prospect_contact_name?: string | null
          prospect_contact_phone?: string | null
          prospect_organization_type?:
            | Database["public"]["Enums"]["org_type"]
            | null
          prospect_website?: string | null
          region_id: string
          registration_date: string
          requirement_type: string
          rsm_id: string
          sector_id: string
          special_license_required?: boolean
          stage_id: string
          updated_at?: string
        }
        Update: {
          advisor_id?: string | null
          budget_status?: Database["public"]["Enums"]["budget_status"] | null
          client_id?: string | null
          country?: string
          created_at?: string
          currency?: string | null
          description?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          is_at_risk?: boolean
          last_activity_at?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"]
          next_step?: string | null
          probability_pct?: number | null
          prospect_company_name?: string
          prospect_contact_email?: string | null
          prospect_contact_name?: string | null
          prospect_contact_phone?: string | null
          prospect_organization_type?:
            | Database["public"]["Enums"]["org_type"]
            | null
          prospect_website?: string | null
          region_id?: string
          registration_date?: string
          requirement_type?: string
          rsm_id?: string
          sector_id?: string
          special_license_required?: boolean
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_rsm_id_fkey"
            columns: ["rsm_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_products: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          partner_contact_email: string | null
          partner_contact_name: string | null
          partner_contact_phone: string | null
          partner_mnda_status: Database["public"]["Enums"]["mnda_status"] | null
          product_id: string | null
          product_name_freetext: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          partner_contact_email?: string | null
          partner_contact_name?: string | null
          partner_contact_phone?: string | null
          partner_mnda_status?:
            | Database["public"]["Enums"]["mnda_status"]
            | null
          product_id?: string | null
          product_name_freetext?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          partner_contact_email?: string | null
          partner_contact_name?: string | null
          partner_contact_phone?: string | null
          partner_mnda_status?:
            | Database["public"]["Enums"]["mnda_status"]
            | null
          product_id?: string | null
          product_name_freetext?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_products_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          datasheet_url: string | null
          description: string | null
          id: string
          is_active: boolean
          manufacturer_id: string
          margin_pct: number | null
          name: string
          sector_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer_id: string
          margin_pct?: number | null
          name: string
          sector_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer_id?: string
          margin_pct?: number | null
          name?: string
          sector_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          created_at: string
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sectors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          region_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          sector_scope: Database["public"]["Enums"]["sector_scope"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          region_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          sector_scope?: Database["public"]["Enums"]["sector_scope"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          region_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sector_scope?: Database["public"]["Enums"]["sector_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_has_sector: { Args: { p_sector_id: string }; Returns: boolean }
      auth_region_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_sector_scope: {
        Args: never
        Returns: Database["public"]["Enums"]["sector_scope"]
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "email"
        | "meeting"
        | "demo"
        | "site_visit"
        | "internal_review"
      budget_status: "not_yet_secured" | "secured"
      client_status: "active" | "inactive" | "former"
      lead_source:
        | "cold_outreach"
        | "partner"
        | "inbound"
        | "diplomatic"
        | "marketing"
      mnda_status: "not_required" | "pending" | "sent" | "signed"
      org_type:
        | "ministry_of_defense"
        | "defense_agency"
        | "intelligence"
        | "police_hls"
        | "government"
        | "private"
        | "other"
      sector_scope: "all" | "own_sectors_only"
      user_role: "admin" | "rsm" | "sector_manager"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "call",
        "email",
        "meeting",
        "demo",
        "site_visit",
        "internal_review",
      ],
      budget_status: ["not_yet_secured", "secured"],
      client_status: ["active", "inactive", "former"],
      lead_source: [
        "cold_outreach",
        "partner",
        "inbound",
        "diplomatic",
        "marketing",
      ],
      mnda_status: ["not_required", "pending", "sent", "signed"],
      org_type: [
        "ministry_of_defense",
        "defense_agency",
        "intelligence",
        "police_hls",
        "government",
        "private",
        "other",
      ],
      sector_scope: ["all", "own_sectors_only"],
      user_role: ["admin", "rsm", "sector_manager"],
    },
  },
} as const

