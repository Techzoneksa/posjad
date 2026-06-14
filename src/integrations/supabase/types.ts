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
      account_movements: {
        Row: {
          account_id: string
          amount_in: number
          amount_out: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          occurred_at: string
          reference: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["account_movement_type"]
        }
        Insert: {
          account_id: string
          amount_in?: number
          amount_out?: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          reference?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["account_movement_type"]
        }
        Update: {
          account_id?: string
          amount_in?: number
          amount_out?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          reference?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["account_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "account_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_groups: {
        Row: {
          created_at: string
          id: string
          max_select: number
          min_select: number
          name_ar: string
          name_en: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name_ar: string
          name_en?: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name_ar?: string
          name_en?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      addons: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          name_ar: string
          name_en: string
          price_delta: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          name_ar: string
          name_en?: string
          price_delta?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          name_ar?: string
          name_en?: string
          price_delta?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      cash_drawer_movements: {
        Row: {
          amount: number
          cashier_id: string
          created_at: string
          id: string
          occurred_at: string
          reason: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount: number
          cashier_id: string
          created_at?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount?: number
          cashier_id?: string
          created_at?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          shift_id?: string
          type?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name_ar: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      chart_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          name_ar: string
          name_en: string
          parent_code: string | null
          type: Database["public"]["Enums"]["chart_account_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          name_ar: string
          name_en: string
          parent_code?: string | null
          type: Database["public"]["Enums"]["chart_account_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          name_ar?: string
          name_en?: string
          parent_code?: string | null
          type?: Database["public"]["Enums"]["chart_account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_accounts_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["code"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          loyalty_points: number
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loyalty_points?: number
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loyalty_points?: number
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          month: string
          notes: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          month: string
          notes?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["adjustment_kind"]
          month?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          id: string
          job_title: string
          mobile: string | null
          monthly_salary: number
          name: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_title: string
          mobile?: string | null
          monthly_salary?: number
          name: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_title?: string
          mobile?: string | null
          monthly_salary?: number
          name?: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          number: string
          paid_from_account_id: string
          total: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          number?: string
          paid_from_account_id: string
          total: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          number?: string
          paid_from_account_id?: string
          total?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          account_code: string | null
          active: boolean
          balance: number
          created_at: string
          id: string
          last_movement_at: string | null
          name_ar: string
          name_en: string
          notes: string | null
          opening_balance: number
          type: Database["public"]["Enums"]["finance_account_type"]
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          active?: boolean
          balance?: number
          created_at?: string
          id?: string
          last_movement_at?: string | null
          name_ar: string
          name_en: string
          notes?: string | null
          opening_balance?: number
          type: Database["public"]["Enums"]["finance_account_type"]
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          active?: boolean
          balance?: number
          created_at?: string
          id?: string
          last_movement_at?: string | null
          name_ar?: string
          name_en?: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["finance_account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      held_orders: {
        Row: {
          cart_json: Json
          cashier_id: string
          created_at: string
          customer_id: string | null
          held_at: string
          id: string
          note: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          cart_json: Json
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          held_at?: string
          id?: string
          note?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          cart_json?: Json
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          held_at?: string
          id?: string
          note?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          average_cost: number
          category: string
          created_at: string
          current_quantity: number
          id: string
          minimum_stock_level: number
          name_ar: string
          name_en: string
          notes: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          average_cost?: number
          category: string
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_stock_level?: number
          name_ar: string
          name_en?: string
          notes?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          average_cost?: number
          category?: string
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_stock_level?: number
          name_ar?: string
          name_en?: string
          notes?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          quantity_in: number
          quantity_out: number
          reference_id: string | null
          reference_type: string | null
          unit: string
          unit_cost: number | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          quantity_in?: number
          quantity_out?: number
          reference_id?: string | null
          reference_type?: string | null
          unit: string
          unit_cost?: number | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          quantity_in?: number
          quantity_out?: number
          reference_id?: string | null
          reference_type?: string | null
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          invoice_number: string
          issued_at: string
          order_id: string
          pdf_url: string | null
          updated_at: string
          zatca_uuid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id: string
          pdf_url?: string | null
          updated_at?: string
          zatca_uuid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string
          pdf_url?: string | null
          updated_at?: string
          zatca_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          number: string
          reversed_by: string | null
          reverses: string | null
          source: Database["public"]["Enums"]["journal_source"]
          status: Database["public"]["Enums"]["journal_status"]
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          number?: string
          reversed_by?: string | null
          reverses?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          status?: Database["public"]["Enums"]["journal_status"]
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          number?: string
          reversed_by?: string | null
          reverses?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          status?: Database["public"]["Enums"]["journal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_fkey"
            columns: ["reverses"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_code: string
          created_at: string
          credit: number
          debit: number
          id: string
          journal_entry_id: string
          notes: string | null
        }
        Insert: {
          account_code: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id: string
          notes?: string | null
        }
        Update: {
          account_code?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_entry_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_addons: {
        Row: {
          addon_id: string | null
          created_at: string
          id: string
          name_snapshot: string
          order_item_id: string
          price_delta_snapshot: number
        }
        Insert: {
          addon_id?: string | null
          created_at?: string
          id?: string
          name_snapshot: string
          order_item_id: string
          price_delta_snapshot?: number
        }
        Update: {
          addon_id?: string | null
          created_at?: string
          id?: string
          name_snapshot?: string
          order_item_id?: string
          price_delta_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name_snapshot: string
          notes: string | null
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          name_snapshot: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cashier_id: string
          created_at: string
          customer_id: string | null
          discount_amount: number
          id: string
          net_amount_excluding_vat: number
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          shift_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_before_discount: number
          total_including_vat: number
          updated_at: string
          vat_included_amount: number
          vat_rate: number
        }
        Insert: {
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          net_amount_excluding_vat?: number
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_before_discount?: number
          total_including_vat?: number
          updated_at?: string
          vat_included_amount?: number
          vat_rate?: number
        }
        Update: {
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          net_amount_excluding_vat?: number
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_before_discount?: number
          total_including_vat?: number
          updated_at?: string
          vat_included_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addon_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          calories: number | null
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          name_ar: string
          name_en: string
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          size: string | null
          sku: string | null
          tax_rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          calories?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name_ar: string
          name_en?: string
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          size?: string | null
          sku?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          calories?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name_ar?: string
          name_en?: string
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          size?: string | null
          sku?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          last_login: string | null
          updated_at: string
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          last_login?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          last_login?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      purchase_invoices: {
        Row: {
          amount_paid: number
          attachment_url: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_date: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["purchase_payment_method"]
          status: Database["public"]["Enums"]["purchase_status"]
          subtotal: number
          supplier_id: string
          supplier_invoice_number: string | null
          total: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          amount_paid?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["purchase_payment_method"]
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id: string
          supplier_invoice_number?: string | null
          total?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          amount_paid?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["purchase_payment_method"]
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id?: string
          supplier_invoice_number?: string | null
          total?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          line_total: number
          purchase_invoice_id: string
          quantity: number
          unit: string
          unit_cost: number
          vat_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          line_total: number
          purchase_invoice_id: string
          quantity: number
          unit: string
          unit_cost: number
          vat_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          line_total?: number
          purchase_invoice_id?: string
          quantity?: number
          unit?: string
          unit_cost?: number
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity_used: number
          recipe_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity_used: number
          recipe_id: string
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity_used?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_item_id: string | null
          quantity: number
          refund_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_item_id?: string | null
          quantity: number
          refund_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_item_id?: string | null
          quantity?: number
          refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_items_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          cashier_id: string
          created_at: string
          id: string
          invoice_number: string | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reason: string | null
          refunded_at: string
          type: Database["public"]["Enums"]["refund_type"]
        }
        Insert: {
          amount: number
          cashier_id: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          order_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reason?: string | null
          refunded_at?: string
          type: Database["public"]["Enums"]["refund_type"]
        }
        Update: {
          amount?: number
          cashier_id?: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reason?: string | null
          refunded_at?: string
          type?: Database["public"]["Enums"]["refund_type"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          branch_ar: string
          branch_en: string
          brand_name_ar: string
          brand_name_en: string
          commercial_registration: string
          footer_note_ar: string
          footer_note_en: string
          id: boolean
          legal_name_ar: string
          legal_name_en: string
          logo_url: string | null
          national_address: string
          prices_include_vat: boolean
          print_copies: number
          print_method: string
          printer_type: string
          receipt_width: string
          updated_at: string
          vat_number: string
          vat_rate: number
        }
        Insert: {
          branch_ar?: string
          branch_en?: string
          brand_name_ar?: string
          brand_name_en?: string
          commercial_registration?: string
          footer_note_ar?: string
          footer_note_en?: string
          id?: boolean
          legal_name_ar?: string
          legal_name_en?: string
          logo_url?: string | null
          national_address?: string
          prices_include_vat?: boolean
          print_copies?: number
          print_method?: string
          printer_type?: string
          receipt_width?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
        }
        Update: {
          branch_ar?: string
          branch_en?: string
          brand_name_ar?: string
          brand_name_en?: string
          commercial_registration?: string
          footer_note_ar?: string
          footer_note_en?: string
          id?: boolean
          legal_name_ar?: string
          legal_name_en?: string
          logo_url?: string | null
          national_address?: string
          prices_include_vat?: boolean
          print_copies?: number
          print_method?: string
          printer_type?: string
          receipt_width?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
        }
        Relationships: []
      }
      salary_records: {
        Row: {
          advances: number
          basic: number
          created_at: string
          deductions: number
          employee_id: string
          id: string
          month: string
          net: number
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_from_account_id: string | null
          status: Database["public"]["Enums"]["salary_status"]
          updated_at: string
        }
        Insert: {
          advances?: number
          basic?: number
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          month: string
          net?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_from_account_id?: string | null
          status?: Database["public"]["Enums"]["salary_status"]
          updated_at?: string
        }
        Update: {
          advances?: number
          basic?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          month?: string
          net?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_from_account_id?: string | null
          status?: Database["public"]["Enums"]["salary_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          cashier_id: string
          closed_at: string | null
          closing_cash: number | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_float: number
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
          variance: number | null
        }
        Insert: {
          cashier_id: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          variance?: number | null
        }
        Update: {
          cashier_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          difference: number
          id: string
          inventory_item_id: string
          new_quantity: number
          notes: string | null
          old_quantity: number
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difference: number
          id?: string
          inventory_item_id: string
          new_quantity: number
          notes?: string | null
          old_quantity: number
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          inventory_item_id?: string
          new_quantity?: number
          notes?: string | null
          old_quantity?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          applied_invoice_id: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          id: string
          method: string
          notes: string | null
          number: string
          paid_at: string
          paid_from_account_id: string
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          applied_invoice_id?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          number?: string
          paid_at?: string
          paid_from_account_id: string
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          applied_invoice_id?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          number?: string
          paid_at?: string
          paid_from_account_id?: string
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_applied_invoice_id_fkey"
            columns: ["applied_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          notes: string | null
          opening_balance: number
          payment_terms: string | null
          representative_name: string | null
          supplier_name: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          opening_balance?: number
          payment_terms?: string | null
          representative_name?: string | null
          supplier_name: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          opening_balance?: number
          payment_terms?: string | null
          representative_name?: string | null
          supplier_name?: string
          updated_at?: string
          vat_number?: string | null
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
      waste_records: {
        Row: {
          created_at: string
          created_by: string | null
          estimated_cost: number
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          reason: string
          unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity: number
          reason: string
          unit: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          reason?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_auto_run_items: {
        Row: {
          attempt_id: string
          created_at: string
          error_summary: string | null
          finished_at: string | null
          http_status: number | null
          icv: number | null
          id: string
          invoice_hash_b64: string | null
          invoice_id: string
          previous_hash_b64: string | null
          reporting_status: string | null
          response_received_at: string | null
          result: string
          run_id: string | null
          source: string
          started_at: string
          submission_started_at: string | null
          submitted_endpoint: string | null
          validation_status: string | null
          x_global_transaction_id: string | null
          zatca_invoice_id: string | null
          zatca_response_code: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          error_summary?: string | null
          finished_at?: string | null
          http_status?: number | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          invoice_id: string
          previous_hash_b64?: string | null
          reporting_status?: string | null
          response_received_at?: string | null
          result: string
          run_id?: string | null
          source: string
          started_at?: string
          submission_started_at?: string | null
          submitted_endpoint?: string | null
          validation_status?: string | null
          x_global_transaction_id?: string | null
          zatca_invoice_id?: string | null
          zatca_response_code?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          error_summary?: string | null
          finished_at?: string | null
          http_status?: number | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          invoice_id?: string
          previous_hash_b64?: string | null
          reporting_status?: string | null
          response_received_at?: string | null
          result?: string
          run_id?: string | null
          source?: string
          started_at?: string
          submission_started_at?: string | null
          submitted_endpoint?: string | null
          validation_status?: string | null
          x_global_transaction_id?: string | null
          zatca_invoice_id?: string | null
          zatca_response_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zatca_auto_run_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zatca_auto_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zatca_auto_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zatca_auto_run_items_zatca_invoice_id_fkey"
            columns: ["zatca_invoice_id"]
            isOneToOne: false
            referencedRelation: "zatca_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_auto_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          error_summary: string | null
          failed_count: number
          halt_reason: string | null
          id: string
          initiated_by: string | null
          processed_count: number
          reported_count: number
          started_at: string
          status: string
          unknown_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          error_summary?: string | null
          failed_count?: number
          halt_reason?: string | null
          id?: string
          initiated_by?: string | null
          processed_count?: number
          reported_count?: number
          started_at?: string
          status?: string
          unknown_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          error_summary?: string | null
          failed_count?: number
          halt_reason?: string | null
          id?: string
          initiated_by?: string | null
          processed_count?: number
          reported_count?: number
          started_at?: string
          status?: string
          unknown_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      zatca_credit_notes: {
        Row: {
          amount: number
          cleared_xml_b64: string | null
          created_at: string
          environment: Database["public"]["Enums"]["zatca_environment"]
          error_message: string | null
          icv: number | null
          id: string
          invoice_hash_b64: string | null
          last_attempt_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          local_validation_errors: Json | null
          order_id: string
          original_invoice_id: string
          previous_invoice_hash_b64: string | null
          qr_payload: string | null
          refund_id: string
          response_payload: Json | null
          retry_count: number
          signed_xml_b64: string | null
          status: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at: string | null
          submitted_endpoint: string | null
          updated_at: string
          vat_amount: number
          xml_hash: string | null
          zatca_http_status: number | null
          zatca_raw_response: Json | null
          zatca_response_code: string | null
          zatca_response_message: string | null
          zatca_uuid: string | null
          zatca_validation_errors: Json | null
          zatca_warnings: Json | null
        }
        Insert: {
          amount: number
          cleared_xml_b64?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["zatca_environment"]
          error_message?: string | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          local_validation_errors?: Json | null
          order_id: string
          original_invoice_id: string
          previous_invoice_hash_b64?: string | null
          qr_payload?: string | null
          refund_id: string
          response_payload?: Json | null
          retry_count?: number
          signed_xml_b64?: string | null
          status?: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at?: string | null
          submitted_endpoint?: string | null
          updated_at?: string
          vat_amount?: number
          xml_hash?: string | null
          zatca_http_status?: number | null
          zatca_raw_response?: Json | null
          zatca_response_code?: string | null
          zatca_response_message?: string | null
          zatca_uuid?: string | null
          zatca_validation_errors?: Json | null
          zatca_warnings?: Json | null
        }
        Update: {
          amount?: number
          cleared_xml_b64?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["zatca_environment"]
          error_message?: string | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          local_validation_errors?: Json | null
          order_id?: string
          original_invoice_id?: string
          previous_invoice_hash_b64?: string | null
          qr_payload?: string | null
          refund_id?: string
          response_payload?: Json | null
          retry_count?: number
          signed_xml_b64?: string | null
          status?: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at?: string | null
          submitted_endpoint?: string | null
          updated_at?: string
          vat_amount?: number
          xml_hash?: string | null
          zatca_http_status?: number | null
          zatca_raw_response?: Json | null
          zatca_response_code?: string | null
          zatca_response_message?: string | null
          zatca_uuid?: string | null
          zatca_validation_errors?: Json | null
          zatca_warnings?: Json | null
        }
        Relationships: []
      }
      zatca_device_keys: {
        Row: {
          compliance_csid_iv: string | null
          compliance_csid_secret_encrypted: string | null
          compliance_csid_secret_iv: string | null
          compliance_csid_token_encrypted: string | null
          compliance_request_id: string | null
          csid_expires_at: string | null
          csid_issued_at: string | null
          csid_serial_number: string | null
          csr_pem: string | null
          id: boolean
          last_pih_b64: string | null
          notes: string | null
          private_key_encrypted: string | null
          private_key_iv: string | null
          production_csid_iv: string | null
          production_csid_secret_encrypted: string | null
          production_csid_secret_iv: string | null
          production_csid_token_encrypted: string | null
          public_key_pem: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compliance_csid_iv?: string | null
          compliance_csid_secret_encrypted?: string | null
          compliance_csid_secret_iv?: string | null
          compliance_csid_token_encrypted?: string | null
          compliance_request_id?: string | null
          csid_expires_at?: string | null
          csid_issued_at?: string | null
          csid_serial_number?: string | null
          csr_pem?: string | null
          id?: boolean
          last_pih_b64?: string | null
          notes?: string | null
          private_key_encrypted?: string | null
          private_key_iv?: string | null
          production_csid_iv?: string | null
          production_csid_secret_encrypted?: string | null
          production_csid_secret_iv?: string | null
          production_csid_token_encrypted?: string | null
          public_key_pem?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compliance_csid_iv?: string | null
          compliance_csid_secret_encrypted?: string | null
          compliance_csid_secret_iv?: string | null
          compliance_csid_token_encrypted?: string | null
          compliance_request_id?: string | null
          csid_expires_at?: string | null
          csid_issued_at?: string | null
          csid_serial_number?: string | null
          csr_pem?: string | null
          id?: boolean
          last_pih_b64?: string | null
          notes?: string | null
          private_key_encrypted?: string | null
          private_key_iv?: string | null
          production_csid_iv?: string | null
          production_csid_secret_encrypted?: string | null
          production_csid_secret_iv?: string | null
          production_csid_token_encrypted?: string | null
          public_key_pem?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      zatca_invoices: {
        Row: {
          cleared_xml_b64: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["zatca_doc_type"]
          environment: Database["public"]["Enums"]["zatca_environment"]
          error_message: string | null
          icv: number | null
          id: string
          invoice_hash_b64: string | null
          invoice_id: string
          last_attempt_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          local_validation_errors: Json | null
          order_id: string
          previous_invoice_hash_b64: string | null
          qr_payload: string | null
          response_payload: Json | null
          retry_count: number
          signed_xml_b64: string | null
          status: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at: string | null
          submitted_endpoint: string | null
          updated_at: string
          xml_hash: string | null
          zatca_http_status: number | null
          zatca_raw_response: Json | null
          zatca_response_code: string | null
          zatca_response_message: string | null
          zatca_uuid: string | null
          zatca_validation_errors: Json | null
          zatca_warnings: Json | null
        }
        Insert: {
          cleared_xml_b64?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["zatca_doc_type"]
          environment?: Database["public"]["Enums"]["zatca_environment"]
          error_message?: string | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          invoice_id: string
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          local_validation_errors?: Json | null
          order_id: string
          previous_invoice_hash_b64?: string | null
          qr_payload?: string | null
          response_payload?: Json | null
          retry_count?: number
          signed_xml_b64?: string | null
          status?: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at?: string | null
          submitted_endpoint?: string | null
          updated_at?: string
          xml_hash?: string | null
          zatca_http_status?: number | null
          zatca_raw_response?: Json | null
          zatca_response_code?: string | null
          zatca_response_message?: string | null
          zatca_uuid?: string | null
          zatca_validation_errors?: Json | null
          zatca_warnings?: Json | null
        }
        Update: {
          cleared_xml_b64?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["zatca_doc_type"]
          environment?: Database["public"]["Enums"]["zatca_environment"]
          error_message?: string | null
          icv?: number | null
          id?: string
          invoice_hash_b64?: string | null
          invoice_id?: string
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          local_validation_errors?: Json | null
          order_id?: string
          previous_invoice_hash_b64?: string | null
          qr_payload?: string | null
          response_payload?: Json | null
          retry_count?: number
          signed_xml_b64?: string | null
          status?: Database["public"]["Enums"]["zatca_invoice_status"]
          submitted_at?: string | null
          submitted_endpoint?: string | null
          updated_at?: string
          xml_hash?: string | null
          zatca_http_status?: number | null
          zatca_raw_response?: Json | null
          zatca_response_code?: string | null
          zatca_response_message?: string | null
          zatca_uuid?: string | null
          zatca_validation_errors?: Json | null
          zatca_warnings?: Json | null
        }
        Relationships: []
      }
      zatca_logs: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: string
          level: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          level?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          level?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      zatca_settings: {
        Row: {
          compliance_csid_at: string | null
          csid_expires_at: string | null
          csid_reference: string | null
          csr_business_category: string | null
          csr_common_name: string | null
          csr_country: string | null
          csr_invoice_type: string | null
          csr_location_address: string | null
          csr_organization_name: string | null
          csr_organization_unit: string | null
          csr_serial_number: string | null
          device_name: string
          device_serial: string
          environment: Database["public"]["Enums"]["zatca_environment"]
          id: boolean
          last_error: string | null
          last_sync_at: string | null
          notes: string | null
          onboarding_status: Database["public"]["Enums"]["zatca_onboarding_status"]
          production_base_url: string
          production_csid_at: string | null
          queue_enabled: boolean
          sandbox_base_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compliance_csid_at?: string | null
          csid_expires_at?: string | null
          csid_reference?: string | null
          csr_business_category?: string | null
          csr_common_name?: string | null
          csr_country?: string | null
          csr_invoice_type?: string | null
          csr_location_address?: string | null
          csr_organization_name?: string | null
          csr_organization_unit?: string | null
          csr_serial_number?: string | null
          device_name?: string
          device_serial?: string
          environment?: Database["public"]["Enums"]["zatca_environment"]
          id?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["zatca_onboarding_status"]
          production_base_url?: string
          production_csid_at?: string | null
          queue_enabled?: boolean
          sandbox_base_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compliance_csid_at?: string | null
          csid_expires_at?: string | null
          csid_reference?: string | null
          csr_business_category?: string | null
          csr_common_name?: string | null
          csr_country?: string | null
          csr_invoice_type?: string | null
          csr_location_address?: string | null
          csr_organization_name?: string | null
          csr_organization_unit?: string | null
          csr_serial_number?: string | null
          device_name?: string
          device_serial?: string
          environment?: Database["public"]["Enums"]["zatca_environment"]
          id?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["zatca_onboarding_status"]
          production_base_url?: string
          production_csid_at?: string | null
          queue_enabled?: boolean
          sandbox_base_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      zatca_submission_lock: {
        Row: {
          attempt_id: string | null
          invoice_id: string | null
          lease_expires_at: string | null
          lock_key: string
          locked_at: string | null
          locked_by: string | null
          source: string | null
          updated_at: string
          zatca_invoice_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          invoice_id?: string | null
          lease_expires_at?: string | null
          lock_key: string
          locked_at?: string | null
          locked_by?: string | null
          source?: string | null
          updated_at?: string
          zatca_invoice_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          invoice_id?: string | null
          lease_expires_at?: string | null
          lock_key?: string
          locked_at?: string | null
          locked_by?: string | null
          source?: string | null
          updated_at?: string
          zatca_invoice_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_journal_balanced: {
        Args: { _entry_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_finance: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      next_expense_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
      next_journal_number: { Args: never; Returns: string }
      next_order_number: { Args: never; Returns: string }
      next_supplier_payment_number: { Args: never; Returns: string }
      next_zatca_icv: { Args: never; Returns: number }
      zatca_acquire_submission_lock: {
        Args: {
          _initiated_by: string
          _invoice_id: string
          _lease_seconds?: number
          _source: string
          _zatca_invoice_id: string
        }
        Returns: string
      }
      zatca_release_submission_lock: {
        Args: { _attempt_id: string }
        Returns: boolean
      }
      zatca_renew_submission_lock: {
        Args: { _attempt_id: string; _lease_seconds?: number }
        Returns: boolean
      }
    }
    Enums: {
      account_movement_type:
        | "sale"
        | "expense"
        | "supplier_payment"
        | "salary"
        | "cash_in"
        | "cash_out"
        | "transfer"
        | "manual"
        | "opening"
      adjustment_kind: "advance" | "deduction"
      app_role: "owner" | "manager" | "finance" | "cashier"
      cash_movement_type: "pay_in" | "pay_out"
      chart_account_type:
        | "asset"
        | "liability"
        | "revenue"
        | "expense"
        | "equity"
      employee_status: "active" | "disabled"
      expense_category:
        | "salary"
        | "electricity"
        | "water"
        | "internet"
        | "rent"
        | "ads"
        | "license"
        | "maintenance"
        | "advance"
        | "other"
      finance_account_type: "cashbox" | "bank" | "network"
      journal_source:
        | "pos"
        | "purchase"
        | "supplier_payment"
        | "expense"
        | "salary"
        | "waste"
        | "manual"
      journal_status: "draft" | "posted" | "reversed"
      order_status:
        | "new"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
        | "held"
        | "partially_refunded"
        | "refunded"
      order_type: "dine_in" | "takeaway" | "delivery" | "delivery_app"
      payment_method:
        | "cash"
        | "card"
        | "mada"
        | "apple_pay"
        | "visa"
        | "mastercard"
        | "mixed"
      product_type:
        | "broasted"
        | "sandwich"
        | "burger"
        | "side"
        | "drink"
        | "other"
      purchase_payment_method: "cash" | "bank" | "credit"
      purchase_status: "paid" | "partially_paid" | "unpaid"
      refund_type: "full" | "partial"
      salary_status: "unpaid" | "partial" | "paid"
      shift_status: "open" | "closed"
      stock_movement_type:
        | "purchase"
        | "sale_deduction"
        | "adjustment"
        | "waste"
        | "manual_correction"
      zatca_doc_type: "invoice" | "credit_note"
      zatca_environment: "simulation" | "production"
      zatca_invoice_status:
        | "pending_generation"
        | "generated"
        | "pending_sync"
        | "synced"
        | "failed"
        | "rejected"
        | "signed"
        | "submitting"
        | "sent"
        | "local_validation_failed"
        | "validated_blocked"
      zatca_onboarding_status:
        | "not_started"
        | "settings_missing"
        | "ready_for_otp"
        | "otp_entered"
        | "onboarding_pending"
        | "onboarded"
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
      account_movement_type: [
        "sale",
        "expense",
        "supplier_payment",
        "salary",
        "cash_in",
        "cash_out",
        "transfer",
        "manual",
        "opening",
      ],
      adjustment_kind: ["advance", "deduction"],
      app_role: ["owner", "manager", "finance", "cashier"],
      cash_movement_type: ["pay_in", "pay_out"],
      chart_account_type: [
        "asset",
        "liability",
        "revenue",
        "expense",
        "equity",
      ],
      employee_status: ["active", "disabled"],
      expense_category: [
        "salary",
        "electricity",
        "water",
        "internet",
        "rent",
        "ads",
        "license",
        "maintenance",
        "advance",
        "other",
      ],
      finance_account_type: ["cashbox", "bank", "network"],
      journal_source: [
        "pos",
        "purchase",
        "supplier_payment",
        "expense",
        "salary",
        "waste",
        "manual",
      ],
      journal_status: ["draft", "posted", "reversed"],
      order_status: [
        "new",
        "preparing",
        "ready",
        "completed",
        "cancelled",
        "held",
        "partially_refunded",
        "refunded",
      ],
      order_type: ["dine_in", "takeaway", "delivery", "delivery_app"],
      payment_method: [
        "cash",
        "card",
        "mada",
        "apple_pay",
        "visa",
        "mastercard",
        "mixed",
      ],
      product_type: [
        "broasted",
        "sandwich",
        "burger",
        "side",
        "drink",
        "other",
      ],
      purchase_payment_method: ["cash", "bank", "credit"],
      purchase_status: ["paid", "partially_paid", "unpaid"],
      refund_type: ["full", "partial"],
      salary_status: ["unpaid", "partial", "paid"],
      shift_status: ["open", "closed"],
      stock_movement_type: [
        "purchase",
        "sale_deduction",
        "adjustment",
        "waste",
        "manual_correction",
      ],
      zatca_doc_type: ["invoice", "credit_note"],
      zatca_environment: ["simulation", "production"],
      zatca_invoice_status: [
        "pending_generation",
        "generated",
        "pending_sync",
        "synced",
        "failed",
        "rejected",
        "signed",
        "submitting",
        "sent",
        "local_validation_failed",
        "validated_blocked",
      ],
      zatca_onboarding_status: [
        "not_started",
        "settings_missing",
        "ready_for_otp",
        "otp_entered",
        "onboarding_pending",
        "onboarded",
        "failed",
      ],
    },
  },
} as const
