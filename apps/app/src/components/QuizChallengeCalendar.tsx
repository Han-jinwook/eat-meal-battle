"use client";

import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';
import Holidays from 'date-holidays';

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

  // 한국 공휴일 초기화
  useEffect(() => {
    const hd = new Holidays('KR');
    const currentYear = currentMonth.getFullYear();
    const yearHolidays = hd.getHolidays(currentYear);
    
    const holidayMap: {[key: string]: string} = {};
    yearHolidays.forEach(holiday => {
      const dateStr = holiday.date.toISOString().split('T')[0];
      holidayMap[dateStr] = holiday.name;
    });
    
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

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const result = quizResults.find(r => r.date === dateStr);
    if (result?.has_quiz && onDateSelect) {
      onDateSelect(dateStr);
    }
  };

  // 타일 내용 (퀴즈 결과 표시)
  const tileContent = ({ date }: { date: Date }) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const result = quizResults.find(r => r.date === dateStr);
    const isHoliday = holidays[dateStr];
    
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {/* 공휴일 표시 */}
        {isHoliday && (
          <div className="text-xs text-red-500 font-bold mb-1">
            공휴일
          </div>
        )}
        
        {/* 퀴즈 결과 표시 */}
        {result?.has_quiz && (
          <div className="mt-1">
            {result.is_correct ? (
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                ✓
              </div>
            ) : (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                ✕
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 타일 클래스명 (선택된 날짜, 오늘 날짜 등)
  const tileClassName = ({ date }: { date: Date }) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const result = quizResults.find(r => r.date === dateStr);
    const isHoliday = holidays[dateStr];
    
    let classes = [];
    
    // 오늘 날짜
    if (dateStr === todayStr) {
      classes.push('bg-blue-100 border-2 border-blue-500');
    }
    
    // 선택된 날짜
    if (dateStr === currentQuizDate) {
      classes.push('ring-2 ring-blue-600');
    }
    
    // 퀴즈가 있는 날짜
    if (result?.has_quiz) {
      classes.push('cursor-pointer hover:bg-gray-100');
    }
    
    // 공휴일
    if (isHoliday) {
      classes.push('text-red-500');
    }
    
    return classes.join(' ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          퀴즈 챌린지 현황
        </h2>
        
        {/* 월장원 표시 */}
        {monthlyTrophy && (
          <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1 rounded-full">
            <span className="text-2xl">👑</span>
            <span className="text-sm font-medium text-yellow-700">월장원</span>
          </div>
        )}
      </div>

      {/* React Calendar */}
      <div className="calendar-container">
        <Calendar
          value={currentQuizDate ? new Date(currentQuizDate) : new Date()}
          onClickDay={handleDateClick}
          tileContent={tileContent}
          tileClassName={tileClassName}
          locale="ko-KR"
          calendarType="gregory"
          showNeighboringMonth={false}
          formatDay={(locale, date) => date.getDate().toString()}
          formatMonthYear={(locale, date) => 
            `${date.getFullYear()}년 ${date.getMonth() + 1}월`
          }
          onActiveStartDateChange={({ activeStartDate }) => {
            if (activeStartDate) {
              setCurrentMonth(activeStartDate);
            }
          }}
        />
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
      <div className="flex items-center justify-center space-x-6 mt-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
            ✓
          </div>
          <span>정답</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
            ✕
          </div>
          <span>오답</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-lg">🏆</span>
          <span>주장원 (4일 이상 전체 정답)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-lg">👑</span>
          <span>월장원 (11회 이상 전체 정답)</span>
        </div>
      </div>

      {/* 커스텀 CSS */}
      <style jsx>{`
        .calendar-container :global(.react-calendar) {
          width: 100%;
          border: none;
          font-family: inherit;
        }
        
        .calendar-container :global(.react-calendar__tile) {
          height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 8px 4px;
          position: relative;
        }
        
        .calendar-container :global(.react-calendar__tile--now) {
          background: #dbeafe !important;
          border: 2px solid #3b82f6 !important;
        }
        
        .calendar-container :global(.react-calendar__tile--active) {
          background: #1e40af !important;
          color: white !important;
        }
        
        .calendar-container :global(.react-calendar__month-view__weekdays) {
          text-align: center;
          font-weight: 600;
          color: #374151;
        }
        
        .calendar-container :global(.react-calendar__navigation) {
          margin-bottom: 1rem;
        }
        
        .calendar-container :global(.react-calendar__navigation button) {
          font-size: 1.1rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default QuizChallengeCalendar;
