// Tipos de la base de datos (snake_case, tal cual Postgres).
// PLACEHOLDER escrito a mano a partir de supabase/migrations. Regenerar con:
//   bun run gen:types   (requiere `supabase start`)
// una vez el stack local este corriendo, para mantenerlo en sync con el schema.

type Timestamptz = string
type Uuid = string

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: Uuid
          name: string
          base_url: string
          platform: string
          active: boolean
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          name: string
          base_url: string
          platform?: string
          active?: boolean
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['stores']['Insert']>
        Relationships: []
      }
      products: {
        Row: {
          id: Uuid
          canonical_name: string
          brand: string
          model: string
          ean_gtin: string | null
          category: string
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          canonical_name: string
          brand?: string
          model?: string
          ean_gtin?: string | null
          category?: string
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
        Relationships: []
      }
      product_variants: {
        Row: {
          id: Uuid
          product_id: Uuid
          variant_type: string
          variant_value: string
        }
        Insert: {
          id?: Uuid
          product_id: Uuid
          variant_type: string
          variant_value: string
        }
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>
        Relationships: []
      }
      store_products: {
        Row: {
          id: Uuid
          store_id: Uuid
          product_id: Uuid | null
          store_sku: string
          url: string
          raw_name: string
          active: boolean
          first_seen_at: Timestamptz
          last_seen_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          store_id: Uuid
          product_id?: Uuid | null
          store_sku: string
          url: string
          raw_name: string
          active?: boolean
          first_seen_at?: Timestamptz
          last_seen_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['store_products']['Insert']>
        Relationships: []
      }
      price_points: {
        Row: {
          id: number
          store_product_id: Uuid
          price: number
          list_price: number | null
          conditional_price: number | null
          conditional_price_note: string | null
          currency: string
          stock_status: string
          captured_at: Timestamptz
        }
        Insert: {
          id?: number
          store_product_id: Uuid
          price: number
          list_price?: number | null
          conditional_price?: number | null
          conditional_price_note?: string | null
          currency?: string
          stock_status?: string
          captured_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['price_points']['Insert']>
        Relationships: []
      }
      users: {
        Row: {
          id: Uuid
          email: string
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          email: string
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: Uuid
          user_id: Uuid
          product_id: Uuid
          target_price: number | null
          active: boolean
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          user_id: Uuid
          product_id: Uuid
          target_price?: number | null
          active?: boolean
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: []
      }
      notification_channels: {
        Row: {
          id: Uuid
          user_id: Uuid
          type: string
          address: string
          verified: boolean
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          user_id: Uuid
          type: string
          address: string
          verified?: boolean
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['notification_channels']['Insert']>
        Relationships: []
      }
      match_review_queue: {
        Row: {
          id: Uuid
          store_product_id: Uuid
          raw_name: string
          suggested_product_id: Uuid | null
          status: string
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          store_product_id: Uuid
          raw_name: string
          suggested_product_id?: Uuid | null
          status?: string
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['match_review_queue']['Insert']>
        Relationships: []
      }
      product_requests: {
        Row: {
          id: Uuid
          store_id: Uuid | null
          url: string | null
          sku: string | null
          status: string
          requested_by: Uuid | null
          created_at: Timestamptz
        }
        Insert: {
          id?: Uuid
          store_id?: Uuid | null
          url?: string | null
          sku?: string | null
          status?: string
          requested_by?: Uuid | null
          created_at?: Timestamptz
        }
        Update: Partial<Database['public']['Tables']['product_requests']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
