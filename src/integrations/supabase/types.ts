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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      enriched_profiles_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          profile: Json
          provider: string
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          profile: Json
          provider: string
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          profile?: Json
          provider?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel: string
          created_at: string
          goal: string
          id: string
          sent_at: string | null
          sent_text: string | null
          target_id: string
          tone: string
          user_id: string
          variants: Json
        }
        Insert: {
          channel: string
          created_at?: string
          goal: string
          id?: string
          sent_at?: string | null
          sent_text?: string | null
          target_id: string
          tone: string
          user_id: string
          variants?: Json
        }
        Update: {
          channel?: string
          created_at?: string
          goal?: string
          id?: string
          sent_at?: string | null
          sent_text?: string | null
          target_id?: string
          tone?: string
          user_id?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accomplishments: string[]
          avatar_url: string | null
          created_at: string
          full_name: string | null
          linkedin_sub: string | null
          normalized_profile: Json | null
          preferred_locations: string[]
          settings: Json
          target_companies: string[]
          target_roles: string[]
          unique_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accomplishments?: string[]
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          linkedin_sub?: string | null
          normalized_profile?: Json | null
          preferred_locations?: string[]
          settings?: Json
          target_companies?: string[]
          target_roles?: string[]
          unique_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accomplishments?: string[]
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          linkedin_sub?: string | null
          normalized_profile?: Json | null
          preferred_locations?: string[]
          settings?: Json
          target_companies?: string[]
          target_roles?: string[]
          unique_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_calls: {
        Row: {
          counted: boolean
          created_at: string
          http_status: number | null
          id: string
          kind: string
          likelihood: number | null
          outcome: string
          provider: string
          query: string
          raw_response: string | null
          user_id: string | null
        }
        Insert: {
          counted?: boolean
          created_at?: string
          http_status?: number | null
          id?: string
          kind: string
          likelihood?: number | null
          outcome: string
          provider: string
          query: string
          raw_response?: string | null
          user_id?: string | null
        }
        Update: {
          counted?: boolean
          created_at?: string
          http_status?: number | null
          id?: string
          kind?: string
          likelihood?: number | null
          outcome?: string
          provider?: string
          query?: string
          raw_response?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      targets: {
        Row: {
          analysis: Json | null
          analysis_at: string | null
          created_at: string
          id: string
          linkedin_url: string
          notes: string | null
          priority: number
          profile: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          analysis_at?: string | null
          created_at?: string
          id?: string
          linkedin_url: string
          notes?: string | null
          priority?: number
          profile?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          analysis_at?: string | null
          created_at?: string
          id?: string
          linkedin_url?: string
          notes?: string | null
          priority?: number
          profile?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
