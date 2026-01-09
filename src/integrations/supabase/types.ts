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
      chat_conversations: {
        Row: {
          booking_id: string | null
          court_manager_id: string
          created_at: string
          expires_at: string | null
          id: string
          organizer_id: string
          session_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          court_manager_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organizer_id: string
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          court_manager_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organizer_id?: string
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "court_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean | null
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean | null
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean | null
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      court_availability: {
        Row: {
          available_date: string
          booked_by_group_id: string | null
          booked_by_session_id: string | null
          booked_by_user_id: string | null
          court_id: string
          created_at: string
          end_time: string
          id: string
          is_booked: boolean | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          start_time: string
          updated_at: string
        }
        Insert: {
          available_date: string
          booked_by_group_id?: string | null
          booked_by_session_id?: string | null
          booked_by_user_id?: string | null
          court_id: string
          created_at?: string
          end_time: string
          id?: string
          is_booked?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          start_time: string
          updated_at?: string
        }
        Update: {
          available_date?: string
          booked_by_group_id?: string | null
          booked_by_session_id?: string | null
          booked_by_user_id?: string | null
          court_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_booked?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_availability_booked_by_group_id_fkey"
            columns: ["booked_by_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_availability_booked_by_session_id_fkey"
            columns: ["booked_by_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_availability_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          capacity: number
          created_at: string
          ground_type: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate: number
          id: string
          is_active: boolean | null
          is_indoor: boolean | null
          name: string
          payment_hours_before: number | null
          payment_timing: Database["public"]["Enums"]["payment_timing"] | null
          photo_url: string | null
          sport_type: Database["public"]["Enums"]["sport_type"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          ground_type?: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate: number
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          name: string
          payment_hours_before?: number | null
          payment_timing?: Database["public"]["Enums"]["payment_timing"] | null
          photo_url?: string | null
          sport_type: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          ground_type?: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          name?: string
          payment_hours_before?: number | null
          payment_timing?: Database["public"]["Enums"]["payment_timing"] | null
          photo_url?: string | null
          sport_type?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          invite_code: string
          is_active: boolean | null
          max_uses: number | null
          use_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          invite_code: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_admin: boolean | null
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          city: string
          created_at: string
          default_court_id: string | null
          default_day_of_week: number
          default_duration_minutes: number
          default_start_time: string
          description: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          max_players: number
          min_players: number
          name: string
          organizer_id: string
          payment_deadline_hours: number
          photo_url: string | null
          sport_type: Database["public"]["Enums"]["sport_type"]
          updated_at: string
          weekly_court_price: number
        }
        Insert: {
          city: string
          created_at?: string
          default_court_id?: string | null
          default_day_of_week: number
          default_duration_minutes?: number
          default_start_time: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_players?: number
          min_players?: number
          name: string
          organizer_id: string
          payment_deadline_hours?: number
          photo_url?: string | null
          sport_type: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          weekly_court_price: number
        }
        Update: {
          city?: string
          created_at?: string
          default_court_id?: string | null
          default_day_of_week?: number
          default_duration_minutes?: number
          default_start_time?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_players?: number
          min_players?: number
          name?: string
          organizer_id?: string
          payment_deadline_hours?: number
          photo_url?: string | null
          sport_type?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          weekly_court_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "groups_default_court_id_fkey"
            columns: ["default_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          platform_fee: number | null
          session_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          session_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          session_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_sports: Database["public"]["Enums"]["sport_type"][] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_sports?: Database["public"]["Enums"]["sport_type"][] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_sports?: Database["public"]["Enums"]["sport_type"][] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_players: {
        Row: {
          confirmed_at: string | null
          id: string
          is_confirmed: boolean | null
          is_from_rescue: boolean | null
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          is_from_rescue?: boolean | null
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          is_from_rescue?: boolean | null
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          court_id: string | null
          court_price: number
          created_at: string
          duration_minutes: number
          group_id: string
          id: string
          is_cancelled: boolean | null
          is_rescue_open: boolean | null
          max_players: number
          min_players: number
          notes: string | null
          payment_deadline: string
          payment_type:
            | Database["public"]["Enums"]["booking_payment_type"]
            | null
          session_date: string
          start_time: string
          state: Database["public"]["Enums"]["session_state"]
          updated_at: string
        }
        Insert: {
          court_id?: string | null
          court_price: number
          created_at?: string
          duration_minutes: number
          group_id: string
          id?: string
          is_cancelled?: boolean | null
          is_rescue_open?: boolean | null
          max_players: number
          min_players: number
          notes?: string | null
          payment_deadline: string
          payment_type?:
            | Database["public"]["Enums"]["booking_payment_type"]
            | null
          session_date: string
          start_time: string
          state?: Database["public"]["Enums"]["session_state"]
          updated_at?: string
        }
        Update: {
          court_id?: string | null
          court_price?: number
          created_at?: string
          duration_minutes?: number
          group_id?: string
          id?: string
          is_cancelled?: boolean | null
          is_rescue_open?: boolean | null
          max_players?: number
          min_players?: number
          notes?: string | null
          payment_deadline?: string
          payment_type?:
            | Database["public"]["Enums"]["booking_payment_type"]
            | null
          session_date?: string
          start_time?: string
          state?: Database["public"]["Enums"]["session_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          amenities: string[] | null
          city: string
          country: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          photo_url: string | null
          stripe_account_id: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          city: string
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          photo_url?: string | null
          stripe_account_id?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          city?: string
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          photo_url?: string | null
          stripe_account_id?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_session_and_release_court: {
        Args: { session_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "court_manager" | "organizer" | "player"
      booking_payment_type: "single" | "split"
      ground_type: "grass" | "turf" | "sand" | "hard" | "clay" | "other"
      notification_type:
        | "game_reminder"
        | "payment_due"
        | "payment_confirmed"
        | "rescue_mode"
        | "slot_released"
        | "player_joined"
        | "group_invite"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      payment_timing: "at_booking" | "before_session"
      session_state: "protected" | "rescue" | "released"
      sport_type:
        | "futsal"
        | "tennis"
        | "volleyball"
        | "basketball"
        | "turf_hockey"
        | "badminton"
        | "other"
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
      app_role: ["court_manager", "organizer", "player"],
      booking_payment_type: ["single", "split"],
      ground_type: ["grass", "turf", "sand", "hard", "clay", "other"],
      notification_type: [
        "game_reminder",
        "payment_due",
        "payment_confirmed",
        "rescue_mode",
        "slot_released",
        "player_joined",
        "group_invite",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      payment_timing: ["at_booking", "before_session"],
      session_state: ["protected", "rescue", "released"],
      sport_type: [
        "futsal",
        "tennis",
        "volleyball",
        "basketball",
        "turf_hockey",
        "badminton",
        "other",
      ],
    },
  },
} as const
