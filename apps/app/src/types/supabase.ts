export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: number
          created_at: string
          title: string
          message: string
          sender_id: string
          school_id: number
          related_type: string
          related_id: number
        }
        Insert: {
          id?: number
          created_at?: string
          title: string
          message: string
          sender_id: string
          school_id: number
          related_type: string
          related_id: number
        }
      }
      profiles: {
        Row: {
          id: number
          user_id: string
          school_id: number
          fcm_token: string | null
        }
        Insert: {
          id?: number
          user_id: string
          school_id: number
          fcm_token?: string | null
        }
      }
      schools: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
      }
    }
  }
}
