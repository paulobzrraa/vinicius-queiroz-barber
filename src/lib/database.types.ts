/**
 * Tipos das tabelas do Supabase, escritos à mão a partir de supabase/schema.sql
 * (sem CLI/service_role disponível para gerar automaticamente). Mantenha os
 * dois em sincronia ao alterar o schema.
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube'
export type BookingProvider = 'whatsapp' | 'external' | 'native'
export type GalleryCategory = 'ambiente' | 'corte' | 'barba' | 'detalhe'
export type GalleryAspect = 'square' | 'portrait' | 'landscape'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show'
export type AppointmentSource = 'site' | 'admin'
export type AppointmentChangedBy = 'client' | 'admin' | 'system'
export type PaymentMethod = 'cash' | 'debit_card' | 'credit_card' | 'pix'
export type ExpenseCategory =
  'rent' | 'supplies' | 'utilities' | 'maintenance' | 'marketing' | 'commission' | 'other'

/** Retorno de check_client_credentials (jsonb): new = e-mail sem conta (será criada), weak = conta nova com senha fraca, valid/invalid = senha confere ou não. */
export type ClientCredentialsStatus =
  | { status: 'new' | 'valid' | 'invalid' | 'weak' }
  | { status: 'locked'; retry_after_seconds: number }

/** Retorno de change_client_password (jsonb). */
export type ChangePasswordResult =
  { status: 'ok' | 'invalid' | 'weak' | 'same' } | { status: 'locked'; retry_after_seconds: number }

/** Retorno de client_login (jsonb): ok=false = e-mail/senha incorretos, ou conta bloqueada (locked). */
export type ClientLoginResult =
  | { ok: false; locked?: boolean; retry_after_seconds?: number }
  | {
      ok: true
      appointments: {
        access_token: string
        starts_at: string
        status: AppointmentStatus
        professional_name: string
        services: string[]
      }[]
    }

