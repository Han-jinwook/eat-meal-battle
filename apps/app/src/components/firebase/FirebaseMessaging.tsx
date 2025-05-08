'use client';

import { useEffect, useState } from 'react';
import { fetchToken, onMessageListener } from '@/lib/firebase/firebaseConfig';
import { useSupabase } from '@/lib/supabase/supabase-provider';
import { toast } from 'react-hot-toast';

/**
 * Firebase Cloud Messaging 관련 기능을 처리하는 컴포넌트
 * - 권한 요청 및 FCM 토큰 획득
 * - 토큰을 사용자 프로필에 저장
 * - 포그라운드 알림 처리
 */
const FirebaseMessaging = () => {
  const { supabase, session } = useSupabase();
  const [isTokenFound, setIsTokenFound] = useState(false);
  
  // FCM 토큰 등록
  useEffect(() => {
    if (!session?.user) return;
    
    const registerToken = async () => {
      try {
        const token = await fetchToken(setTokenToDatabase);
        setIsTokenFound(!!token);
      } catch (error) {
        console.error('FCM 토큰 등록 오류:', error);
      }
    };
    
    registerToken();
  }, [session]);
  
  // 사용자 프로필에 FCM 토큰 저장
  const setTokenToDatabase = async (token: string) => {
    if (!session?.user?.id || !token) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('user_id', session.user.id);
      
      if (error) {
        console.error('FCM 토큰 데이터베이스 저장 오류:', error);
      } else {
        console.log('FCM 토큰이 성공적으로 저장되었습니다.');
      }
    } catch (error) {
      console.error('FCM 토큰 저장 중 예외 발생:', error);
    }
  };
  
  // 포그라운드 메시지 수신 처리
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const unsubscribe = onMessageListener().then((payload: any) => {
        if (payload?.notification) {
          // 토스트 알림 표시
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
              max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto 
              flex flex-col ring-1 ring-black ring-opacity-5 p-4`}
            >
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {payload.notification.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {payload.notification.body}
                  </p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 flex-shrink-0 bg-white rounded-md text-gray-400 
                  hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">닫기</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              {payload.data?.url && (
                <button 
                  onClick={() => {
                    window.location.href = payload.data.url;
                    toast.dismiss(t.id);
                  }}
                  className="mt-2 w-full bg-indigo-600 text-white py-1 px-2 rounded-md 
                  text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 
                  focus:ring-offset-2 focus:ring-indigo-500"
                >
                  바로가기
                </button>
              )}
            </div>
          ), { 
            duration: 6000, 
            position: 'top-right' 
          });
        }
      });
      
      return () => {
        unsubscribe.catch(err => console.error('알림 리스너 해제 오류:', err));
      };
    }
  }, []);
  
  // 알림 권한 상태를 UI에 표시하지 않음
  return null;
};

export default FirebaseMessaging;
