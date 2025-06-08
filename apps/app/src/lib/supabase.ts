import { createBrowserClient } from '@supabase/ssr'

// 싱글톤 인스턴스 저장을 위한 변수
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

// 에러 로깅 조용히 처리를 위한 래퍼
export const createClient = () => {
  // 이미 인스턴스가 있으면 재사용
  if (supabaseInstance) {
    return supabaseInstance;
  }
  // 키가 없는 경우 조용히 처리 (개발 환경에서 콘솔 에러 방지)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  try {
    // 인스턴스 생성하고 저장
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 네트워크 오류 발생 시 재시도 횟수 감소 (개발 환경 최적화)
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        // API 키 없는 요청 및 404 오류 처리 개선
        fetch: (...args) => {
          // URL을 파싱해서 검사
          const urlStr = String(args[0] instanceof URL ? args[0].toString() : args[0]);
          
          // 예외 처리할 엔드포인트 정의
          const exemptEndpoints = [
            '/meal_images', 
            '/profiles', 
            '/menu_item_ratings',
            '/school_infos',
            '/quiz',
            '/comment_likes'
          ];
          
          // comment_likes 특수 처리 - 406 에러 개선
          if (urlStr.includes('/comment_likes')) {
            return fetch(...args).then(response => {
              // 406 Not Acceptable 처리
              if (response.status === 406) {
                return new Response(JSON.stringify({ data: [] }), { 
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              return response;
            }).catch(err => {
              console.debug('comment_likes 요청 처리 중 오류:', err);
              return new Response(JSON.stringify({ data: [] }), { status: 200 });
            });
          }
          
          // 예외 처리 검사 - URL 파라미터를 포함한 전체 URL 기반 검사
          const isExemptEndpoint = exemptEndpoints.some(endpoint => 
            urlStr.includes(endpoint) || 
            urlStr.includes('school_infos') || 
            urlStr.includes('/quiz')
          );
          
          // 모든 REST API 요청에 API 키 자동 추가
          if (urlStr.includes('/rest/v1/')) {
            const headers = args[1]?.headers || {};
            args[1] = {
              ...args[1],
              headers: {
                ...headers,
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`
              }
            };
          }
          
          // Supabase REST API 직접 호출 차단 - 권한 부재 오류 방지 (예외 엔드포인트 제외)
          if (urlStr.includes('/rest/v1/') && 
              !isExemptEndpoint &&
              (!args[1]?.headers || 
               (!Object.entries(args[1]?.headers || {}).some(([k, v]) => 
                  k.toLowerCase() === 'apikey' || k.toLowerCase() === 'authorization')))) {
            console.debug('권한 없는 Supabase REST API 요청 차단:', urlStr);
            return Promise.resolve(new Response(JSON.stringify({
              message: "No API key found in request",
              hint: "No 'apikey' request header or url param was found."
            }), { status: 401 }));
          }
          
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
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  }
}
