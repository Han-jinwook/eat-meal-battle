import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@meal-battle/types';

// 싱글톤 인스턴스를 저장할 변수
let supabaseInstance: any = null;

/**
 * Supabase 클라이언트를 생성하는 함수 (싱글톤 패턴)
 * - 오류 처리 및 오류 로깅 제한 기능 포함
 * - @supabase/ssr 패키지 사용
 * - 다중 GoTrueClient 인스턴스 생성 방지
 * - 세션 안정성 개선 (로그인/로그아웃 반복 시 불안정 해결)
 */
export const createClient = () => {
  // 이미 인스턴스가 있으면 재사용
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // 키가 없는 경우 조용히 처리 (개발 환경에서 콘솔 에러 방지)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  try {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 세션 관리 강화
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // 여러 저장소에 세션 데이터 중복 저장으로 안정성 강화
        storageKey: 'sb-auth-token',
        storage: {
          getItem: (key) => {
            try {
              // localStorage, sessionStorage, cookie 모두 시도
              const localData = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
              if (localData) return localData;
              
              const sessionData = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
              if (sessionData) return sessionData;
              
              // 마지막으로 쿠키 확인
              if (typeof document !== 'undefined') {
                const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
                if (match) return match[2];
              }
              return null;
            } catch(e) {
              console.debug('세션 데이터 접근 실패:', e);
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              // 여러 저장소에 중복 저장
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, value);
                window.sessionStorage.setItem(key, value);
                
                // 쿠키에도 저장 (7일 유효)
                const expires = new Date();
                expires.setDate(expires.getDate() + 7);
                document.cookie = `${key}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
              }
            } catch(e) {
              console.debug('세션 데이터 저장 실패:', e);
            }
          },
          removeItem: (key) => {
            try {
              // 모든 저장소에서 제거
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem(key);
                window.sessionStorage.removeItem(key);
                document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
              }
            } catch(e) {
              console.debug('세션 데이터 제거 실패:', e);
            }
          }
        },
        // 디버그 모드 활성화 (문제 진단 위해)
        debug: true,
      },
      cookies: {
        get: (name: string) => {
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [key, value] = cookie.trim().split('=');
              if (key === name) return value;
            }
          }
          return null;
        },
        set: (name: string, value: string, options: any) => {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=${value}`;
            if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`;
            if (options?.path) cookieString += `; path=${options.path}`;
            if (options?.domain) cookieString += `; domain=${options.domain}`;
            if (options?.secure) cookieString += '; secure';
            if (options?.httpOnly) cookieString += '; httponly';
            if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`;
            document.cookie = cookieString;
          }
        },
        remove: (name: string, options: any) => {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            if (options?.path) cookieString += `; path=${options.path}`;
            if (options?.domain) cookieString += `; domain=${options.domain}`;
            document.cookie = cookieString;
          }
        }
      },
      global: {
        // 네트워크 재시도 및 타임아웃 설정
        fetch: (...args) => {
          const [url, config = {}] = args;
          const timeoutConfig = {
            ...config,
            // 타임아웃 설정 (30초)
            signal: AbortSignal.timeout(30000),
          };
          
          return fetch(url, timeoutConfig).catch(err => {
            // 404 에러는 조용히 처리
            if (err.status === 404) {
              return new Response(JSON.stringify({ error: 'Not found', quiet: true }), { status: 404 });
            }
            // 네트워크 오류 시 재시도 로직
            if (err.name === 'AbortError' || err.name === 'TimeoutError') {
              console.debug('네트워크 타임아웃, 재시도 가능');
            }
            throw err;
          });
        }
      }
    });
    return supabaseInstance;
  } catch (e) {
    // 초기화 오류는 조용히 처리하고 기본 클라이언트 반환
    console.debug('Supabase 클라이언트 초기화 중 오류 발생 (무시됨)');
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  }
}

/**
 * 세션 완전 정리 함수 (로그아웃 시 사용)
 * - localStorage, sessionStorage, 쿠키 모두 정리
 * - 인스턴스 초기화로 깨끗한 상태 보장
 */
export const clearSession = async (): Promise<void> => {
  try {
    const supabase = createClient();
    
    // 1. Supabase 로그아웃
    await supabase.auth.signOut();
    
    // 2. 로컬 스토리지 정리
    if (typeof window !== 'undefined') {
      // Supabase 관련 키들 정리
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 세션 스토리지도 정리
      sessionStorage.clear();
      
      // 모든 쿠키 더 철저히 삭제
      document.cookie.split(';').forEach(function(c) {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    }
    
    // 3. 인스턴스 초기화 (다음 로그인 시 깨끗한 상태)
    supabaseInstance = null;
    
    console.debug('세션 완전 정리 완료');
  } catch (error) {
    console.debug('세션 정리 중 오류 (무시됨):', error);
  }
};

/**
 * 재시도 로직이 포함된 로그인 함수
 * - 네트워크 오류 시 자동 재시도
 * - 세션 충돌 방지
 */
export const signInWithRetry = async (provider: string, maxRetries: number = 3): Promise<any> => {
  const supabase = createClient();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 이전 세션이 있다면 정리
      if (attempt > 1) {
        await clearSession();
        // 잠시 대기 (세션 정리 완료 대기) - 2초로 증가
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `https://izktumvvlkrkgiuuczffp.supabase.co/auth/v1/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) {
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.debug(`로그인 시도 ${attempt}/${maxRetries} 실패:`, error);
      
      if (attempt === maxRetries) {
        return { data: null, error };
      }
      
      // 재시도 전 대기 (지수 백오프)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

/**
 * 현재 로그인한 사용자 정보를 가져오는 함수
 * @returns 로그인한 사용자 또는 null
 */
export const getUser = async (): Promise<User | null> => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('사용자 정보를 가져오는 중 오류 발생:', error);
      return null;
    }
    return data.user as User;
  } catch (e) {
    console.error('사용자 정보 요청 중 예기치 않은 오류:', e);
    return null;
  }
};
