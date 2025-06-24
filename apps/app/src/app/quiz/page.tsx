'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useUserSchool from '@/hooks/useUserSchool';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';

export default function QuizPage() {
  const router = useRouter();
  const { userSchool, loading: userLoading } = useUserSchool();
  
  // 날짜 관련 상태 관리
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  
  // URL 매개변수를 사용하여 날짜 갱신하는 함수
  const updateDateWithUrl = (date: string) => {
    // 상태 업데이트
    setSelectedDate(date);
    
    // 클라이언트에서만 실행 (window 객체 존재 확인)
    if (typeof window !== 'undefined') {
      try {
        // 현재 URL 매개변수 복사
        const params = new URLSearchParams(window.location.search);
        // 날짜 매개변수 업데이트
        params.set('date', date);
        
        // 히스토리 상태 업데이트 (페이지 새로고침 없이)
        const url = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', url);
      } catch (error) {
        console.error('주소 갱신 오류:', error);
      }
    }
  };

  // 날짜 변경 핸들러
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    updateDateWithUrl(newDate);
  };

  // 클라이언트 사이드에서 URL 매개변수 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateFromUrl = params.get('date');
      
      // URL에서 날짜 파라미터가 있으면 그 값을 사용, 없으면 오늘 날짜 사용
      const dateToUse = dateFromUrl || getCurrentDate();
      
      // 상태 업데이트 - selectedDate를 설정
      setSelectedDate(dateToUse);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 학교 정보 헤더 - 급식 페이지와 동일한 디자인 */}
        {userSchool ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
              {userSchool.school_name}
            </span>
            {(userSchool.grade || userSchool.class_number) && (
              <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                {userSchool.grade ? `${userSchool.grade}학년` : ''}
                {userSchool.class_number ? ` ${userSchool.class_number}반` : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="mb-6"></div>
        )}

        {/* 날짜 선택기 - 급식 페이지와 동일한 디자인 */}
        <div className="mb-6 mt-1">
          <input
            type="date"
            id="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="sr-only" // 화면에서 숨김
          />
          <button 
            onClick={() => {
              // showPicker 메서드에 대한 타입 안전성 보장
              const dateInput = document.getElementById('date') as HTMLInputElement;
              dateInput?.showPicker?.();
            }} 
            className="w-full flex items-center justify-between px-2 py-1.5 bg-blue-50 rounded border border-blue-100 shadow-sm"
          >
            {selectedDate && (() => {
              const date = new Date(selectedDate);
              if (!isNaN(date.getTime())) {
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const weekday = weekdays[date.getDay()];
                
                return (
                  <>
                    <div className="flex items-center">
                      <span className="text-blue-600 mr-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {`${year}-${month}-${day}`}
                      </span>
                      <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {weekday}
                      </span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                );
              }
              return selectedDate;
            })()}
          </button>
        </div>
        
        {/* 퀴즈 페이지 준비 중 메시지 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">퀴즈 기능 준비 중</p>
            <p className="mt-2 text-gray-600">이 페이지는 준비 중입니다. 곧 이 공간에 퀴즈 기능이 추가될 예정입니다.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
