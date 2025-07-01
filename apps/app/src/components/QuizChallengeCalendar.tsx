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
      
      // 트로피 계산
      const trophies = calculateTrophies(processedResults, year, month);
      setWeeklyTrophies(trophies);
      
    } catch (error) {
      console.error('데이터 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 트로피 계산
  const calculateTrophies = (results: QuizResult[], year: number, month: number): WeeklyTrophy[] => {
    const trophies: WeeklyTrophy[] = [];
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    let currentWeek = 1;
    let weekStart = new Date(startDate);
    
    // 첫 주의 시작을 월요일로 맞춤
    const firstDayOfWeek = weekStart.getDay();
    const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    
    while (weekStart <= endDate) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      let weekCorrect = 0;
      let weekTotal = 0;
      
      // 해당 주의 퀴즈 결과 계산 (월-금만)
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && d.getMonth() === month) { // 월-금, 해당 월만
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const result = results.find(r => r.date === dateStr);
          
          if (result && result.has_quiz) {
            weekTotal++;
            if (result.is_correct) {
              weekCorrect++;
            }
          }
        }
      }
      
      trophies.push({
        week: currentWeek,
        earned: weekTotal >= 4 && weekCorrect === weekTotal, // 4일 이상 전체 정답
        total_correct: weekCorrect,
        total_available: weekTotal
      });
      
      currentWeek++;
      weekStart.setDate(weekStart.getDate() + 7);
      
      if (currentWeek > 6) break; // 최대 6주
    }
    
    return trophies;
  };

  useEffect(() => {
    fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth, userSchool]);

  // 캘린더 그리드 생성
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    
    // 월요일 시작으로 조정
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - daysToSubtract);
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // 6주 * 7일 = 42일
    for (let i = 0; i < 42; i++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const quizResult = quizResults.find(r => r.date === dateStr);
      
      days.push({
        day: currentDate.getDate(),
        dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === today.toDateString(),
        isSelected: dateStr === currentQuizDate,
        hasQuiz: quizResult?.has_quiz || false,
        isCorrect: quizResult?.is_correct || false,
        isHoliday: !!holidays[dateStr]
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
    if (day.hasQuiz && day.isCurrentMonth && onDateSelect) {
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
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900">
            급식퀴즈 챌린지
          </h2>
          <span className="text-lg font-bold text-green-600 mt-1">
            ({currentMonth.getMonth()}월 결과 : 0/0개 맞음)
          </span>
          {/* 월장원 표시 - 나중에 조건식 추가 예정 */}
          {false && monthlyTrophy && (
            <span className="text-sm text-yellow-600 font-bold">
              {currentMonth.getMonth()}월 장원급제 🏆
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold text-gray-700 min-w-[120px] text-center">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* 요일 헤더 */}
      <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 0.5fr 1fr' }}>
        {['일', '월', '화', '수', '목', '금', '토', '주장원'].map((day, index) => (
          <div key={day} className={`text-center py-3 font-semibold ${
            index === 7 ? 'text-yellow-600' : 
            index === 0 || index === 6 ? 'text-red-500' : 'text-gray-700'
          }`}>
            <span className={index === 0 || index === 6 ? 'text-xs' : ''}>
              {day}
            </span>
          </div>
        ))}
      </div>
        
      {/* 캘린더 그리드 */}
      <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr 1fr' }}>
        {Array.from({ length: Math.ceil(calendarDays.length / 7) * 8 }, (_, index) => {
          const dayIndex = Math.floor(index / 8) * 7 + (index % 8);
          const isWeeklyTrophyCell = index % 8 === 7; // 8번째 열 (주장원 열)
          const weekIndex = Math.floor(index / 8);
          
          if (isWeeklyTrophyCell) {
            // 주장원 트로피 열 (빈칸 - 나중에 조건식 추가 예정)
            const weeklyTrophy = weeklyTrophies[weekIndex];
            return (
              <div
                key={`trophy-${weekIndex}`}
                className="h-16 border border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg flex items-center justify-center"
              >
                {/* 트로피 표시 - 나중에 조건식 추가 예정 */}
                {false && weeklyTrophy?.earned && (
                  <span className="text-2xl">🏆</span>
                )}
              </div>
            );
          }
          
          if (dayIndex >= calendarDays.length) {
            return <div key={`empty-${index}`} className="h-16"></div>;
          }
          
          const day = calendarDays[dayIndex];
          const isWeekend = (dayIndex % 7) >= 5; // 토요일(5), 일요일(6)
          
          const cellClasses = [
            'h-16 border border-gray-200 rounded-lg flex flex-col relative transition-all duration-200'
          ];
          
          // 현재 월이 아닌 날짜
          if (!day.isCurrentMonth) {
            cellClasses.push('bg-gray-50 text-gray-300');
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
          
          // 주말 색상
          if (isWeekend && day.isCurrentMonth) {
            cellClasses.push('text-red-600');
          }
          
          return (
            <div
              key={`${day.dateStr}-${dayIndex}`}
              className={cellClasses.join(' ')}
              onClick={() => handleDateClick(day)}
            >
              {/* 날짜 숫자 - 좌상단 */}
              <span className={`absolute top-1 left-1 font-medium ${
                isWeekend ? 'text-xs' : 'text-xs'
              } ${
                day.isToday ? 'text-blue-700' : 
                day.isSelected ? 'text-purple-700' :
                !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {day.day}
              </span>
              
              {/* 공휴일 표시 - 가운데 */}
              {day.isHoliday && day.isCurrentMonth && (
                <div className="flex items-center justify-center">
                  <div className="text-xs text-red-500 font-bold">
                    공휴일
                  </div>
                </div>
              )}
              
              {/* 퀴즈 결과 표시 - 선생님 채점 느낌 (주말 제외) */}
              {day.hasQuiz && day.isCurrentMonth && !isWeekend && (
                <div className="flex items-center justify-center">
                  {day.isCorrect ? (
                    <span className="text-blue-600 font-black text-3xl transform rotate-12 drop-shadow-sm">✓</span>
                  ) : (
                    <span className="text-red-600 font-black text-3xl transform -rotate-12 drop-shadow-sm">✕</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