interface Table<Row, Insert, Update = Partial<Insert>> {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      site_settings: Table<
        {
          id: number
          name: string
          tagline: string | null
          description: string | null
          url: string | null
          locale: string
          about_body: string | null
          hero_image_url: string | null
          about_gif_url: string | null
          hero_focus_desktop: { x: number; y: number; zoom: number }
          hero_focus_mobile: { x: number; y: number; zoom: number }
        },
        {
          id?: number
          name: string
          tagline?: string | null
          description?: string | null
          url?: string | null
          locale?: string
          about_body?: string | null
          hero_image_url?: string | null
          about_gif_url?: string | null
          hero_focus_desktop?: { x: number; y: number; zoom: number }
          hero_focus_mobile?: { x: number; y: number; zoom: number }
        }
      >
      contact_settings: Table<
        {
          id: number
          whatsapp: string | null
          phone: string | null
          email: string | null
          street: string | null
          neighborhood: string | null
          city: string
          state: string
          postal_code: string | null
          country: string
          maps_url: string | null
        },
        {
          id?: number
          whatsapp?: string | null
          phone?: string | null
          email?: string | null
          street?: string | null
          neighborhood?: string | null
          city: string
          state: string
          postal_code?: string | null
          country?: string
          maps_url?: string | null
        }
      >
      booking_settings: Table<
        {
          id: number
          provider: BookingProvider
          external_url: string | null
          whatsapp_message: string
          min_advance_minutes: number
          max_advance_days: number
          min_cancel_notice_minutes: number
        },
        {
          id?: number
          provider?: BookingProvider
          external_url?: string | null
          whatsapp_message?: string
          min_advance_minutes?: number
          max_advance_days?: number
          min_cancel_notice_minutes?: number
        }
      >
      opening_hours: Table<
        {
          id: string
          days: string
          hours: string
          sort_order: number
          weekday: number | null
          opens_at: string | null
          closes_at: string | null
        },
        {
          id?: string
          days: string
          hours: string
          sort_order?: number
          weekday?: number | null
          opens_at?: string | null
          closes_at?: string | null
        }
      >
      social_links: Table<
        { id: string; platform: SocialPlatform; url: string; sort_order: number },
        { id?: string; platform: SocialPlatform; url: string; sort_order?: number }
      >
      services: Table<
        {
          id: string
          name: string
          description: string
          price: number | null
          duration_minutes: number
          sort_order: number
          buffer_minutes: number | null
          active: boolean
        },
        {
          id: string
          name: string
          description: string
          price?: number | null
          duration_minutes: number
          sort_order?: number
          buffer_minutes?: number | null
          active?: boolean
        }
      >
      gallery_images: Table<
        {
          id: string
          alt: string
          category: GalleryCategory
          aspect: GalleryAspect
          src: string | null
          sort_order: number
        },
        {
          id: string
          alt: string
          category: GalleryCategory
          aspect: GalleryAspect
          src?: string | null
          sort_order?: number
        }
      >
      testimonials: Table<
        { id: string; client_name: string; rating: number; quote: string; sort_order: number },
        {
          id?: string
          client_name: string
          rating: number
          quote: string
          sort_order?: number
        }
      >
      professionals: Table<
        {
          id: string
          name: string
          photo_url: string | null
          bio: string | null
          active: boolean
          sort_order: number
          buffer_minutes: number | null
          commission_percent: number | null
        },
        {
          id?: string
          name: string
          photo_url?: string | null
          bio?: string | null
          active?: boolean
          sort_order?: number
          buffer_minutes?: number | null
          commission_percent?: number | null
        }
      >
      professional_services: Table<
        {
          professional_id: string
          service_id: string
          price: number | null
          duration_minutes: number | null
        },
        {
          professional_id: string
          service_id: string
          price?: number | null
          duration_minutes?: number | null
        }
      >
      professional_hours: Table<
        {
          id: string
          professional_id: string
          weekday: number
          starts_at: string
          ends_at: string
          break_starts_at: string | null
          break_ends_at: string | null
        },
        {
          id?: string
          professional_id: string
          weekday: number
          starts_at: string
          ends_at: string
          break_starts_at?: string | null
          break_ends_at?: string | null
        }
      >
      schedule_exceptions: Table<
        {
          id: string
          professional_id: string | null
          starts_at: string
          ends_at: string
          reason: string | null
        },
        {
          id?: string
          professional_id?: string | null
          starts_at: string
          ends_at: string
          reason?: string | null
        }
      >
      appointments: Table<
        {
          id: string
          access_token: string
          client_name: string
          client_phone: string
          client_email: string | null
          client_account_id: string | null
          professional_id: string
          starts_at: string
          ends_at: string
          status: AppointmentStatus
          source: AppointmentSource
          payment_method: PaymentMethod | null
          created_at: string
        },
        {
          id?: string
          access_token?: string
          client_name: string
          client_phone: string
          client_email?: string | null
          client_account_id?: string | null
          professional_id: string
          starts_at: string
          ends_at: string
          status?: AppointmentStatus
          source?: AppointmentSource
          payment_method?: PaymentMethod | null
          created_at?: string
        }
      >
      appointment_services: Table<
        {
          appointment_id: string
          service_id: string
          price: number | null
          duration_minutes: number | null
        },
        {
          appointment_id: string
          service_id: string
          price?: number | null
          duration_minutes?: number | null
        }
      >
      appointment_status_history: Table<
        {
          id: string
          appointment_id: string
          status: AppointmentStatus
          changed_by: AppointmentChangedBy
          changed_at: string
        },
        {
          id?: string
          appointment_id: string
          status: AppointmentStatus
          changed_by: AppointmentChangedBy
          changed_at?: string
        }
      >
      notification_settings: Table<
        {
          id: number
          telegram_function_url: string | null
          telegram_function_secret: string | null
          push_function_url: string | null
          push_function_secret: string | null
        },
        {
          id?: number
          telegram_function_url?: string | null
          telegram_function_secret?: string | null
          push_function_url?: string | null
          push_function_secret?: string | null
        }
      >
      push_subscriptions: Table<
        {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_secret: string
          user_agent: string | null
          active: boolean
          last_error: string | null
          created_at: string
        },
        never
      >
      push_notifications: Table<
        {
          id: string
          appointment_id: string
          kind: 'created' | 'canceled' | 'updated'
          status: 'pending' | 'sent' | 'failed' | 'skipped'
          devices: number
          last_error: string | null
          created_at: string
          sent_at: string | null
        },
        never
      >
      expenses: Table<
        {
          id: string
          description: string
          amount: number
          category: ExpenseCategory
          expense_date: string
          recurring: boolean
          created_at: string
        },
        {
          id?: string
          description: string
          amount: number
          category: ExpenseCategory
          expense_date?: string
          recurring?: boolean
          created_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      get_appointment_by_token: {
        Args: { token: string }
        Returns: Database['public']['Tables']['appointments']['Row'][]
      }
      get_available_slots: {
        Args: { p_service_ids: string[]; p_date: string; p_professional_id?: string | null }
        Returns: { professional_id: string; starts_at: string; ends_at: string }[]
      }
      get_available_dates: {
        Args: {
          p_service_ids: string[]
          p_start_date: string
          p_end_date: string
          p_professional_id?: string | null
        }
        Returns: { available_date: string }[]
      }
      create_appointment: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_service_ids: string[]
          p_starts_at: string
          p_professional_id?: string | null
          p_client_email?: string | null
          p_client_password?: string | null
        }
        Returns: Database['public']['Tables']['appointments']['Row']
      }
      client_account_exists: {
        Args: { p_email: string }
        Returns: boolean
      }
      check_client_credentials: {
        Args: { p_email: string; p_password: string }
        Returns: ClientCredentialsStatus
      }
      my_appointments: {
        Args: Record<string, never>
        Returns: ClientLoginResult
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_push_public_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      change_client_password: {
        Args: { p_email: string; p_current_password: string; p_new_password: string }
        Returns: ChangePasswordResult
      }
      client_login: {
        Args: { p_email: string; p_password: string }
        Returns: ClientLoginResult
      }
      reset_client_password: {
        Args: { p_email: string; p_new_password: string }
        Returns: number
      }
      cancel_appointment: {
        Args: { p_token: string }
        Returns: Database['public']['Tables']['appointments']['Row']
      }
      reschedule_appointment: {
        Args: { p_token: string; p_starts_at: string }
        Returns: Database['public']['Tables']['appointments']['Row']
      }
      anonymize_old_appointments: {
        Args: { p_older_than?: string }
        Returns: number
      }
      erase_client_data: {
        Args: { p_client_phone: string }
        Returns: number
      }
      register_push_subscription: {
        Args: {
          p_endpoint: string
          p_p256dh: string
          p_auth_secret: string
          p_user_agent?: string | null
        }
        Returns: string
      }
      unregister_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      admin_create_appointment: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_professional_id: string
          p_service_ids: string[]
          p_starts_at: string
        }
        Returns: string
      }
      admin_move_appointment: {
        Args: {
          p_appointment_id: string
          p_professional_id: string
          p_starts_at: string
          p_service_ids: string[]
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
