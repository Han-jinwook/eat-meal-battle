"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import QuizDropdown from '@/components/QuizDropdown';

// 학교 유형별 캐릭터 이미지 경로 반환 함수
const getSchoolCharacterImage = (schoolType: string): string => {
  if (schoolType?.includes('초등학교') || schoolType?.includes('초')) {
    return '/images/characters/elementary.png';
  }
  if (schoolType?.includes('중학교') || schoolType?.includes('중')) {
    return '/images/characters/middle.png';
  }
  if (schoolType?.includes('고등학교') || schoolType?.includes('고')) {
    return '/images/characters/high.png';
  }
  // 기본값: 초등학교 캐릭터
  return '/images/characters/elementary.png';
};

interface SchoolInfoHeaderProps {
  userSchool?: {
    user_id?: string;
    school_name?: string;
    school_type?: string;
    grade?: number | string;
    class?: number | string;
    nickname?: string;
  } | null;
  isViewingMode: boolean;
  viewingUserInfo?: {
    nickname: string;
    school_name: string;
    grade?: number;
    class?: number;
  } | null;
}

export default function SchoolInfoHeader({
  userSchool,
  isViewingMode,
  viewingUserInfo
}: SchoolInfoHeaderProps) {
  const router = useRouter();

  // 학교 정보가 없으면 렌더링하지 않음
  if (!userSchool && !isViewingMode) {
    return <div className="mb-6"></div>;
  }

  return (
    <div className={`shadow-sm rounded p-2 mb-3 border-l-2 flex items-center justify-between ${
      isViewingMode 
        ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-500' 
        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500'
    }`}>
      {/* 왼쪽: 학교 정보 */}
      <div className="flex items-center">
        {!isViewingMode && userSchool ? (
          <>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
              {userSchool.school_name || '학교 정보 없음'}
            </span>
            {(userSchool.grade || userSchool.class) && (
              <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                {userSchool.grade ? `${userSchool.grade}학년` : ''}
                {userSchool.class ? ` ${userSchool.class}반` : ''}
              </span>
            )}
            
            {/* 초중고 캐릭터 - 반 끝에서 1cm 떨어진 곳에 */}
            {userSchool?.school_type && (
              <img 
                src={getSchoolCharacterImage(userSchool.school_type)}
                alt="학교 캐릭터"
                className="ml-3 w-8 h-8 md:w-10 md:h-10 drop-shadow-sm"
              />
            )}
          </>
        ) : null}
      </div>
      
      {/* 오른쪽: 관심퀴즈 드롭다운 또는 관람 종료 버튼 */}
      {isViewingMode && viewingUserInfo ? (
        <button
          onClick={() => {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('viewing');
            router.replace(newUrl.pathname + newUrl.search);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 border border-purple-200 rounded-lg hover:bg-white transition-colors shadow-sm"
        >
          <span className="text-purple-600">👀</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-base font-semibold">
            {viewingUserInfo.nickname}님의 퀴즈 관람 종료
          </span>
          <span className="ml-1 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
            {viewingUserInfo.school_name}
            {viewingUserInfo.grade && ` ${viewingUserInfo.grade}학년`}
            {viewingUserInfo.class && ` ${viewingUserInfo.class}반`}
          </span>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : userSchool ? (
        <QuizDropdown userId={userSchool.user_id || ''} />
      ) : null}
    </div>
  );
}
