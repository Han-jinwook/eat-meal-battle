"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface BirthConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export default function BirthConsentModal({ isOpen, onClose, onSuccess, userId }: BirthConsentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProvider, setUserProvider] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUserProvider = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.app_metadata?.provider) {
          setUserProvider(user.app_metadata.provider);
        }
      } catch (error) {
        console.error('사용자 제공자 정보 조회 오류:', error);
      }
    };

    if (isOpen) {
      getUserProvider();
    }
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  const handleOAuthReConsent = async () => {
    try {
      setLoading(true);
      setError(null);

      let provider: 'google' | 'kakao';
      let options: any = {
        redirectTo: `${window.location.origin}/auth/callback`,
      };

      if (userProvider === 'google') {
        provider = 'google';
        options.queryParams = {
          access_type: 'offline',
          prompt: 'consent', // 강제로 동의 화면 표시
          scope: 'openid email profile https://www.googleapis.com/auth/user.birthday.read'
        };
      } else if (userProvider === 'kakao') {
        provider = 'kakao';
        options.queryParams = {
          prompt: 'consent', // 강제로 동의 화면 표시
          scope: 'profile_nickname,profile_image,account_email,birthyear'
        };
      } else {
        setError('지원하지 않는 로그인 제공자입니다.');
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options
      });

      if (error) {
        throw error;
      }

      // OAuth 리다이렉트가 시작되므로 여기서는 추가 처리 불필요

    } catch (error: any) {
      setError(error.message || '추가 동의 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            학교 설정을 위한 추가 동의
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>



        <div className="mb-6">
          <div className="text-center mb-4">
            {userProvider === 'google' && (
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-lg font-medium">Google 추가 동의</span>
              </div>
            )}
            {userProvider === 'kakao' && (
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 mr-2 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">K</span>
                </div>
                <span className="text-lg font-medium">카카오 추가 동의</span>
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center">
            학교 설정을 위해 {userProvider === 'google' ? 'Google' : '카카오'}에서 생년 정보 제공에 추가 동의가 필요합니다.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">안전한 정보 처리</p>
                <p>• 생년 정보는 학생 인증 목적으로만 사용됩니다</p>
                <p>• 제공된 정보는 안전하게 암호화되어 보관됩니다</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            취소
          </button>
          <button
            onClick={handleOAuthReConsent}
            disabled={loading || !userProvider}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                처리 중...
              </>
            ) : (
              `${userProvider === 'google' ? 'Google' : '카카오'} 동의하기`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
