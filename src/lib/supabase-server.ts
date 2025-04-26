import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string): Promise<string | undefined> {
          const cookieStore = await cookies()
          const allCookies = cookieStore.getAll()
          const found = allCookies.find(cookie => cookie.name === name)
          return found?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          const cookieStore = await cookies()
          cookieStore.set({ name, value, ...options })
        },
        async remove(name: string, options: CookieOptions) {
          const cookieStore = await cookies()
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
