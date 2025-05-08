import { createBrowserClient } from '@supabase/ssr'

// 에러 로깅 조용히 처리를 위한 래퍼
export const createClient = () => {
  // 키가 없는 경우 조용히 처리 (개발 환경에서 콘솔 에러 방지)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 네트워크 오류 발생 시 재시도 횟수 감소 (개발 환경 최적화)
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        // 404 요청 등의 불필요한 오류 로깅 방지
        fetch: (...args) => {
          return fetch(...args).catch(err => {
            // 404 에러는 조용히 처리
            if (err.status === 404) {
              return new Response(JSON.stringify({ error: 'Not found', quiet: true }), { status: 404 });
            }
            throw err;
          });
        }
      }
    });
  } catch (e) {
    // 초기화 오류는 조용히 처리하고 기본 클라이언트 반환
    console.debug('Supabase 클라이언트 초기화 중 오류 발생 (무시됨)');
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
}
