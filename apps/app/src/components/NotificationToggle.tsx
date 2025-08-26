'use client';

import { useState, useEffect } from 'react';
import { fetchToken } from '@/lib/firebase/firebaseConfig';
import { createClient } from '@/lib/supabase';

interface NotificationToggleProps {
  userId: string;
}

export default function NotificationToggle({ userId }: NotificationToggleProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const supabase = createClient();

  // 초기 알림 권한 상태 확인
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
      setNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

  // iOS Safari 감지
  const isIOSSafari = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
           !(window as any).MSStream &&
           !navigator.userAgent.includes('CriOS'); // Chrome이 아닌 경우
  };

  // FCM 토큰 저장
  const saveFCMToken = async (token: string) => {
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
            platform: 'web',
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('FCM 토큰 저장 실패:', error);
        } else {
          console.log('FCM 토큰 저장 성공');
        }
      }
    } catch (error) {
      console.error('FCM 토큰 저장 중 오류:', error);
    }
  };

  // 토글 핸들러
  const handleToggle = async () => {
    if (isLoading) return;

    // iOS Safari인 경우 크롬 안내
    if (isIOSSafari()) {
      const shouldInstallChrome = confirm(
        '🍽️ 급식 배틀 푸시 알림\n\n' +
        '아이폰에선 Chrome에서 푸시알림이 가능합니다.\n\n' +
        '크롬에서 앱 열기'
      );

      if (shouldInstallChrome) {
        // 현재 URL 저장
        localStorage.setItem('return-url-after-chrome', window.location.href);
        // App Store로 이동
        window.location.href = 'https://apps.apple.com/kr/app/google-chrome/id535886823';
      }
      return;
    }

    // 알림이 이미 허용된 경우 토글
    if (notificationStatus === 'granted') {
      setNotificationEnabled(!notificationEnabled);
      return;
    }

    // 알림 권한 요청
    setIsLoading(true);
    try {
      if (!('Notification' in window)) {
        alert('이 브라우저는 알림을 지원하지 않습니다.');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);

      if (permission === 'granted') {
        setNotificationEnabled(true);
        
        // FCM 토큰 가져오기 및 저장
        try {
          const token = await fetchToken((token: string) => {
            saveFCMToken(token);
          });
          
          if (token) {
            await saveFCMToken(token);
          }
        } catch (error) {
          console.error('FCM 토큰 처리 실패:', error);
        }
      } else {
        setNotificationEnabled(false);
        if (permission === 'denied') {
          alert('알림이 차단되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
        }
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      alert('알림 설정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-6 border-t border-b py-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold mb-1">푸시 알림</h3>
          <p className="text-sm text-gray-600">
            새로운 퀴즈, 급식 사진, 배틀 소식을 받아보세요
          </p>
          {isIOSSafari() && (
            <p className="text-xs text-orange-600 mt-1">
              iPhone에서는 Chrome 브라우저가 필요합니다
            </p>
          )}
        </div>
        
        <div className="flex items-center">
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              notificationEnabled && notificationStatus === 'granted'
                ? 'bg-blue-600' 
                : 'bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notificationEnabled && notificationStatus === 'granted' 
                  ? 'translate-x-6' 
                  : 'translate-x-1'
              }`}
            />
          </button>
          
          {isLoading && (
            <div className="ml-2">
              <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {notificationStatus === 'denied' && !isIOSSafari() && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            알림이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
