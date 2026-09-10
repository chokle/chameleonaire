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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blueprints: {
        Row: {
          confidence: number
          created_at: string
          deployable: boolean
          evidence: Json
          gap_notes: string | null
          generation: number
          id: string
          name: string
          niche: string
          parent_id: string | null
          signal_coverage: number
          source_creator_ids: string[]
          status: string
          strategy: Json
          updated_at: string
          win_rate: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          deployable?: boolean
          evidence?: Json
          gap_notes?: string | null
          generation?: number
          id?: string
          name: string
          niche?: string
          parent_id?: string | null
          signal_coverage?: number
          source_creator_ids?: string[]
          status?: string
          strategy?: Json
          updated_at?: string
          win_rate?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          deployable?: boolean
          evidence?: Json
          gap_notes?: string | null
          generation?: number
          id?: string
          name?: string
          niche?: string
          parent_id?: string | null
          signal_coverage?: number
          source_creator_ids?: string[]
          status?: string
          strategy?: Json
          updated_at?: string
          win_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "blueprints_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          audience: string | null
          banned_topics: string | null
          created_at: string
          id: string
          name: string
          palette: string | null
          subject: string | null
          updated_at: string
          voice: string | null
        }
        Insert: {
          audience?: string | null
          banned_topics?: string | null
          created_at?: string
          id?: string
          name: string
          palette?: string | null
          subject?: string | null
          updated_at?: string
          voice?: string | null
        }
        Update: {
          audience?: string | null
          banned_topics?: string | null
          created_at?: string
          id?: string
          name?: string
          palette?: string | null
          subject?: string | null
          updated_at?: string
          voice?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          auto_publish: boolean
          blueprint_id: string | null
          brand_id: string | null
          connected: boolean
          created_at: string
          divergence: number
          est_monthly: number
          id: string
          name: string
          owner_id: string
          status: string
          updated_at: string
          uploads_per_week: number
          youtube_channel_id: string | null
          youtube_title: string | null
        }
        Insert: {
          auto_publish?: boolean
          blueprint_id?: string | null
          brand_id?: string | null
          connected?: boolean
          created_at?: string
          divergence?: number
          est_monthly?: number
          id?: string
          name: string
          owner_id: string
          status?: string
          updated_at?: string
          uploads_per_week?: number
          youtube_channel_id?: string | null
          youtube_title?: string | null
        }
        Update: {
          auto_publish?: boolean
          blueprint_id?: string | null
          brand_id?: string | null
          connected?: boolean
          created_at?: string
          divergence?: number
          est_monthly?: number
          id?: string
          name?: string
          owner_id?: string
          status?: string
          updated_at?: string
          uploads_per_week?: number
          youtube_channel_id?: string | null
          youtube_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      chatgpt_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name?: string
          prefix: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_videos: {
        Row: {
          comments: number
          created_at: string
          creator_id: string
          ctr_proxy: number | null
          duration_seconds: number | null
          engagement_rate: number
          est_profit: number
          hook: string | null
          id: string
          likes: number
          published_at: string | null
          retention_proxy: number | null
          thumbnail_desc: string | null
          title: string
          video_url: string | null
          views: number
        }
        Insert: {
          comments?: number
          created_at?: string
          creator_id: string
          ctr_proxy?: number | null
          duration_seconds?: number | null
          engagement_rate?: number
          est_profit?: number
          hook?: string | null
          id?: string
          likes?: number
          published_at?: string | null
          retention_proxy?: number | null
          thumbnail_desc?: string | null
          title: string
          video_url?: string | null
          views?: number
        }
        Update: {
          comments?: number
          created_at?: string
          creator_id?: string
          ctr_proxy?: number | null
          duration_seconds?: number | null
          engagement_rate?: number
          est_profit?: number
          hook?: string | null
          id?: string
          likes?: number
          published_at?: string | null
          retention_proxy?: number | null
          thumbnail_desc?: string | null
          title?: string
          video_url?: string | null
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_videos_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avg_views: number
          channel_name: string
          channel_url: string | null
          consistency_score: number
          created_at: string
          ctr_proxy: number | null
          data_source: string
          engagement_rate: number
          est_monthly: number
          est_profit_high: number
          est_profit_low: number
          est_profit_per_video: number
          format: string | null
          handle: string | null
          id: string
          niche: string
          notes: string | null
          retention_proxy: number | null
          rpm_high: number
          rpm_low: number
          scan_id: string | null
          signal_coverage: number
          subscribers: number
          updated_at: string
          uploads_per_month: number
          view_velocity: number
        }
        Insert: {
          avg_views?: number
          channel_name: string
          channel_url?: string | null
          consistency_score?: number
          created_at?: string
          ctr_proxy?: number | null
          data_source?: string
          engagement_rate?: number
          est_monthly?: number
          est_profit_high?: number
          est_profit_low?: number
          est_profit_per_video?: number
          format?: string | null
          handle?: string | null
          id?: string
          niche?: string
          notes?: string | null
          retention_proxy?: number | null
          rpm_high?: number
          rpm_low?: number
          scan_id?: string | null
          signal_coverage?: number
          subscribers?: number
          updated_at?: string
          uploads_per_month?: number
          view_velocity?: number
        }
        Update: {
          avg_views?: number
          channel_name?: string
          channel_url?: string | null
          consistency_score?: number
          created_at?: string
          ctr_proxy?: number | null
          data_source?: string
          engagement_rate?: number
          est_monthly?: number
          est_profit_high?: number
          est_profit_low?: number
          est_profit_per_video?: number
          format?: string | null
          handle?: string | null
          id?: string
          niche?: string
          notes?: string | null
          retention_proxy?: number | null
          rpm_high?: number
          rpm_low?: number
          scan_id?: string | null
          signal_coverage?: number
          subscribers?: number
          updated_at?: string
          uploads_per_month?: number
          view_velocity?: number
        }
        Relationships: [
          {
            foreignKeyName: "creators_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      generated_videos: {
        Row: {
          approved: boolean
          blueprint_id: string | null
          channel_id: string
          concept: string | null
          created_at: string
          description: string | null
          divergence_applied: number
          duration_seconds: number | null
          duration_target: number
          hook: string | null
          id: string
          render_error: string | null
          render_jobs: Json
          render_status: string
          script: string | null
          status: string
          tags: string[]
          thumbnail_prompt: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
          youtube_video_id: string | null
        }
        Insert: {
          approved?: boolean
          blueprint_id?: string | null
          channel_id: string
          concept?: string | null
          created_at?: string
          description?: string | null
          divergence_applied?: number
          duration_seconds?: number | null
          duration_target?: number
          hook?: string | null
          id?: string
          render_error?: string | null
          render_jobs?: Json
          render_status?: string
          script?: string | null
          status?: string
          tags?: string[]
          thumbnail_prompt?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          approved?: boolean
          blueprint_id?: string | null
          channel_id?: string
          concept?: string | null
          created_at?: string
          description?: string | null
          divergence_applied?: number
          duration_seconds?: number | null
          duration_target?: number
          hook?: string | null
          id?: string
          render_error?: string | null
          render_jobs?: Json
          render_status?: string
          script?: string | null
          status?: string
          tags?: string[]
          thumbnail_prompt?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_videos_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_datasets: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          raw: Json
          row_count: number
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          raw?: Json
          row_count?: number
          source_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          raw?: Json
          row_count?: number
          source_type?: string
        }
        Relationships: []
      }
      job_state: {
        Row: {
          id: string
          last_run_at: string | null
          lease_until: string | null
          pause_reason: string | null
          paused: boolean
          runs: number
          updated_at: string
        }
        Insert: {
          id: string
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          runs?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          paused?: boolean
          runs?: number
          updated_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          channel_id: string
          created_at: string
          redirect_uri: string
          state: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          redirect_uri: string
          state: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          redirect_uri?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_snapshots: {
        Row: {
          blueprint_id: string | null
          captured_at: string
          channel_id: string | null
          comments: number
          ctr: number | null
          est_revenue: number
          generated_video_id: string | null
          id: string
          likes: number
          outcome: string
          retention: number | null
          views: number
          watch_time_minutes: number
          youtube_video_id: string | null
        }
        Insert: {
          blueprint_id?: string | null
          captured_at?: string
          channel_id?: string | null
          comments?: number
          ctr?: number | null
          est_revenue?: number
          generated_video_id?: string | null
          id?: string
          likes?: number
          outcome?: string
          retention?: number | null
          views?: number
          watch_time_minutes?: number
          youtube_video_id?: string | null
        }
        Update: {
          blueprint_id?: string | null
          captured_at?: string
          channel_id?: string | null
          comments?: number
          ctr?: number | null
          est_revenue?: number
          generated_video_id?: string | null
          id?: string
          likes?: number
          outcome?: string
          retention?: number | null
          views?: number
          watch_time_minutes?: number
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_snapshots_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_snapshots_generated_video_id_fkey"
            columns: ["generated_video_id"]
            isOneToOne: false
            referencedRelation: "generated_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_queue: {
        Row: {
          attempts: number
          channel_id: string
          created_at: string
          generated_video_id: string
          id: string
          last_error: string | null
          published_at: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel_id: string
          created_at?: string
          generated_video_id: string
          id?: string
          last_error?: string | null
          published_at?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel_id?: string
          created_at?: string
          generated_video_id?: string
          id?: string
          last_error?: string | null
          published_at?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_queue_generated_video_id_fkey"
            columns: ["generated_video_id"]
            isOneToOne: false
            referencedRelation: "generated_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          bracket_max: number | null
          bracket_min: number
          created_at: string
          error: string | null
          id: string
          is_persistent: boolean
          last_run_at: string | null
          niche: string
          results_count: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          bracket_max?: number | null
          bracket_min?: number
          created_at?: string
          error?: string | null
          id?: string
          is_persistent?: boolean
          last_run_at?: string | null
          niche: string
          results_count?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bracket_max?: number | null
          bracket_min?: number
          created_at?: string
          error?: string | null
          id?: string
          is_persistent?: boolean
          last_run_at?: string | null
          niche?: string
          results_count?: number
          source?: string
          status?: string
          updated_at?: string
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
      video_templates: {
        Row: {
          blueprint_id: string | null
          brand_id: string | null
          created_at: string
          description: string
          duration_target: number
          hook: string
          id: string
          name: string
          owner_id: string
          pacing: string
          palette: string
          script: string
          shot_notes: string
          tags: string[]
          thumbnail_prompt: string
          title: string
          updated_at: string
          visual_style: string
        }
        Insert: {
          blueprint_id?: string | null
          brand_id?: string | null
          created_at?: string
          description?: string
          duration_target?: number
          hook?: string
          id?: string
          name: string
          owner_id: string
          pacing?: string
          palette?: string
          script?: string
          shot_notes?: string
          tags?: string[]
          thumbnail_prompt?: string
          title?: string
          updated_at?: string
          visual_style?: string
        }
        Update: {
          blueprint_id?: string | null
          brand_id?: string | null
          created_at?: string
          description?: string
          duration_target?: number
          hook?: string
          id?: string
          name?: string
          owner_id?: string
          pacing?: string
          palette?: string
          script?: string
          shot_notes?: string
          tags?: string[]
          thumbnail_prompt?: string
          title?: string
          updated_at?: string
          visual_style?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_templates_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_accounts: {
        Row: {
          access_token: string | null
          channel_id: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          scopes: string | null
          updated_at: string
          youtube_channel_id: string | null
          youtube_title: string | null
        }
        Insert: {
          access_token?: string | null
          channel_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_title?: string | null
        }
        Update: {
          access_token?: string | null
          channel_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_accounts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      run_publish_tick: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
