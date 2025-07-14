"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    const getUser = async () => {
      try {
        setLoading(true);
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (user) {
          setUser(user);
          setDbStatus('loading');
          const { data, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          // 디버깅: DB에서 가져온 사용자 데이터 로그
          console.log('=== ProfileModal 사용자 데이터 디버깅 ===');
          console.log('사용자 ID:', user.id);
          console.log('사용자 이메일:', user.email);
          console.log('DB 쿼리 에러:', profileError);
          console.log('DB에서 가져온 데이터:', data);
          if (data) {
            console.log('닉네임:', data.nickname);
            console.log('프로필 이미지:', data.profile_image);
            console.log('생성일:', data.created_at);
          }
          console.log('=======================================');
          
          if (profileError) {
            setDbStatus('error');
            if (profileError.code !== 'PGRST116') {
              setError(`DB 조회 에러: ${profileError.message}`);
            }
          } else if (data) {
            setUserProfile(data);
            setDbStatus('success');
            const { data: schoolData, error: schoolError } = await supabase
              .from('school_infos')
              .select('*')
              .eq('user_id', user.id)
              .single();
            if (!schoolError && schoolData) {
              setSchoolInfo(schoolData);
            }
          } else {
            setDbStatus('error');
            setError('사용자 데이터를 찾을 수 없습니다.');
          }
        } else {
          router.push('/login');
        }
      } catch (error: any) {
        setError(error.message || '사용자 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    getUser();
  }, [isOpen, supabase, router]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      onClose();
      router.push('/');
    } catch (error: any) {
      setError(error.message || '로그아웃 중 오류가 발생했습니다');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('정말로 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 계정 데이터가 영구적으로 삭제됩니다.')) {
      return;
    }
    try {
      setDeletingAccount(true);
      setError(null);
      
      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id })
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || '회원 탈퇴 중 오류 발생');
      }
      await supabase.auth.signOut();
      onClose();
      router.push('/');
    } catch (error: any) {
      setError(error.message || '회원 탈퇴 중 오류가 발생했습니다');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-[95vw] max-w-md mx-auto rounded-2xl bg-white p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto isolation-isolate">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold mb-4">프로필</h2>
        {loading ? (
          <div className="py-8 text-center text-gray-500">로딩 중...</div>
        ) : error ? (
          <div className="py-4 text-red-600 text-center">{error}</div>
        ) : userProfile ? (
          <div className="space-y-6">
            {/* 사용자 정보 */}
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {userProfile.profile_image ? (
                  <img src={userProfile.profile_image} alt="프로필 이미지" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl text-gray-500 font-bold">
                    {userProfile.nickname ? userProfile.nickname.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <div>
                <div className="font-semibold text-lg">{userProfile.nickname || '닉네임 없음'}</div>
                <div className="text-sm text-gray-500">{user?.email}</div>
              </div>
            </div>

            {/* 학교 정보 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">학교 정보</span>
                <Link
                  href="/school-search"
                  className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                  onClick={onClose}
                >
                  {schoolInfo ? '학교정보 수정' : '학교정보 설정'}
                </Link>
              </div>
              {schoolInfo ? (
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div><span className="text-gray-500">학교명:</span> {schoolInfo.school_name}</div>
                  <div><span className="text-gray-500">유형:</span> {schoolInfo.school_type}</div>
                  <div><span className="text-gray-500">지역:</span> {schoolInfo.region}</div>
                  <div><span className="text-gray-500">주소:</span> {schoolInfo.address}</div>
                  <div><span className="text-gray-500">학년:</span> {schoolInfo.grade}학년</div>
                  <div><span className="text-gray-500">반:</span> {schoolInfo.class_number}반</div>
                </div>
              ) : (
                <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">학교 정보가 아직 없습니다.</div>
              )}
            </div>

            {/* 계정 관리 */}
            <div className="space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                로그아웃
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">데이터베이스에 사용자 정보가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
