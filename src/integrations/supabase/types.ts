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
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chatbot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      compatibility_scores: {
        Row: {
          common_interests: string[]
          common_skills: string[]
          created_at: string
          created_by: string
          id: string
          rationale: string | null
          score: number
          updated_at: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          common_interests?: string[]
          common_skills?: string[]
          created_at?: string
          created_by: string
          id?: string
          rationale?: string | null
          score: number
          updated_at?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          common_interests?: string[]
          common_skills?: string[]
          created_at?: string
          created_by?: string
          id?: string
          rationale?: string | null
          score?: number
          updated_at?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          round_index: number
          sender_type: string
          speaker_user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          round_index?: number
          sender_type?: string
          speaker_user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          round_index?: number
          sender_type?: string
          speaker_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          consent_status: string
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          consent_status?: string
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          consent_status?: string
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          compatibility_score: number | null
          created_at: string
          created_by: string
          extracted_topics: string[]
          id: string
          last_message_at: string | null
          mode: Database["public"]["Enums"]["conversation_mode"]
          status: Database["public"]["Enums"]["conversation_status"]
          summary: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          compatibility_score?: number | null
          created_at?: string
          created_by: string
          extracted_topics?: string[]
          id?: string
          last_message_at?: string | null
          mode: Database["public"]["Enums"]["conversation_mode"]
          status?: Database["public"]["Enums"]["conversation_status"]
          summary?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          compatibility_score?: number | null
          created_at?: string
          created_by?: string
          extracted_topics?: string[]
          id?: string
          last_message_at?: string | null
          mode?: Database["public"]["Enums"]["conversation_mode"]
          status?: Database["public"]["Enums"]["conversation_status"]
          summary?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          avatar_url: string | null
          bio: string | null
          communication_style: string | null
          created_at: string
          discoverable: boolean
          favorite_books: string[]
          favorite_food: string[]
          favorite_movies: string[]
          favorite_music: string[]
          field_of_study: string | null
          gender: string | null
          goals: string[]
          hobbies: string[]
          id: string
          interests: string[]
          languages: string[]
          location: string | null
          name: string | null
          occupation: string | null
          persona_summary: string | null
          personality_traits: string[]
          pronouns: string | null
          quirks: string[]
          skills: string[]
          updated_at: string
          user_id: string
          values: string[]
        }
        Insert: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          communication_style?: string | null
          created_at?: string
          discoverable?: boolean
          favorite_books?: string[]
          favorite_food?: string[]
          favorite_movies?: string[]
          favorite_music?: string[]
          field_of_study?: string | null
          gender?: string | null
          goals?: string[]
          hobbies?: string[]
          id?: string
          interests?: string[]
          languages?: string[]
          location?: string | null
          name?: string | null
          occupation?: string | null
          persona_summary?: string | null
          personality_traits?: string[]
          pronouns?: string | null
          quirks?: string[]
          skills?: string[]
          updated_at?: string
          user_id: string
          values?: string[]
        }
        Update: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          communication_style?: string | null
          created_at?: string
          discoverable?: boolean
          favorite_books?: string[]
          favorite_food?: string[]
          favorite_movies?: string[]
          favorite_music?: string[]
          field_of_study?: string | null
          gender?: string | null
          goals?: string[]
          hobbies?: string[]
          id?: string
          interests?: string[]
          languages?: string[]
          location?: string | null
          name?: string | null
          occupation?: string | null
          persona_summary?: string | null
          personality_traits?: string[]
          pronouns?: string | null
          quirks?: string[]
          skills?: string[]
          updated_at?: string
          user_id?: string
          values?: string[]
        }
        Relationships: []
      }
      user_security_questions: {
        Row: {
          answer_hash: string
          answer_salt: string
          created_at: string
          email_key: string
          failed_attempts: number
          failure_window_started_at: string | null
          question_key: string
          recovery_expires_at: string | null
          recovery_token_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_hash: string
          answer_salt: string
          created_at?: string
          email_key: string
          failed_attempts?: number
          failure_window_started_at?: string | null
          question_key: string
          recovery_expires_at?: string | null
          recovery_token_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_hash?: string
          answer_salt?: string
          created_at?: string
          email_key?: string
          failed_attempts?: number
          failure_window_started_at?: string | null
          question_key?: string
          recovery_expires_at?: string | null
          recovery_token_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_compatibility_participant: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_name_available: {
        Args: { _exclude_user?: string; _name: string }
        Returns: boolean
      }
      is_profile_visible: {
        Args: { _discoverable: boolean; _profile_user_id: string }
        Returns: boolean
      }
      record_security_question_attempt: {
        Args: { _email_key: string }
        Returns: boolean
      }
    }
    Enums: {
      conversation_mode: "chat" | "debate" | "bot_meeting"
      conversation_status:
        | "draft"
        | "active"
        | "stopped"
        | "completed"
        | "failed"
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
      conversation_mode: ["chat", "debate", "bot_meeting"],
      conversation_status: [
        "draft",
        "active",
        "stopped",
        "completed",
        "failed",
      ],
    },
  },
} as const
