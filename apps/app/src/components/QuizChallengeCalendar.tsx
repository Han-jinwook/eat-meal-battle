"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';

// Supabase 클라이언트 초기화
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
  currentQuizDate?: string; // 현재 퀴즈 페이지에서 선택된 날짜
  onDateSelect?: (date: string) => void; // 날짜 클릭 시 콜백
}

const QuizChallengeCalendar: React.FC<QuizChallengeCalendarProps> = ({ 
  currentQuizDate, 
  onDateSelect 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5, 1)); // 2025년 6월부터 시작
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [weeklyTrophies, setWeeklyTrophies] = useState<WeeklyTrophy[]>([]);
  const [monthlyTrophy, setMonthlyTrophy] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { userSchool } = useUserSchool();

  // 달력 데이터 가져오기
  const fetchCalendarData = async (year: number, month: number) => {
    if (!userSchool) return;
    
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      // 해당 월의 퀴즈 결과 가져오기
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select(`
          quiz_id,
          selected_option,
          is_correct,
          answer_time,
          quizzes!inner(meal_date)
        `)
        .eq('user_id', session.data.session.user.id)
        .gte('quizzes.meal_date', startDate.toISOString().split('T')[0])
        .lte('quizzes.meal_date', endDate.toISOString().split('T')[0]);

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error);
        return;
      }

      // 결과 데이터 변환
      const processedResults: QuizResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const result = results?.find((r: any) => r.quizzes.meal_date === dateStr);
        
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
    
    let weekStart = new Date(firstDay);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 주의 시작 (일요일)
    
    let weekNumber = 0;
    
    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // 주의 끝 (토요일)
      
      let totalCorrect = 0;
      let totalAvailable = 0;
      
      // 해당 주의 퀴즈 결과 계산
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month) { // 현재 월에 속하는 날짜만
          const dateStr = d.toISOString().split('T')[0];
          const result = results.find(r => r.date === dateStr);
          
          if (result?.has_quiz) {
            totalAvailable++;
            if (result.is_correct) {
              totalCorrect++;
            }
          }
        }
      }
      
      // 주장원 조건: 최소 4일 퀴즈 있고, 모든 퀴즈 정답
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
    
    // 월장원 계산: 한 달 간 모든 급식퀴즈를 다 맞추고, 11회 이상 급식이 있는 달
    const totalQuizzes = results.filter(r => r.has_quiz).length;
    const totalCorrect = results.filter(r => r.has_quiz && r.is_correct).length;
    const monthlyTrophyEarned = totalQuizzes >= 11 && totalCorrect === totalQuizzes && totalQuizzes > 0;
    setMonthlyTrophy(monthlyTrophyEarned);
  };

  // 달력 그리드 생성
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 주의 시작부터

    const weeks = [];
    let currentDate = new Date(startDate);
    
    for (let week = 0; week < 6; week++) {
      const days = [];
      
      for (let day = 0; day < 7; day++) {
        const isCurrentMonth = currentDate.getMonth() === month;
        const dateStr = currentDate.toISOString().split('T')[0];
        const result = quizResults.find(r => r.date === dateStr);
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const isSelected = dateStr === currentQuizDate;
        
        days.push({
          date: new Date(currentDate),
          dateStr,
          isCurrentMonth,
          result,
          isToday,
          isSelected
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // 주장원 트로피 정보
      const weeklyTrophy = weeklyTrophies[week];
      
      weeks.push({ days, weeklyTrophy });
      
      // 마지막 날을 넘어가면 중단
      if (currentDate > lastDay && week >= 4) break;
    }
    
    return weeks;
  };

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateStr: string, hasQuiz: boolean) => {
    if (hasQuiz && onDateSelect) {
      onDateSelect(dateStr);
    }
  };

  // 데이터 로드
  useEffect(() => {
    if (userSchool) {
      fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
    }
  }, [currentMonth, userSchool]);

  // 현재 퀴즈 결과 업데이트 시 달력 새로고침
  useEffect(() => {
    if (currentQuizDate && userSchool) {
      const quizDate = new Date(currentQuizDate);
      if (quizDate.getFullYear() === currentMonth.getFullYear() && 
          quizDate.getMonth() === currentMonth.getMonth()) {
        // 현재 보고 있는 달의 퀴즈라면 데이터 새로고침
        setTimeout(() => {
          fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
        }, 1000); // 1초 후 새로고침 (DB 업데이트 대기)
      }
    }
  }, [currentQuizDate]);

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-8">
        <h3 className="text-xl font-bold text-center mb-6">급식퀴즈 챌린지 현황</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const calendarWeeks = generateCalendarGrid();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      {/* 제목 */}
      <h3 className="text-xl font-bold text-center mb-6">급식퀴즈 챌린지 현황</h3>
      
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={currentMonth <= new Date(2025, 5, 1)} // 2025년 6월 이전 비활성화
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-4">
          <h4 className="text-lg font-semibold">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          
          {/* 월장원 트로피 */}
          {monthlyTrophy && (
            <div className="text-2xl" title="월장원">
              🏆
            </div>
          )}
        </div>
        
        <button
          onClick={() => changeMonth('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={currentMonth >= new Date()} // 현재 월 이후 비활성화
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="border rounded-lg overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-8 bg-gray-50">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center font-medium text-gray-600 border-r last:border-r-0">
              {day}
            </div>
          ))}
          <div className="p-3 text-center font-medium text-gray-600">
            주장원
          </div>
        </div>

        {/* 달력 주 */}
        {calendarWeeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-8 border-t">
            {/* 날짜 칸들 */}
            {week.days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`
                  p-3 h-16 border-r last:border-r-0 relative cursor-pointer
                  ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                  ${day.isToday ? 'bg-blue-50' : ''}
                  ${day.isSelected ? 'ring-2 ring-blue-500' : ''}
                  ${day.result?.has_quiz ? 'hover:bg-gray-50' : ''}
                `}
                onClick={() => handleDateClick(day.dateStr, day.result?.has_quiz || false)}
              >
                <div className={`text-sm ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                  {day.date.getDate()}
                </div>
                
                {/* 퀴즈 결과 표시 */}
                {day.result?.has_quiz && (
                  <div className="absolute bottom-1 right-1">
                    {day.result.is_correct ? (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        O
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        X
                      </div>
                    )}
                  </div>
                )}
                
                {/* 오늘 표시 */}
                {day.isToday && (
                  <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            ))}
            
            {/* 주장원 트로피 칸 */}
            <div className="p-3 h-16 bg-gray-50 flex items-center justify-center">
              {week.weeklyTrophy?.earned && (
                <div 
                  className="text-xl" 
                  title={`주장원 (${week.weeklyTrophy.total_correct}/${week.weeklyTrophy.total_available})`}
                >
                  🏆
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            O
          </div>
          <span>정답</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            X
          </div>
          <span>오답</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-lg">🏆</span>
          <span>주장원 (4일 이상 전체 정답) / 월장원 (11회 이상 전체 정답)</span>
        </div>
      </div>
    </div>
  );
};

export default QuizChallengeCalendar;
