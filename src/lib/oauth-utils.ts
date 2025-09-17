/**
 * OAuth 연결 안정성을 위한 유틸리티 함수들
 * 로그인 상태 및 세션 관리 강화
 */
import { clearAllAuthStorage, getBrowserInfo } from './session-utils';

/**
 * OAuth 상태 데이터를 압축하고 인코딩하는 함수
 * 더 안전하게 state 파라미터를 전달
 */
export const encodeOAuthState = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    // base64 인코딩
    return btoa(encodeURIComponent(jsonString));
  } catch (error) {
    console.error('OAuth 상태 인코딩 오류:', error);
    // 오류 발생 시 빈 객체 인코딩하여 반환
    return btoa('{}');
  }
};

/**
 * OAuth state 파라미터를 디코딩하는 함수
 */
export const decodeOAuthState = (stateParam: string): any => {
  try {
    const jsonString = decodeURIComponent(atob(stateParam));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('OAuth 상태 디코딩 오류:', error);
    return {};
  }
};

/**
 * OAuth 공급자별 연결 최적화를 위한 설정 생성
 * 브라우저 환경과 상황에 맞는 최적의 설정 제공
 */
export const getOptimizedOAuthConfig = (provider: string, customOptions: any = {}): any => {
  const browserInfo = getBrowserInfo();
  const isIOSSafari = browserInfo.isIOSSafari;
  
  // 기본 설정 초기화
  const baseConfig: any = {
    queryParams: {
      // 항상 동의 화면 표시하여 토큰 최신 상태 유지
      prompt: 'consent',
      // OAuth 토큰 갱신을 위한 오프라인 액세스 설정
      access_type: 'offline',
    }
  };
  
  // state 파라미터가 있으면 추가
  if (customOptions.stateData && Object.keys(customOptions.stateData).length > 0) {
    baseConfig.queryParams.state = encodeOAuthState(customOptions.stateData);
  }
  
  // redirectTo 파라미터가 있으면 추가
  if (customOptions.redirectTo) {
    baseConfig.redirectTo = customOptions.redirectTo;
  }
  
  // 공급자별 최적화 설정
  switch (provider.toLowerCase()) {
    case 'google':
      baseConfig.queryParams.scope = 'openid email profile https://www.googleapis.com/auth/user.birthday.read';
      break;
      
    case 'kakao':
      baseConfig.queryParams.scope = 'profile_nickname,profile_image,account_email,birthyear,birthday';
      break;
      
    // 향후 다른 공급자 추가 가능
  }
  
  // iOS Safari에서 연결 안정성 향상을 위한 추가 설정
  if (isIOSSafari) {
    // iOS Safari에서는 쿠키 문제가 많으므로 향상된 설정
    baseConfig.options = {
      ...baseConfig.options,
      pkce: true,
      skipBrowserRedirect: false
    };
  }
  
  // 사용자 지정 queryParams가 있으면 병합
  if (customOptions.queryParams) {
    baseConfig.queryParams = {
      ...baseConfig.queryParams,
      ...customOptions.queryParams
    };
  }
  
  return baseConfig;
};

/**
 * 동일한 공급자에 대해 로그인 요청을 한 번만 처리하기 위한 잠금 메커니즘
 * 중복 로그인 시도 방지
 */
const oauthLocks: Record<string, boolean> = {
  google: false,
  kakao: false
};

/**
 * OAuth 공급자별 잠금 상태 확인
 */
export const isOAuthLocked = (provider: string): boolean => {
  return !!oauthLocks[provider.toLowerCase()];
};

/**
 * OAuth 공급자 잠금 설정
 */
export const lockOAuthProvider = (provider: string): void => {
  oauthLocks[provider.toLowerCase()] = true;
};

/**
 * OAuth 공급자 잠금 해제
 */
export const unlockOAuthProvider = (provider: string): void => {
  oauthLocks[provider.toLowerCase()] = false;
};

/**
 * 로그인 시도 전에 세션을 안정적으로 초기화하는 함수
 */
export const prepareForOAuthLogin = async (provider: string): Promise<boolean> => {
  // 이미 잠겨있으면 중복 로그인 시도로 판단하고 중단
  if (isOAuthLocked(provider)) {
    console.warn(`🔒 ${provider} 로그인이 이미 진행 중입니다. 중복 시도를 방지합니다.`);
    return false;
  }
  
  try {
    // 공급자 잠금 설정
    lockOAuthProvider(provider);
    
    // 브라우저 환경 확인
    const browserInfo = getBrowserInfo();
    console.log('📱 로그인 준비 - 장치 정보:', {
      isMobile: browserInfo.isMobile,
      isIOS: browserInfo.isIOS,
      isSafari: browserInfo.isSafari,
      isIOSSafari: browserInfo.isIOSSafari
    });
    
    // 세션 초기화
    console.log(`🧹 ${provider} 로그인 준비 - 세션 초기화 중...`);
    await clearAllAuthStorage();
    
    // iOS Safari는 특별 처리 - 쿠키 문제가 많음
    if (browserInfo.isIOSSafari) {
      console.log('🍏 iOS Safari 감지 - 추가 대기 시간 적용...');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`✅ ${provider} 로그인 준비 완료`);
    return true;
  } catch (error) {
    console.error(`❌ ${provider} 로그인 준비 중 오류:`, error);
    // 오류가 발생해도 잠금은 해제
    unlockOAuthProvider(provider);
    return false;
  }
};

/**
 * OAuth 로그인 완료 처리 (성공 또는 실패)
 */
export const finalizeOAuthLogin = (provider: string, success: boolean): void => {
  // 공급자 잠금 해제
  unlockOAuthProvider(provider);
  
  // 결과 로깅
  if (success) {
    console.log(`✅ ${provider} 로그인 요청 성공적으로 완료됨`);
  } else {
    console.warn(`⚠️ ${provider} 로그인 요청 실패`);
  }
};

/**
 * 세션 유효성 검사 및 복구 시도 함수
 * 만료된 세션이나 문제가 있는 세션 감지 및 복구
 */
export const validateAndFixSession = async (supabaseClient: any): Promise<boolean> => {
  try {
    console.log('🔍 세션 유효성 검사 중...');
    
    // 현재 세션 확인
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      console.log('⚠️ 세션이 없음 - 로그인 필요');
      return false;
    }
    
    // 토큰 만료 시간 확인
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    const timeLeft = expiresAt - now;
    
    console.log(`🔍 세션 만료까지 ${timeLeft}초 남음`);
    
    // 세션이 곧 만료되거나 이미 만료된 경우 갱신 시도
    if (timeLeft < 300 || timeLeft <= 0) {
      console.log('⚠️ 세션이 만료되었거나 곧 만료됩니다. 갱신 시도...');
      
      // 리프레시 토큰이 있는지 확인
      if (session.refresh_token) {
        const { data, error } = await supabaseClient.auth.refreshSession();
        
        if (error) {
          console.error('❌ 세션 갱신 실패:', error);
          return false;
        }
        
        if (data.session) {
          console.log('✅ 세션 갱신 성공');
          return true;
        }
      } else {
        console.warn('⚠️ 리프레시 토큰이 없어 세션을 갱신할 수 없음');
        return false;
      }
    }
    
    // 세션이 유효한 경우
    console.log('✅ 세션이 유효함');
    return true;
  } catch (error) {
    console.error('❌ 세션 검증 중 오류:', error);
    return false;
  }
};
