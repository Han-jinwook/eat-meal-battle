"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';

export default function QuizClient() {
  // CSS 스타일 정의
  const styles = `
    .date-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
    }
    
    .date-button {
      padding: 0.5rem;
      border-radius: 0.375rem;
      text-align: center;
      transition: all 0.2s;
    }
    
    .date-button:hover {
      background-color: #e5e7eb;
    }
    
    .date-button.selected {
      background-color: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
    }
  `;

  // 상태 관리
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  
  // URL에서 날짜 파라미터 처리
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setSelectedDate(dateParam);
    }
  }, [searchParams]);

  // 날짜 변경 핸들러
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    
    // URL 업데이트
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    router.push(`/quiz?${params.toString()}`);
  };

  // 날짜 포맷팅
  const formatDateForDisplay = (date: Date): { month: number, day: number, weekday: string } => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: weekdays[date.getDay()]
    };
  };

  // 7일 날짜 범위 생성
  const getDateRange = () => {
    const dates = [];
    const today = new Date();
    
    // 오늘 포함 이전 3일
    for (let i = 3; i > 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      dates.push(formatApiDate(date));
    }
    
    // 오늘
    dates.push(formatApiDate(today));
    
    // 이후 3일
    for (let i = 1; i <= 3; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      dates.push(formatApiDate(date));
    }
    
    return dates;
  };

  return (
    <>
      <style jsx>{styles}</style>
      
      {/* 학교/학년/반 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900">{userSchool?.school_name || '학교'}</h1>
          <span className="text-md text-gray-600 ml-2">{userSchool?.grade}학년 {userSchool?.class_number}반</span>
        </div>
      </div>
      
      {/* 날짜 선택기 */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">날짜 선택</h2>
          <div className="date-grid">
            {getDateRange().map(date => {
              const dateObj = new Date(date);
              const { month, day, weekday } = formatDateForDisplay(dateObj);
              return (
                <button
                  key={date}
                  className={`date-button ${selectedDate === date ? 'selected' : ''}`}
                  onClick={() => handleDateChange(date)}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500">
                      {month}월 {day}일
                    </span>
                    <span className={`text-xs font-medium ${selectedDate === date ? 'text-blue-600' : 'text-gray-700'}`}>
                      {weekday}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* 추가 정보 표시 영역 */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">퀴즈 기능 준비 중</p>
          <p className="mt-2 text-gray-600">이 페이지는 준비 중입니다. 곧 이 공간에 퀴즈 기능이 추가될 예정입니다.</p>
        </div>
      </div>
    </>
  );
}
