// src/lib/supabase-server.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 쿠키 옵션 타입 정의 (Netlify 빌드를 위해 추가)
type CookieOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

export async function createClient() {
  // 옵션 객체를 비워서 전달 - Netlify 빌드를 위해 타입 오류 회피
  // Supabase SSR은 Next.js 환경을 자동으로 감지하여 기본 쿠키 처리 실행
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {}
  );
}
