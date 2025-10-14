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
  onOpenAllQuizModal?: () => void;
}

export default function SchoolInfoHeader({
  userSchool,
  isViewingMode,
  viewingUserInfo,
  onOpenAllQuizModal
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-sm sm:text-base font-semibold truncate max-w-[140px] sm:max-w-none">
              <span className="hidden sm:inline">{userSchool.school_name || '학교 정보 없음'}</span>
              <span className="sm:hidden">
                {(userSchool.school_name || '학교 정보 없음').replace(/고등학교$/, '고').replace(/중학교$/, '중').replace(/초등학교$/, '초')}
              </span>
            </span>
            {(userSchool.grade || userSchool.class) && (
              <span className="ml-1 sm:ml-2 text-gray-600 text-[10px] sm:text-xs bg-white px-1 sm:px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {userSchool.grade ? `${userSchool.grade}학년` : ''}
                {userSchool.class ? ` ${userSchool.class}반` : ''}
              </span>
            )}
            
            {/* 초중고 캐릭터 - 반 끝에서 1cm 떨어진 곳에 */}
            {userSchool?.school_type && (
              <img 
                src={getSchoolCharacterImage(userSchool.school_type)}
                alt="학교 캐릭터"
                className="ml-2 sm:ml-3 w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 drop-shadow-sm flex-shrink-0"
              />
            )}
          </> 
        ) : null}
      </div>
      
      {/* 오른쪽: 관심퀴즈 드롭다운과 관람 종료 버튼 */}
      <div className="flex items-center gap-3">
        {/* 관람모드일 때 '관람 중' 표시 - 클릭 불가능 */}
        {isViewingMode && viewingUserInfo && (
          <div className="flex flex-col items-center gap-0.5 px-2 py-1 bg-white/90 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-1">
              <span className="text-purple-600 text-xs">👀</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-semibold whitespace-nowrap">
                {viewingUserInfo.nickname}님의
              </span>
            </div>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-semibold">
              퀴즈 관람 중
            </span>
          </div>
        )}
        
        {/* 구독퀴즈 드롭다운 - 항상 표시 (로그인 사용자 ID 직접 가져오기) */}
        <QuizDropdown 
          onOpenAllQuizModal={onOpenAllQuizModal}
          isViewingMode={isViewingMode}
          userSchool={userSchool}
        />
      </div>
    </div>
  );
}
