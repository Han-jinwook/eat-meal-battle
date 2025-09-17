/**
 * 세션 관리 및 쿠키 관련 유틸리티 함수들
 * 로그인 및 인증 관련 세션 처리를 위한 도구들
 */

/**
 * 브라우저 환경 정보를 체크하고 반환하는 함수
 */
export const getBrowserInfo = () => {
  if (typeof window === 'undefined') {
    return { isServer: true };
  }

  const userAgent = navigator.userAgent;
  
  return {
    isServer: false,
    isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
    isIOSSafari: /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
    isChrome: /Chrome/.test(userAgent),
    isFirefox: /Firefox/.test(userAgent),
    isEdge: /Edg/.test(userAgent),
    width: window.innerWidth,
    height: window.innerHeight,
    cookiesEnabled: navigator.cookieEnabled,
    userAgent
  };
};

/**
 * 쿠키를 더 강력하게 삭제하는 함수
 * 여러 경로 및 도메인 옵션으로 시도
 */
export const clearAuthCookies = () => {
  if (typeof document === 'undefined') return;
  
  console.log('🍪 인증 관련 쿠키 삭제 시작...');
  
  try {
    // 모든 쿠키 가져오기
    const cookieNames = document.cookie.split(';')
      .map(c => c.trim().split('=')[0])
      .filter(name => name); // 빈 값 제거
      
    console.log(`🍪 삭제할 쿠키 ${cookieNames.length}개 발견`);
    
    // 인증 관련 쿠키 필터링 (모든 쿠키를 삭제할 수도 있음)
    const authCookies = cookieNames.filter(name => 
      name.includes('sb-') || 
      name.includes('supabase') ||
      name.includes('auth') ||
      name.includes('session') ||
      name.includes('token') ||
      name.includes('pkce')
    );
    
    if (authCookies.length > 0) {
      console.log(`🍪 인증 관련 쿠키 ${authCookies.length}개 발견:`, authCookies);
    }
    
    // 모든 쿠키 (또는 인증 관련 쿠키만) 다양한 방식으로 삭제 시도
    const cookiesToDelete = authCookies.length > 0 ? authCookies : cookieNames;
    
    cookiesToDelete.forEach(name => {
      if (!name) return;
      
      // 1. 기본 삭제
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      
      // 2. 다양한 경로에 대해 시도
      const paths = ['/', '/auth', '/login', '', '/api'];
      paths.forEach(path => {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
      });
      
      // 3. 도메인 옵션 추가
      const domain = window.location.hostname;
      if (domain) {
        // 현재 도메인에 대해 삭제
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
        
        // 서브도메인에 대해 삭제
        if (domain.indexOf('.') !== -1) {
          const rootDomain = domain.split('.').slice(-2).join('.');
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
        }
      }
    });
    
    console.log('✅ 쿠키 삭제 시도 완료');
    
    // 삭제 후 남은 쿠키 확인
    const remainingCookies = document.cookie.split(';')
      .map(c => c.trim().split('=')[0])
      .filter(name => name);
      
    if (remainingCookies.length > 0) {
      console.log(`⚠️ 아직 ${remainingCookies.length}개 쿠키 남아있음:`, remainingCookies);
    } else {
      console.log('✅ 모든 쿠키 삭제됨');
    }
  } catch (error) {
    console.error('❌ 쿠키 삭제 중 오류:', error);
  }
};

/**
 * 로컬 스토리지에서 인증 관련 데이터 삭제
 */
export const clearAuthLocalStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  
  try {
    console.log('🗑️ 로컬 스토리지 인증 데이터 삭제 시작...');
    
    // 삭제할 키들 찾기
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') || 
        key.includes('token') || 
        key.includes('session')
      )) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`🗑️ 로컬 스토리지에서 ${keysToRemove.length}개 항목 삭제 중:`, keysToRemove);
    
    // 찾은 키들 삭제
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`⚠️ 로컬 스토리지 항목 삭제 실패 (${key}):`, e);
      }
    });
    
    console.log('✅ 로컬 스토리지 인증 데이터 삭제 완료');
  } catch (error) {
    console.error('❌ 로컬 스토리지 삭제 중 오류:', error);
  }
};

/**
 * 세션 스토리지 정리 함수
 */
export const clearSessionStorage = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  
  try {
    console.log('🗑️ 세션 스토리지 정리 중...');
    
    // 방법 1: 전체 삭제
    sessionStorage.clear();
    
    // 방법 2: 인증 관련 항목만 삭제 (필요한 경우)
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') || 
        key.includes('token') || 
        key.includes('session')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`⚠️ 세션 스토리지 항목 삭제 실패 (${key}):`, e);
      }
    });
    
    console.log('✅ 세션 스토리지 정리 완료');
  } catch (error) {
    console.error('❌ 세션 스토리지 정리 중 오류:', error);
  }
};

/**
 * 모든 인증 관련 저장소 정리
 * 쿠키, 로컬 스토리지, 세션 스토리지 모두 처리
 */
export const clearAllAuthStorage = async () => {
  console.log('🧹 모든 인증 저장소 정리 시작...');
  
  // 각 저장소 정리
  clearAuthCookies();
  clearAuthLocalStorage();
  clearSessionStorage();
  
  // iOS Safari를 위한 추가 대기 시간
  const browserInfo = getBrowserInfo();
  if (browserInfo.isIOSSafari) {
    console.log('🍏 iOS Safari 감지됨, 추가 대기 시간 적용...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ 모든 인증 저장소 정리 완료');
};

/**
 * 브라우저 캐시를 강제로 새로 고침하는 함수
 */
export const forceRefreshCache = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // 캐시 헤더 수정하여 리로드 (최신 브라우저 API에 맞게 인자 제거)
    window.location.reload();
    
    // 매개변수 사용하는 이전 방식:
    // // hard reload를 하고 싶을 때 사용하는 대체 방법
    // if ('caches' in window) {
    //   caches.keys().then(cacheNames => {
    //     cacheNames.forEach(cacheName => {
    //       caches.delete(cacheName);
    //     });
    //   });
    // }
    // window.location.reload();
    
    // 2. 또는 URL에 타임스태프 추가하여 새로고침
    // const cacheBuster = `?cache=${Date.now()}`;
    // window.location.href = window.location.pathname + cacheBuster;
  } catch (error) {
    console.error('❌ 캐시 새로고침 실패:', error);
  }
};

/**
 * 인증 세션 문제 발생 시 자동 복구 시도 함수
 * 로그인 상태에 문제가 있을 때 호출
 */
export const attemptSessionRecovery = async (callback?: () => void) => {
  console.log('🔄 인증 세션 복구 시도 중...');
  
  try {
    // 1. 모든 인증 저장소 정리
    await clearAllAuthStorage();
    
    // 2. 잠시 대기 (브라우저별 다르게 적용)
    const browserInfo = getBrowserInfo();
    const waitTime = browserInfo.isIOSSafari ? 2000 : 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // 3. 콜백 실행 (일반적으로 로그인 재시도 함수)
    if (callback && typeof callback === 'function') {
      callback();
    } else {
      // 콜백이 없으면 페이지 새로고침
      forceRefreshCache();
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ 세션 복구 실패:', error);
    return { success: false, error };
  }
};
