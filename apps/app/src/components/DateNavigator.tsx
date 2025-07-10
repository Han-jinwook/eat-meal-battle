'use client';

import React from 'react';

interface DateNavigatorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  className?: string;
  theme?: 'blue' | 'red' | 'green' | 'purple' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  showWeekday?: boolean;
}

export default function DateNavigator({ 
  selectedDate, 
  onDateChange, 
  className = '',
  theme = 'blue',
  size = 'md',
  showWeekday = true
}: DateNavigatorProps) {
  // 날짜를 하루 앞뒤로 이동하는 함수
  const navigateDate = (direction: 'prev' | 'next') => {
    if (!selectedDate) return;
    
    // AI 검증 실패 이미지가 있는지 확인
    const hasRejectedImage = typeof window !== 'undefined' && (window as any).hasRejectedImage;
    console.log('📍 DateNavigator - 날짜 네비게이션 시도:', { direction, hasRejectedImage, rejectedImageId: (window as any)?.rejectedImageId });
    
    if (hasRejectedImage) {
      const confirmed = window.confirm(
        'AI 검증에 실패한 이미지가 있습니다. 먼저 해당 이미지를 삭제해주세요.\n\n삭제하고 계속하시겠습니까?'
      );
      
      if (confirmed) {
        // 전역 플래그 해제
        (window as any).hasRejectedImage = false;
        (window as any).rejectedImageId = null;
      } else {
        return; // 네비게이션 취소
      }
    }
    
    try {
      const currentDate = new Date(selectedDate);
      if (isNaN(currentDate.getTime())) return;
      
      const newDate = new Date(currentDate);
      if (direction === 'prev') {
        newDate.setDate(currentDate.getDate() - 1);
      } else {
        newDate.setDate(currentDate.getDate() + 1);
      }
      
      // YYYY-MM-DD 형식으로 변환
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const formattedDate = year + '-' + month + '-' + day;
      
      onDateChange(formattedDate);
    } catch (error) {
      console.error('날짜 네비게이션 오류:', error);
    }
  };

  // 날짜 입력 핸들러
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // AI 검증 실패 이미지가 있는지 확인
    if (typeof window !== 'undefined' && (window as any).hasRejectedImage) {
      const confirmed = window.confirm(
        'AI 검증에 실패한 이미지가 있습니다. 먼저 해당 이미지를 삭제해주세요.\n\n삭제하고 계속하시겠습니까?'
      );
      
      if (confirmed) {
        // 전역 플래그 해제
        (window as any).hasRejectedImage = false;
        (window as any).rejectedImageId = null;
      } else {
        return; // 날짜 변경 취소
      }
    }
    
    onDateChange(e.target.value);
  };

  // 날짜 선택기 열기
  const openDatePicker = () => {
    const dateInput = document.getElementById('date-navigator-input') as HTMLInputElement;
    dateInput?.showPicker?.();
  };

  // 테마별 색상 설정
  const getThemeColors = () => {
    const themes = {
      blue: {
        bg: 'bg-blue-50 hover:bg-blue-100',
        border: 'border-blue-100',
        text: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-700'
      },
      red: {
        bg: 'bg-red-50 hover:bg-red-100',
        border: 'border-red-100',
        text: 'text-red-600',
        badge: 'bg-red-100 text-red-700'
      },
      green: {
        bg: 'bg-green-50 hover:bg-green-100',
        border: 'border-green-100',
        text: 'text-green-600',
        badge: 'bg-green-100 text-green-700'
      },
      purple: {
        bg: 'bg-purple-50 hover:bg-purple-100',
        border: 'border-purple-100',
        text: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700'
      },
      orange: {
        bg: 'bg-orange-50 hover:bg-orange-100',
        border: 'border-orange-100',
        text: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-700'
      }
    };
    return themes[theme];
  };

  // 크기별 스타일 설정
  const getSizeStyles = () => {
    const sizes = {
      sm: {
        button: 'w-6 h-6',
        icon: 'h-3 w-3',
        padding: 'px-1 py-1',
        text: 'text-xs',
        badge: 'text-xs px-1 py-0.5'
      },
      md: {
        button: 'w-8 h-8',
        icon: 'h-4 w-4',
        padding: 'px-1.5 py-1',
        text: 'text-sm',
        badge: 'text-xs px-1.5 py-0.5'
      },
      lg: {
        button: 'w-10 h-10',
        icon: 'h-5 w-5',
        padding: 'px-2 py-1.5',
        text: 'text-base',
        badge: 'text-sm px-2 py-1'
      }
    };
    return sizes[size];
  };

  const themeColors = getThemeColors();
  const sizeStyles = getSizeStyles();

  return (
    <div className={`mb-2 mt-1 ${className}`}>
      {/* 숨겨진 날짜 입력 필드 */}
      <input
        type="date"
        id="date-navigator-input"
        value={selectedDate}
        onChange={handleDateInputChange}
        className="sr-only" // 화면에서 숨김
      />
      
      {/* 날짜 네비게이션 UI */}
      <div className="flex items-center gap-0.5 w-fit">
        {/* 이전 날짜 버튼 */}
        <button
          onClick={() => navigateDate('prev')}
          className={`flex items-center justify-center ${sizeStyles.button} ${themeColors.bg} rounded border ${themeColors.border} shadow-sm transition-colors`}
          title="이전 날짜"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeStyles.icon} ${themeColors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 날짜 표시 버튼 */}
        <button 
          onClick={openDatePicker}
          className={`flex items-center justify-between ${sizeStyles.padding} ${themeColors.bg} rounded border ${themeColors.border} shadow-sm transition-colors min-w-0`}
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
                    <span className={`${themeColors.text} mr-1`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={sizeStyles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className={`${sizeStyles.text} font-medium text-gray-700`}>
                      {year + '-' + month + '-' + day}
                    </span>
                    {showWeekday && (
                      <span className={`ml-1 font-medium ${sizeStyles.badge} ${themeColors.badge} rounded`}>
                        {weekday}
                      </span>
                    )}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeStyles.icon} ${themeColors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              );
            }
            return selectedDate;
          })()}
        </button>

        {/* 다음 날짜 버튼 */}
        <button
          onClick={() => navigateDate('next')}
          className={`flex items-center justify-center ${sizeStyles.button} ${themeColors.bg} rounded border ${themeColors.border} shadow-sm transition-colors`}
          title="다음 날짜"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeStyles.icon} ${themeColors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
