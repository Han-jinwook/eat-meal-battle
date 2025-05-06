// src/lib/supabase-server.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 가장 기본적인 쿠키 구현
        // 좀 다른 방식이지만 Netlify 빌드에서 타입 오류 피하기 위해 시도
        get: function(name) {
          return cookieStore.get(name)?.value
        },
        set: function(name, value) {
          cookieStore.set(name, value)
        }
      }
    }
  );
}
