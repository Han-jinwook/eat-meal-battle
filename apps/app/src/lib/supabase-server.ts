// src/lib/supabase-server.ts

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// This client is for use in Server Components, Route Handlers, and Server Actions
export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.error('쿠키 설정 오류:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('쿠키 삭제 오류:', error);
          }
        }
      },
      // 세션 관리 개선 및 테스터 계정 호환성 강화
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      },
      // 쿠키 설정 개선 - 서버와 클라이언트 일관성 유지
      cookieOptions: {
        name: 'sb-auth-token-server',
        lifetime: 60 * 60 * 24 * 7, // 7일
        domain: '',
        path: '/',
        sameSite: 'lax'
      }
    }
  );
}
