"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';

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
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5, 1));
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [weeklyTrophies, setWeeklyTrophies] = useState<WeeklyTrophy[]>([]);
  const [monthlyTrophy, setMonthlyTrophy] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { userSchool } = useUserSchool();

  const fetchCalendarData = async (year: number, month: number) => {
    if (!userSchool) return;
    
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
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
        .gte('meal_quizzes.meal_date', startDate.toISOString().split('T')[0])
        .lte('meal_quizzes.meal_date', endDate.toISOString().split('T')[0]);

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error);
        return;
      }

      const processedResults: QuizResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
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

  const calculateTrophies = (results: QuizResult[], year: number, month: number) => {
    const weeks: WeeklyTrophy[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let weekStart = new Date(firstDay);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    let weekNumber = 0;
    
    while (weekStart <= lastDay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      let totalCorrect = 0;
      let totalAvailable = 0;
      
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month) {
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
    
    const totalQuizzes = results.filter(r => r.has_quiz).length;
    const totalCorrect = results.filter(r => r.has_quiz && r.is_correct).length;
    const monthlyTrophyEarned = totalQuizzes >= 11 && totalCorrect === totalQuizzes && totalQuizzes > 0;
    setMonthlyTrophy(monthlyTrophyEarned);
  };

  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks = [];
    let currentDate = new Date(startDate);
    
    for (let week = 0; week < 6; week++) {
      const days = [];
      
      for (let day = 0; day < 7; day++) {
        const isCurrentMonth = currentDate.getMonth() === month;
        const dateStr = currentDate.toISOString().split('T')[0];
        const result = quizResults.find(r => r.date === dateStr);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const isToday = dateStr === todayStr && isCurrentMonth;
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
      
      const weeklyTrophy = weeklyTrophies[week];
      weeks.push({ days, weeklyTrophy });
      
      if (currentDate > lastDay && week >= 4) break;
    }
    
    return weeks;
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDateClick = (dateStr: string, hasQuiz: boolean) => {
    if (hasQuiz && onDateSelect) {
      onDateSelect(dateStr);
    }
  };

  useEffect(() => {
    if (userSchool) {
      fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
    }
  }, [currentMonth, userSchool]);

  useEffect(() => {
    if (currentQuizDate && userSchool) {
      const quizDate = new Date(currentQuizDate);
      if (quizDate.getFullYear() === currentMonth.getFullYear() && 
          quizDate.getMonth() === currentMonth.getMonth()) {
        setTimeout(() => {
          fetchCalendarData(currentMonth.getFullYear(), currentMonth.getMonth());
        }, 1000);
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
      <h3 className="text-xl font-bold text-center mb-6">급식퀴즈 챌린지 현황</h3>
      
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={currentMonth <= new Date(2025, 5, 1)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-4">
          <h4 className="text-lg font-semibold">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          
          {monthlyTrophy && (
            <div className="text-2xl" title="월장원">
              🏆
            </div>
          )}
        </div>
        
        <button
          onClick={() => changeMonth('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={currentMonth >= new Date()}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
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

        {calendarWeeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-8 border-t">
            {week.days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`
                  p-2 h-16 border-r last:border-r-0 relative cursor-pointer flex flex-col items-center justify-center
                  ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                  ${day.isToday ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300' : ''}
                  ${day.isSelected ? 'ring-2 ring-blue-500' : ''}
                  ${day.result?.has_quiz ? 'hover:bg-gray-50' : ''}
                  transition-all duration-200
                `}
                onClick={() => handleDateClick(day.dateStr, day.result?.has_quiz || false)}
              >
                <div className={`text-sm font-medium ${
                  day.isToday 
                    ? 'text-blue-700 font-bold' 
                    : day.isCurrentMonth 
                    ? 'text-gray-900' 
                    : 'text-gray-400'
                }`}>
                  {day.date.getDate()}
                </div>
                
                {day.result?.has_quiz && (
                  <div className="mt-1">
                    {day.result.is_correct ? (
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
            ))}
            
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

      <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-600">
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
          <span>주장원 (4일 이상 전체 정답) / 월장원 (11회 이상 전체 정답)</span>
        </div>
      </div>
    </div>
  );
};

export default QuizChallengeCalendar;
