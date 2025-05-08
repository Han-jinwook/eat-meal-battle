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

    // App Check 초기화 - 환경 변수가 있을 때만 실행
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (recaptchaSiteKey) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true
        });
        console.log('Firebase App Check가 초기화되었습니다.');
      } catch (error) {
        console.error('Firebase App Check 초기화 오류:', error);
      }
    } else {
      console.warn('reCAPTCHA 사이트 키가 없어 App Check가 초기화되지 않았습니다. 환경 변수를 확인해주세요.');
    }
  }
  
  return app;
};

// 메시징 인스턴스 가져오기
export const fetchToken = async (setTokenFound: (token: string) => void) => {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const firebaseApp = initializeFirebase();
      const messaging = getMessaging(firebaseApp);
      
      // 권한 요청
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('알림 권한이 허용되었습니다.');
        
        // Firebase의 VAPID 키 (Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징에서 확인)
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        
        // 토큰 가져오기
        const currentToken = await getToken(messaging, { vapidKey });
        
        if (currentToken) {
          // 토큰을 서버에 저장하거나 처리
          console.log('FCM 토큰:', currentToken);
          setTokenFound(currentToken);
          return currentToken;
        } else {
          console.log('FCM 토큰을 받을 수 없습니다. 알림 권한을 확인하세요.');
        }
      } else {
        console.log('알림 권한이 거부되었습니다.');
      }
    }
  } catch (error) {
    console.error('FCM 토큰 검색 중 오류 발생:', error);
  }
  
  return null;
};

// 포그라운드 메시지 수신 처리
export const onMessageListener = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined') {
      const firebaseApp = initializeFirebase();
      const messaging = getMessaging(firebaseApp);
      
      onMessage(messaging, (payload) => {
        console.log('메시지 수신:', payload);
        resolve(payload);
      });
    }
  });
};
