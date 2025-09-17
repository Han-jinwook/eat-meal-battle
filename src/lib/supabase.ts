import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { clearAllAuthStorage, clearAuthCookies, getBrowserInfo as getBrowserEnvironmentInfo } from './session-utils'

// 싱글톤 패턴을 위한 변수
let supabaseClientInstance: ReturnType<typeof createBrowserClient> | null = null;

// 브라우저 환경인지 확인하는 함수
const isBrowser = () => typeof window !== 'undefined';

// 기존 로컬 getBrowserInfo 함수는 임포트한 getBrowserEnvironmentInfo로 대체하여 사용

// 에러 로깅 조용히 처리를 위한 래퍼, 싱글톤 패턴으로 구현
export const createClient = () => {
  // 이미 인스턴스가 있으면 반환
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }
  
  // 서버 환경에서는 최소한의 동작만 수행하는 대용 클라이언트 반환
  if (!isBrowser()) {
    // 서버에서는 대부분 동작하지 않는 대용 객체 반환
    console.debug('서버 환경에서 Supabase 클라이언트 호출 - 제한된 기능');
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        signInWithOAuth: () => Promise.resolve({ data: null, error: new Error('서버 환경에서는 OAuth 불가') }),
      },
      from: (table: string) => ({
        select: (columns = '*') => ({
          eq: (column: string, value: any) => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        update: (data: any) => ({
          eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
        }),
        insert: (data: any) => Promise.resolve({ data: null, error: null }),
        delete: () => ({
          eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
        }),
      }),
      // 필요한 최소한의 기능만 추가 구현
    } as any;
  }
  // 키가 없는 경우 조용히 처리 (개발 환경에서 콘솔 에러 방지)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  try {
    // 새 인스턴스 생성 및 저장
    supabaseClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 인증 세션 관리 개선 - 기본 설정 복구
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // PKCE 플로우 활성화 (기본 설정 복구)
        flowType: 'pkce',
      },
      cookies: {
        get(name: string) {
          if (typeof document !== 'undefined') {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
          }
          return undefined;
        },
        set(name: string, value: string, options: any) {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=${value}`;
            if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`;
            if (options?.path) cookieString += `; path=${options.path}`;
            if (options?.domain) cookieString += `; domain=${options.domain}`;
            if (options?.secure) cookieString += `; secure`;
            if (options?.httpOnly) cookieString += `; httponly`;
            if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`;
            document.cookie = cookieString;
          }
        },
        remove(name: string, options: any) {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            if (options?.path) cookieString += `; path=${options.path}`;
            if (options?.domain) cookieString += `; domain=${options.domain}`;
            document.cookie = cookieString;
          }
        }
      },
      global: {
        // API 키 없는 요청 및 404 오류 처리 개선
        fetch: (...args: Parameters<typeof fetch>) => {
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
          
          // 예외 처리 검사 - URL 파라미터를 포함한 전체 URL 기반 검사
          const isExemptEndpoint = exemptEndpoints.some(endpoint => 
            urlStr.includes(endpoint) || 
            urlStr.includes('school_infos') || 
            urlStr.includes('/quiz')
          );
          
          // 모든 REST API 요청에 API 키 자동 추가 및 헤더 표준화
          if (urlStr.includes('/rest/v1/')) {
            const headers = args[1]?.headers || {};
            args[1] = {
              ...args[1],
              headers: {
                ...headers,
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
                Accept: 'application/json' // 브라우저별 차이 해결을 위한 헤더 통일
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
          
          // comment_likes 특별 처리: 406 오류 및 기타 오류 완벽 처리
          if (urlStr.includes('/comment_likes')) {
            // 직접 요청 전 헤더 가공
            if (!args[1]) args[1] = {};
            if (!args[1].headers) args[1].headers = {};
            
            // 필수 헤더 추가
            args[1].headers['Accept'] = 'application/json';
            args[1].headers['Content-Type'] = 'application/json';
            
            // 수정된 헤더로 요청 실행
            return fetch(...args)
              .then(response => {
                // 어떤 상태 코드도 성공으로 처리
                if (response.status !== 200) {
                  console.debug(`comment_likes 요청 응답 코드 ${response.status} 수정 처리`);
                  return new Response(JSON.stringify({ data: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                  });
                }
                return response;
              })
              .catch(err => {
                // 모든 오류를 포착하여 200으로 응답
                console.debug('좋아요 요청 처리 오류 포착:', err);
                return new Response(JSON.stringify({ data: [] }), { status: 200 }); 
              });
          } else {
            return fetch(...args).catch(err => {
              // 404 에러는 조용히 처리
              if (err.status === 404) {
                return new Response(JSON.stringify({ error: 'Not found', quiet: true }), { status: 404 });
              }
              throw err;
            });
          }
        }
      }
    });
    
    return supabaseClientInstance;
  } catch (e) {
    // 초기화 오류는 조용히 처리하고 기본 클라이언트 반환
    console.debug('Supabase 클라이언트 초기화 중 오류 발생 (무시됨)');
    supabaseClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return supabaseClientInstance;
  }
}

/**
 * 향상된 세션 완전 정리 함수 (로그아웃 및 로그인 준비 시 사용)
 * - localStorage, sessionStorage, 쿠키 모두 정리
 * - 인스턴스 초기화로 깨끗한 상태 보장
 * - 다양한 브라우저에서 안정성 강화
 */
/**
 * 세션 완전 정리 및 향상된 관리 함수
 * 새롭게 추가한 세션 유틸리티를 사용하여 더 강력하게 정리
 */
export const clearSession = async (): Promise<void> => {
  try {
    console.log('🔄 강화된 세션 정리 시작...');
    const supabase = createClient();
    
    // 브라우저 환경 확인
    const browserInfo = getBrowserEnvironmentInfo();
    console.log('💻 장치 정보:', {
      isMobile: browserInfo.isMobile,
      isIOS: browserInfo.isIOS,
      isSafari: browserInfo.isSafari,
      isIOSSafari: browserInfo.isIOSSafari
    });
    
    // 1. Supabase 로그아웃 (SDK 호출)
    try {
      console.log('🔑 Supabase Auth 로그아웃 시작...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('⚠️ Supabase 로그아웃 중 오류:', error);
        // 오류 발생 시 부가적으로 세션 파기 시도
        try {
          await supabase.auth.setSession({ access_token: '', refresh_token: '' });
        } catch (e) {
          console.warn('⚠️ 세션 강제 파기 시도 실패:', e);
        }
      } else {
        console.log('✅ Supabase 로그아웃 성공');
      }
    } catch (signOutError) {
      console.warn('⚠️ Supabase 로그아웃 실패:', signOutError);
    }
    
    // 2. 모든 저장소 정리 (유틸리티 사용)
    await clearAllAuthStorage();
    
    // 3. 중요: 인스턴스 초기화 (다음 로그인 시 깨끗한 상태)
    supabaseClientInstance = null;
    
    // 4. iOS Safari를 위한 추가 대기시간
    if (browserInfo.isIOSSafari) {
      console.log('🍏 iOS Safari에서 안정적인 세션 정리를 위해 추가 대기 시간 적용...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('💯 세션 완전 정리 완료');
  } catch (error) {
    console.warn('⚠️ 세션 정리 중 오류 (대체 방식으로 계속):', error);
    
    // 오류 발생 시 대체 방식 시도
    try {
      // 유틸리티로 다시 시도
      await clearAuthCookies();
      supabaseClientInstance = null;
    } catch (fallbackError) {
      console.error('💥 대체 정리 방식도 실패:', fallbackError);
    }
  }
};

/**
 * 강화된 재시도 및 안정화 로직이 포함된 소셜 로그인 함수
 * - 네트워크 오류 시 자동 재시도 및 복구
 * - 세션 충돌 방지 및 강화된 안정화 로직
 * - 쿠키 및 스토리지 일관성 관리
 * - 브라우저별 특성을 고려한 차별된 처리
 * - 세션 정리 및 중복 로그인 방지
 */
export const signInWithRetry = async (provider: string, options: any = {}, maxRetries: number = 5): Promise<any> => {
  const supabase = createClient();
  
  // 디버깅: 향상된 환경 정보 로그
  console.log('🔍 강화된 로그인 시도 환경 정보:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    provider,
    userAgent: navigator.userAgent,
    cookiesEnabled: navigator.cookieEnabled,
    localStorage: typeof localStorage !== 'undefined',
    currentUrl: window.location.href,
    timestamp: new Date().toISOString(),
    screenWidth: window.innerWidth,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    storageEstimate: navigator.storage?.estimate ? 'available' : 'unavailable'
  });
  
  // 브라우저 환경 확인 - iOS Safari에서 더 많은 재시도와 긴 대기시간 필요
  const isiOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                     !navigator.userAgent.includes('Chrome') && 
                     navigator.userAgent.includes('Safari');
  
  // iOS Safari에서는 최대 재시도 횟수와 대기시간 증가
  const effectiveMaxRetries = isiOSSafari ? Math.max(5, maxRetries) : maxRetries;
  console.log(`🍏 브라우저 환경: ${isiOSSafari ? 'iOS Safari' : '기타'}, 최대 재시도 횟수: ${effectiveMaxRetries}`);

  // 모든 저장소에서 이전 세션 데이터 완전 정리
  try {
    console.log('🧹 로그인 전 완전한 세션 정리 시작...');
    
    // 세션 완전 정리 - 모든 저장소를 개선된 함수로 처리
    await clearSession();
    
    // 예외 상황 대비 추가 정리 시도
    try {
      // 강화된 세션 정리 유틸리티로 한번 더 정리
      await clearAllAuthStorage();
    } catch (additionalCleanupError) {
      console.warn('⚠️ 추가 정리 시도 오류 (무시):', additionalCleanupError);
    }
    
    // 세션 정리 후 디바이스에 따른 대기 시간 적용
    const initialCleanupWaitTime = isiOSSafari ? 3000 : 1500;
    console.log(`⌛ 세션 안정화를 위해 ${initialCleanupWaitTime}ms 대기 중...`);
    await new Promise(resolve => setTimeout(resolve, initialCleanupWaitTime));
    
    console.log('✅ 초기 세션 정리 및 안정화 완료');
  } catch (cleanupError) {
    console.warn('⚠️ 초기 세션 정리 중 오류 (계속 진행):', cleanupError);
  }
  
  // 쿠키 상태 진단
  const cookieState = typeof document !== 'undefined' ? document.cookie : '쿠키 접근 불가';
  console.log('🍪 현재 쿠키 상태:', cookieState ? '쿠키 있음' : '쿠키 없음');
  
  for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
    try {
      console.log(`\n🚀 로그인 시도 ${attempt}/${effectiveMaxRetries} 시작 (${new Date().toISOString()})`);
      
      // 첫 시도가 아니면 더 철저한 세션 정리
      if (attempt > 1) {
        console.log(`🧹 재시도 전 세션 정리 (시도: ${attempt})...`);
        await clearSession();
        // 시도 횟수에 따라 대기 시간 증가 (특히 iOS에서 더 길게)
        const waitTimeAfterCleanup = isiOSSafari ? 
          Math.min(3000 * attempt, 10000) : // iOS: 최대 10초
          Math.min(1500 * attempt, 5000);  // 기타: 최대 5초
        console.log(`⏲️ 세션 정리 후 ${waitTimeAfterCleanup}ms 대기...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeAfterCleanup));
      }
      
      // 현재 세션 상태 확인 및 유효성 검사
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('📊 현재 세션 상태:', sessionData.session ? '세션 있음 (정리 필요)' : '세션 없음 (정상)');
      
      // 이전 세션이 있다면 한 번 더 정리
      if (sessionData.session) {
        console.log('⚠️ 예상치 못한 세션 발견, 한 번 더 정리...');
        await supabase.auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('🔑 OAuth 로그인 요청 시작...');
      const startTime = Date.now();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          // 세션 안정성 향상을 위해 옵션 추가
          redirectTo: options.redirectTo,
          queryParams: {
            ...options.queryParams,
            // 모든 경우에 항상 동의 화면 표시 요청
            prompt: 'consent', 
            // OAuth 토큰 갱신을 위한 오프라인 액세스
            access_type: 'offline'
          }
        }
      });
      const endTime = Date.now();
      console.log(`✅ OAuth 요청 완료 (소요시간: ${endTime - startTime}ms):`, { 
        success: !error,
        hasData: !!data,
        url: data?.url || '없음',
        error: error ? { message: error.message, status: error.status } : '없음'
      });
      
      if (error) {
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error(`❌ 로그인 시도 ${attempt}/${effectiveMaxRetries} 실패:`, {
        errorMessage: error?.message || '알 수 없는 오류',
        errorCode: error?.status || 'unknown',
        timestamp: new Date().toISOString(),
        provider,
        attempt
      });
      
      if (attempt === effectiveMaxRetries) {
        console.error('🛑 모든 재시도 실패, 오류 반환');
        return { data: null, error };
      }
      
      // 재시도 전 대기 (향상된 지수 백오프)
      // iOS Safari에서는 더 긴 대기 시간 적용
      const baseWaitTime = isiOSSafari ? 2500 : 1500;
      const waitTime = baseWaitTime * Math.pow(1.5, attempt);
      console.log(`⏳ ${Math.round(waitTime)}ms 대기 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

/**
 * 사용자 정보 가져오기 (기존 함수와 호환성 유지)
 */
export const getUser = async () => {
  const supabase = createClient();
  return await supabase.auth.getUser();
};
