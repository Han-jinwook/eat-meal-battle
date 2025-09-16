// Firebase 구성 파일
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Firebase 구성 정보
// Firebase 콘솔에서 가져온 설정으로 교체 필요
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 앱 초기화 (중복 초기화 방지)
export const initializeFirebase = () => {
  // 기존 앱이 없으면 새로 초기화, 있으면 기존 앱 반환
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  
  // 브라우저 환경에서만 App Check 초기화
  if (typeof window !== 'undefined') {
    // 개발 환경에서는 디버그 토큰 활성화
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    // 환경변수 디버깅 로그 (개발 환경에서만 표시)
    if (process.env.NODE_ENV === 'development') {
      console.log('Firebase 환경변수 확인:', {
        recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? '설정됨' : '없음',
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '설정됨' : '없음',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '설정됨' : '없음'
      });
    }
    
    // App Check 초기화 - 환경 변수가 있을 때만 실행
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (recaptchaSiteKey) {
      // 약간의 지연을 두고 App Check 초기화 (reCAPTCHA 스크립트 로드 시간 확보)
      setTimeout(() => {
        try {
          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true
          });
          console.log('Firebase App Check가 초기화되었습니다.');
        } catch (error) {
          console.error('Firebase App Check 초기화 오류:', error);
        }
      }, 1000); // 1초 지연
    } else if (process.env.NODE_ENV === 'development') {
      // 개발 환경에서만 경고 표시
      console.warn('reCAPTCHA 사이트 키가 없어 App Check가 초기화되지 않았습니다. 환경 변수를 확인해주세요.');
    }
  }
  
  return app;
};

// FCM 토큰 기능 완전 비활성화
export const fetchToken = async (setTokenFound: (token: string) => void) => {
  // 푸시알림 기능 완전 제거
  return null;
};

// 포그라운드 메시지 수신 처리 - 비활성화
export const onMessageListener = () => {
  return new Promise((resolve) => {
    // 푸시알림 기능 완전 제거
    resolve(null);
  });
};
