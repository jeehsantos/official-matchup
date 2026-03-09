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
      booking_equipment: {
        Row: {
          booking_id: string
          created_at: string
          equipment_id: string
          id: string
          price_at_booking: number
          quantity: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          equipment_id: string
          id?: string
          price_at_booking: number
          quantity?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          equipment_id?: string
          id?: string
          price_at_booking?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_equipment_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "court_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          court_id: string
          created_at: string
          end_datetime: string
          expires_at: string
          id: string
          start_datetime: string
          status: string
          user_id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          end_datetime: string
          expires_at: string
          id?: string
          start_datetime: string
          status?: string
          user_id: string
        }
        Update: {
          court_id?: string
          created_at?: string
          end_datetime?: string
          expires_at?: string
          id?: string
          start_datetime?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
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
          template_id: string | null
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
          template_id?: string | null
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
          template_id?: string | null
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
          allowed_sports: string[] | null
          capacity: number
          created_at: string
          ground_type: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate: number
          id: string
          is_active: boolean | null
          is_indoor: boolean | null
          is_multi_court: boolean | null
          name: string
          parent_court_id: string | null
          payment_hours_before: number | null
          payment_timing: Database["public"]["Enums"]["payment_timing"] | null
          photo_url: string | null
          photo_urls: string[] | null
          rules: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          allowed_sports?: string[] | null
          capacity?: number
          created_at?: string
          ground_type?: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate: number
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          is_multi_court?: boolean | null
          name: string
          parent_court_id?: string | null
          payment_hours_before?: number | null
          payment_timing?: Database["public"]["Enums"]["payment_timing"] | null
          photo_url?: string | null
          photo_urls?: string[] | null
          rules?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          allowed_sports?: string[] | null
          capacity?: number
          created_at?: string
          ground_type?: Database["public"]["Enums"]["ground_type"] | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          is_multi_court?: boolean | null
          name?: string
          parent_court_id?: string | null
          payment_hours_before?: number | null
          payment_timing?: Database["public"]["Enums"]["payment_timing"] | null
          photo_url?: string | null
          photo_urls?: string[] | null
          rules?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_parent_court_id_fkey"
            columns: ["parent_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          related_payment_id: string | null
          related_session_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          related_payment_id?: string | null
          related_session_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          related_payment_id?: string | null
          related_session_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_inventory: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          price_per_unit: number
          quantity_available: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          price_per_unit?: number
          quantity_available?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          price_per_unit?: number
          quantity_available?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_inventory_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      group_bans: {
        Row: {
          banned_by: string
          created_at: string
          group_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          group_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          group_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_bans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
      held_credit_liabilities: {
        Row: {
          amount_cents: number
          applied_at: string | null
          applied_session_id: string | null
          created_at: string
          id: string
          source_payment_id: string
          source_session_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          applied_session_id?: string | null
          created_at?: string
          id?: string
          source_payment_id: string
          source_session_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          applied_session_id?: string | null
          created_at?: string
          id?: string
          source_payment_id?: string
          source_session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_credit_liabilities_applied_session_id_fkey"
            columns: ["applied_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_credit_liabilities_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_credit_liabilities_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_count: number
          created_at: string | null
          email: string
          id: string
          last_attempt_at: string | null
          locked_until: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string | null
          email: string
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string | null
          email?: string
          id?: string
          last_attempt_at?: string | null
          locked_until?: string | null
        }
        Relationships: []
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
          court_amount: number | null
          created_at: string
          id: string
          paid_at: string | null
          paid_with_credits: number | null
          payment_type_snapshot: string | null
          platform_fee: number | null
          service_fee: number | null
          session_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_fee_actual: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          transfer_amount: number | null
          transferred_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          court_amount?: number | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_with_credits?: number | null
          payment_type_snapshot?: string | null
          platform_fee?: number | null
          service_fee?: number | null
          session_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_fee_actual?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          transfer_amount?: number | null
          transferred_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          court_amount?: number | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_with_credits?: number | null
          payment_type_snapshot?: string | null
          platform_fee?: number | null
          service_fee?: number | null
          session_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_fee_actual?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          transfer_amount?: number | null
          transferred_at?: string | null
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
      platform_settings: {
        Row: {
          id: string
          is_active: boolean
          manager_fee_percentage: number
          player_fee: number
          stripe_fixed: number
          stripe_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean
          manager_fee_percentage?: number
          player_fee?: number
          stripe_fixed?: number
          stripe_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean
          manager_fee_percentage?: number
          player_fee?: number
          stripe_fixed?: number
          stripe_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          nationality_code: string | null
          phone: string | null
          preferred_sports: string[] | null
          referral_code: string | null
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          nationality_code?: string | null
          phone?: string | null
          preferred_sports?: string[] | null
          referral_code?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          nationality_code?: string | null
          phone?: string | null
          preferred_sports?: string[] | null
          referral_code?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_challenge_bans: {
        Row: {
          banned_by: string
          challenge_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          challenge_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          challenge_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_challenge_bans_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "quick_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_challenge_messages: {
        Row: {
          challenge_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          challenge_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: string
          sender_id: string
        }
        Update: {
          challenge_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_challenge_messages_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "quick_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_challenge_payments: {
        Row: {
          amount: number
          challenge_id: string
          court_amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_method_type: string | null
          platform_profit_target: number | null
          service_fee_total: number | null
          status: string
          stripe_fee_actual: number | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          challenge_id: string
          court_amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method_type?: string | null
          platform_profit_target?: number | null
          service_fee_total?: number | null
          status?: string
          stripe_fee_actual?: number | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string
          court_amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method_type?: string | null
          platform_profit_target?: number | null
          service_fee_total?: number | null
          status?: string
          stripe_fee_actual?: number | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_challenge_payments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "quick_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_challenge_players: {
        Row: {
          challenge_id: string
          id: string
          joined_at: string
          paid_at: string | null
          payment_status: string
          slot_position: number
          stripe_session_id: string | null
          team: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          id?: string
          joined_at?: string
          paid_at?: string | null
          payment_status?: string
          slot_position: number
          stripe_session_id?: string | null
          team: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          id?: string
          joined_at?: string
          paid_at?: string | null
          payment_status?: string
          slot_position?: number
          stripe_session_id?: string | null
          team?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_challenge_players_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "quick_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_challenges: {
        Row: {
          court_id: string | null
          created_at: string
          created_by: string
          game_mode: string
          gender_preference: string
          id: string
          payment_type: string
          price_per_player: number
          scheduled_date: string | null
          scheduled_time: string | null
          sport_category_id: string
          status: string
          total_slots: number
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          court_id?: string | null
          created_at?: string
          created_by: string
          game_mode: string
          gender_preference?: string
          id?: string
          payment_type?: string
          price_per_player?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          sport_category_id: string
          status?: string
          total_slots: number
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          court_id?: string | null
          created_at?: string
          created_by?: string
          game_mode?: string
          gender_preference?: string
          id?: string
          payment_type?: string
          price_per_player?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          sport_category_id?: string
          status?: string
          total_slots?: number
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_challenges_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_challenges_sport_category_id_fkey"
            columns: ["sport_category_id"]
            isOneToOne: false
            referencedRelation: "sport_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_challenges_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          credit_amount: number
          id: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credit_amount?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credit_amount?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credited_amount: number | null
          credited_at: string | null
          id: string
          referral_code: string
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          credited_amount?: number | null
          credited_at?: string | null
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          credited_amount?: number | null
          credited_at?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_id?: string
          status?: string
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
          session_type: Database["public"]["Enums"]["session_type"] | null
          sport_category_id: string | null
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
          session_type?: Database["public"]["Enums"]["session_type"] | null
          sport_category_id?: string | null
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
          session_type?: Database["public"]["Enums"]["session_type"] | null
          sport_category_id?: string | null
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
          {
            foreignKeyName: "sessions_sport_category_id_fkey"
            columns: ["sport_category_id"]
            isOneToOne: false
            referencedRelation: "sport_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_categories: {
        Row: {
          created_at: string
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      surface_types: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      venue_date_overrides: {
        Row: {
          created_at: string
          custom_end_time: string | null
          custom_start_time: string | null
          end_date: string | null
          id: string
          is_closed: boolean
          note: string | null
          start_date: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          custom_end_time?: string | null
          custom_start_time?: string | null
          end_date?: string | null
          id?: string
          is_closed?: boolean
          note?: string | null
          start_date: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          custom_end_time?: string | null
          custom_start_time?: string | null
          end_date?: string | null
          id?: string
          is_closed?: boolean
          note?: string | null
          start_date?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_date_overrides_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_payment_settings: {
        Row: {
          created_at: string
          stripe_account_id: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          stripe_account_id: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          stripe_account_id?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_payment_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_staff: {
        Row: {
          added_by: string
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_staff_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_weekly_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_closed: boolean
          start_time: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_closed?: boolean
          start_time: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_closed?: boolean
          start_time?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_weekly_rules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          amenities: string[] | null
          banner_url: string | null
          city: string
          country: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          max_booking_minutes: number
          name: string
          owner_id: string
          phone: string | null
          photo_url: string | null
          slot_interval_minutes: number
          slug: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          banner_url?: string | null
          city: string
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_booking_minutes?: number
          name: string
          owner_id: string
          phone?: string | null
          photo_url?: string | null
          slot_interval_minutes?: number
          slug?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          banner_url?: string | null
          city?: string
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_booking_minutes?: number
          name?: string
          owner_id?: string
          phone?: string | null
          photo_url?: string | null
          slot_interval_minutes?: number
          slug?: string | null
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
      add_user_credits: {
        Args: {
          p_amount: number
          p_payment_id?: string
          p_reason: string
          p_session_id?: string
          p_user_id: string
        }
        Returns: number
      }
      can_view_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_expired_unpaid_sessions: { Args: never; Returns: number }
      cancel_session_and_release_court: {
        Args: { session_id: string }
        Returns: boolean
      }
      check_login_attempt: { Args: { p_email: string }; Returns: Json }
      clear_login_attempts: { Args: { p_email: string }; Returns: undefined }
      convert_hold_to_booking: { Args: { p_hold_id: string }; Returns: Json }
      create_booking_hold: {
        Args: {
          p_court_id: string
          p_end_datetime: string
          p_start_datetime: string
          p_user_id: string
        }
        Returns: Json
      }
      expire_stale_holds: { Args: never; Returns: number }
      get_group_invitation: { Args: { p_invite_code: string }; Returns: Json }
      get_staff_venue_ids: {
        Args: { check_user_id: string }
        Returns: string[]
      }
      get_user_credits: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_invitation: { Args: { _group_id: string }; Returns: boolean }
      increment_invitation_use: {
        Args: { p_invite_code: string }
        Returns: undefined
      }
      is_challenge_participant: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_ban_manager: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff_of_owner: { Args: { check_user_id: string }; Returns: boolean }
      is_user_banned_from_challenge: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_banned_from_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_venue_staff: {
        Args: { check_user_id: string; check_venue_id: string }
        Returns: boolean
      }
      process_referral_credit: {
        Args: { p_referred_user_id: string }
        Returns: boolean
      }
      purge_old_booking_holds: { Args: never; Returns: number }
      purge_old_cancelled_records: { Args: never; Returns: Json }
      recalculate_and_maybe_confirm_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      record_failed_login: { Args: { p_email: string }; Returns: Json }
      release_booking_hold: {
        Args: { p_hold_id: string; p_user_id: string }
        Returns: boolean
      }
      use_user_credits: {
        Args: {
          p_amount: number
          p_reason: string
          p_session_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "court_manager"
        | "organizer"
        | "player"
        | "admin"
        | "venue_staff"
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
        | "session_cancelled"
      payment_status:
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
        | "transferred"
        | "cancelled"
      payment_timing: "at_booking" | "before_session"
      session_state: "protected" | "rescue" | "released"
      session_type:
        | "casual"
        | "competitive"
        | "training"
        | "private"
        | "tournament"
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
      app_role: [
        "court_manager",
        "organizer",
        "player",
        "admin",
        "venue_staff",
      ],
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
        "session_cancelled",
      ],
      payment_status: [
        "pending",
        "completed",
        "failed",
        "refunded",
        "transferred",
        "cancelled",
      ],
      payment_timing: ["at_booking", "before_session"],
      session_state: ["protected", "rescue", "released"],
      session_type: [
        "casual",
        "competitive",
        "training",
        "private",
        "tournament",
      ],
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
