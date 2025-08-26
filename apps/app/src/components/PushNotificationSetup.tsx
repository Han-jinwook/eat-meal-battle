'use client';

import { useState, useEffect } from 'react';
import { fetchToken, onMessageListener } from '@/lib/firebase/firebaseConfig';
import { createClient } from '@/lib/supabase';
import useUserSchool from '@/hooks/useUserSchool';

interface PushNotificationSetupProps {
  onTokenReceived?: (token: string) => void;
}

export default function PushNotificationSetup({ onTokenReceived }: PushNotificationSetupProps) {
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const { userSchool, loading: userLoading } = useUserSchool();
  const supabase = createClient();

  // 초기 알림 권한 상태 확인
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
      
      // 이미 권한이 있다면 토큰 가져오기 시도
      if (Notification.permission === 'granted') {
        handleGetToken();
      }
    }
  }, []);

  // 포그라운드 메시지 리스너 설정
  useEffect(() => {
    if (fcmToken) {
      const unsubscribe = onMessageListener().then((payload: any) => {
        console.log('포그라운드 메시지 수신:', payload);
        // 여기서 인앱 알림 표시 로직 추가 가능
        if (payload.notification) {
          // 브라우저 알림 표시
          new Notification(payload.notification.title || '새 알림', {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png'
          });
        }
      });
    }
  }, [fcmToken]);

  // FCM 토큰 가져오기 및 서버에 저장
  const handleGetToken = async () => {
    setIsLoading(true);
    try {
      const token = await fetchToken(setFcmToken);
      if (token && userSchool?.user_id) {
        // 토큰을 Supabase에 저장
        await saveFCMToken(token, userSchool.user_id);
        setNotificationStatus('granted');
        onTokenReceived?.(token);
      }
    } catch (error) {
      console.error('FCM 토큰 가져오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // FCM 토큰을 Supabase에 저장
  const saveFCMToken = async (token: string, userId: string) => {
    try {
      // 기존 토큰 확인
      const { data: existingToken } = await supabase
        .from('user_fcm_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('token', token)
        .single();

      if (!existingToken) {
        // 새 토큰 저장
        const { error } = await supabase
          .from('user_fcm_tokens')
          .insert({
            user_id: userId,
            token: token,
            device_type: getMobileOperatingSystem(),
            is_active: true,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('FCM 토큰 저장 실패:', error);
        } else {
          console.log('FCM 토큰이 성공적으로 저장되었습니다.');
        }
      }
    } catch (error) {
      console.error('FCM 토큰 저장 중 오류:', error);
    }
  };

  // 디바이스 타입 감지
  const getMobileOperatingSystem = () => {
    const userAgent = navigator.userAgent || navigator.vendor;
    
    if (/android/i.test(userAgent)) {
      return 'android';
    }
    
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return 'ios';
    }
    
    return 'web';
  };

  // 알림 권한 요청
  const requestNotificationPermission = async () => {
    // iOS Safari 체크
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (!('Notification' in window)) {
      if (isIOSSafari) {
        alert('iOS Safari에서는 푸시 알림이 제한됩니다. Chrome 앱을 사용해주세요.');
      } else {
        alert('이 브라우저는 알림을 지원하지 않습니다.');
      }
      return;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === 'granted') {
        await handleGetToken();
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 로딩 중이거나 사용자 정보가 없으면 표시하지 않음
  if (userLoading || !userSchool) {
    return null;
  }

  // 이미 권한이 허용되었고 토큰이 있으면 간단한 상태만 표시
  if (notificationStatus === 'granted' && fcmToken) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800">
              푸시 알림이 활성화되었습니다! 🔔
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 권한이 거부된 경우
  if (notificationStatus === 'denied') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              알림 권한이 차단되었습니다
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>브라우저 설정에서 알림을 허용해주세요:</p>
              <ol className="mt-1 list-decimal list-inside">
                <li>주소창 왼쪽의 자물쇠 아이콘 클릭</li>
                <li>"알림" 설정을 "허용"으로 변경</li>
                <li>페이지 새로고침</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 설정 UI 표시 여부 토글
  if (!showSetup) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">
                푸시 알림을 받아보세요! 📱
              </p>
              <p className="text-xs text-blue-600 mt-1">
                급식 평가, 퀴즈, 배틀 알림을 실시간으로 받을 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            설정하기
          </button>
        </div>
      </div>
    );
  }

  // 알림 권한 요청 UI
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002-2z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          푸시 알림 설정
        </h3>
        
        <p className="text-sm text-gray-600 mb-4">
          중요한 알림을 놓치지 마세요! 다음과 같은 알림을 받을 수 있습니다:
        </p>
        
        {/* iOS Safari 경고 메시지 */}
        {/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-amber-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  iOS Safari 사용자 안내
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Safari에서는 푸시 알림이 제한됩니다. Chrome 앱 사용을 권장합니다.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="text-left bg-gray-50 rounded-lg p-3 mb-4">
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• 🍽️ 새로운 급식 메뉴 등록</li>
            <li>• 🏆 퀴즈 챔피언 결과 발표</li>
            <li>• ⚔️ 배틀 초대 및 결과</li>
            <li>• 📢 중요한 공지사항</li>
          </ul>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowSetup(false)}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 transition-colors"
          >
            나중에
          </button>
          <button
            onClick={requestNotificationPermission}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '설정 중...' : '알림 허용하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
