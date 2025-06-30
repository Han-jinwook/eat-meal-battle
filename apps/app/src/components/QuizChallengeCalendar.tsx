"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizResult {
  date: string;
  is_correct: boolean;
  has_quiz: boolean;
}

interface WeeklyTrophy {
  week: number;
  earned: boolean;
  total_correct: number;
  total_available: number;
}

interface QuizChallengeCalendarProps {
  currentQuizDate?: string;
  onDateSelect?: (date: string) => void;
}

const QuizChallengeCalendar: React.FC<QuizChallengeCalendarProps> = ({ 
  currentQuizDate, 
  onDateSelect 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5, 1)); // 6월
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [weeklyTrophies, setWeeklyTrophies] = useState<WeeklyTrophy[]>([]);
  const [monthlyTrophy, setMonthlyTrophy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<{[key: string]: string}>({});
  
  const { userSchool } = useUserSchool();

  // 한국 공휴일 초기화 (임시로 주요 공휴일만)
  useEffect(() => {
    const currentYear = currentMonth.getFullYear();
    const holidayMap: {[key: string]: string} = {};
    
    // 2025년 주요 공휴일
    if (currentYear === 2025) {
      holidayMap['2025-01-01'] = '신정';
      holidayMap['2025-01-28'] = '설날연휴';
      holidayMap['2025-01-29'] = '설날';
      holidayMap['2025-01-30'] = '설날연휴';
      holidayMap['2025-03-01'] = '삼일절';
      holidayMap['2025-05-05'] = '어린이날';
      holidayMap['2025-05-06'] = '대체공휴일';
      holidayMap['2025-06-06'] = '현충일';
      holidayMap['2025-08-15'] = '광복절';
      holidayMap['2025-09-16'] = '추석연휴';
      holidayMap['2025-09-17'] = '추석';
      holidayMap['2025-09-18'] = '추석연휴';
      holidayMap['2025-10-03'] = '개천절';
      holidayMap['2025-10-09'] = '한글날';
      holidayMap['2025-12-25'] = '크리스마스';
    }
    
    setHolidays(holidayMap);
  }, [currentMonth]);

  // 퀴즈 결과 데이터 가져오기
  const fetchCalendarData = async (year: number, month: number) => {
    if (!userSchool) return;
    
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      // 로컬 날짜 문자열 생성 함수
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select(`
          quiz_id,
          selected_option,
          is_correct,
          answer_time,
          meal_quizzes!inner(meal_date)
        `)
        .eq('user_id', session.data.session.user.id)
        .gte('meal_quizzes.meal_date', formatLocalDate(startDate))
        .lte('meal_quizzes.meal_date', formatLocalDate(endDate));

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error);
        return;
      }

      const processedResults: QuizResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        const result = results?.find((r: any) => r.meal_quizzes.meal_date === dateStr);
        
        processedResults.push({
          date: dateStr,
          is_correct: result?.is_correct || false,
          has_quiz: !!result
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      setQuizResults(processedResults);
      calculateTrophies(processedResults, year, month);
      
    } catch (error) {
      console.error('달력 데이터 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 트로피 계산
  const calculateTrophies = (results: QuizResult[], year: number, month: number) => {
    const weeks: WeeklyTrophy[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 월요일 시작으로 주 계산
    let weekStart = new Date(firstDay);
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    
    let weekNumber = 0;
    
    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      let totalCorrect = 0;
      let totalAvailable = 0;
      
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          const result = results.find(r => r.date === dateStr);
          
          if (result?.has_quiz) {
            totalAvailable++;
            if (result.is_correct) {
              totalCorrect++;
            }
          }
        }
      }
      
      const earned = totalAvailable >= 4 && totalCorrect === totalAvailable && totalAvailable > 0;
      
      weeks.push({
        week: weekNumber,
        earned,
        total_correct: totalCorrect,
        total_available: totalAvailable
      });
      
      weekStart.setDate(weekStart.getDate() + 7);
      weekNumber++;
    }
    
    setWeeklyTrophies(weeks);
    
    // 월장원 계산 (11회 이상 전체 정답)
    const monthlyCorrect = results.filter(r => r.has_quiz && r.is_correct).length;
    const monthlyTotal = results.filter(r => r.has_quiz).length;
    setMonthlyTrophy(monthlyTotal >= 11 && monthlyCorrect === monthlyTotal && monthlyTotal > 0);
  };

  // 데이터 로드
  useEffect(() => {
    fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth, userSchool]);

  // 캘린더 그리드 생성
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 월요일 시작으로 조정
    const startDate = new Date(firstDay);
    const dayOfWeek = startDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToMonday);
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // 6주 × 7일 = 42일
    for (let i = 0; i < 42; i++) {
      const dateStr = formatLocalDate(currentDate);
      const isCurrentMonth = currentDate.getMonth() === month;
      const result = quizResults.find(r => r.date === dateStr);
      const isHoliday = holidays[dateStr];
      
      const today = new Date();
      const todayStr = formatLocalDate(today);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === currentQuizDate;
      
      days.push({
        date: new Date(currentDate),
        dateStr,
        day: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        isHoliday,
        holidayName: isHoliday ? holidays[dateStr] : null,
        hasQuiz: result?.has_quiz || false,
        isCorrect: result?.is_correct || false
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };
  
  // 로컬 날짜 포맷 함수
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (day: any) => {
    if (day.hasQuiz && onDateSelect) {
      onDateSelect(day.dateStr);
    }
  };
  
  // 월 변경 핸들러
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const calendarDays = generateCalendarGrid();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          퀴즈 챌린지 현황
        </h2>
        
        {/* 월장원 표시 */}
        {monthlyTrophy && (
          <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-50 to-orange-50 px-4 py-2 rounded-full border border-yellow-200">
            <span className="text-2xl">👑</span>
            <span className="text-sm font-bold text-yellow-700">월장원</span>
          </div>
        )}
      </div>

      {/* 커스텀 캘린더 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        {/* 캘린더 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200 group"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
          </button>
          
          <h3 className="text-xl font-bold text-gray-800">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </h3>
          
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200 group"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
          </button>
        </div>
        
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => (
            <div key={day} className="text-center py-3 font-semibold text-gray-700">
              <span className={`${index >= 5 ? 'text-red-500' : 'text-gray-700'}`}>
                {day}
              </span>
            </div>
          ))}
        </div>
        
        {/* 캘린더 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            let cellClasses = [
              'relative h-16 p-2 rounded-lg transition-all duration-200',
              'flex flex-col items-center justify-center',
              'border border-transparent'
            ];
            
            // 현재 월이 아닌 날짜
            if (!day.isCurrentMonth) {
              cellClasses.push('text-gray-300 bg-gray-50/50');
            } else {
              cellClasses.push('bg-white hover:bg-blue-50');
            }
            
            // 오늘 날짜
            if (day.isToday && day.isCurrentMonth) {
              cellClasses.push('ring-2 ring-blue-500 bg-blue-100 font-bold');
            }
            
            // 선택된 날짜
            if (day.isSelected) {
              cellClasses.push('ring-2 ring-purple-500 bg-purple-100');
            }
            
            // 퀴즈가 있는 날짜
            if (day.hasQuiz) {
              cellClasses.push('cursor-pointer hover:shadow-md hover:scale-105');
            }
            
            // 공휴일
            if (day.isHoliday && day.isCurrentMonth) {
              cellClasses.push('bg-red-50 border-red-200');
            }
            
            // 주말
            const dayOfWeek = index % 7;
            if (dayOfWeek >= 5 && day.isCurrentMonth) {
              cellClasses.push('text-red-600');
            }
            
            return (
              <div
                key={`${day.dateStr}-${index}`}
                className={cellClasses.join(' ')}
                onClick={() => handleDateClick(day)}
              >
                {/* 날짜 숫자 - 좌상단 */}
                <span className={`absolute top-1 left-1 text-xs font-medium ${
                  day.isToday ? 'text-blue-700' : 
                  day.isSelected ? 'text-purple-700' :
                  !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {day.day}
                </span>
                
                {/* 공휴일 표시 - 우상단 */}
                {day.isHoliday && day.isCurrentMonth && (
                  <div className="absolute top-1 right-1 text-xs text-red-500 font-bold leading-none">
                    휴
                  </div>
                )}
                
                {/* 퀴즈 결과 표시 - 가운데 큰 아이콘 */}
                {day.hasQuiz && day.isCurrentMonth && (
                  <div className="flex items-center justify-center">
                    {day.isCorrect ? (
                      <div className="w-8 h-8 rounded-full border-3 border-blue-600 flex items-center justify-center">
                        <span className="text-blue-600 text-xl font-black">○</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-3 border-red-600 flex items-center justify-center">
                        <span className="text-red-600 text-xl font-black">✕</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 주장원 현황 */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">주장원 현황</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {weeklyTrophies.map((trophy, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border text-center ${
                trophy.earned 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="text-sm font-medium text-gray-600">
                {index + 1}주차
              </div>
              <div className="mt-1">
                {trophy.earned ? (
                  <span className="text-2xl">🏆</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {trophy.total_correct}/{trophy.total_available}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="bg-gray-50 rounded-xl p-4 mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">범례</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2 justify-center">
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
              ✓
            </div>
            <span className="text-gray-700">정답</span>
          </div>
          <div className="flex items-center space-x-2 justify-center">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
              ✕
            </div>
            <span className="text-gray-700">오답</span>
          </div>
          <div className="flex items-center space-x-2 justify-center">
            <span className="text-lg">🏆</span>
            <span className="text-gray-700">주장원</span>
          </div>
          <div className="flex items-center space-x-2 justify-center">
            <span className="text-lg">👑</span>
            <span className="text-gray-700">월장원</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-center mt-2">
          주장원: 4일 이상 전체 정답 | 월장원: 11회 이상 전체 정답
        </div>
      </div>
    </div>
  );
};

export default QuizChallengeCalendar;
