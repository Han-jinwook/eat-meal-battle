'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface DailyStats {
  date: string;
  total_attempts: number;
  correct_answers: number;
  accuracy_rate: number;
}

export default function QuizPerformanceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // 퀴즈 완료 이벤트 리스너
  useEffect(() => {
    const handleQuizCompleted = () => {
      // 현재 달력 데이터 새로고침
      loadCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1);
    };

    window.addEventListener('quizCompleted', handleQuizCompleted);
    return () => window.removeEventListener('quizCompleted', handleQuizCompleted);
  }, [currentDate]);

  // 달력 데이터 로드
  const loadCalendarData = async (year: number, month: number) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const { data, error } = await (supabase
        .from('all_quiz_daily_stats')
        .select('date, total_attempts, correct_answers, accuracy_rate')
        .eq('user_id', session.user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true }) as any);

      if (error) {
        console.error('달력 데이터 로드 오류:', error);
        return;
      }

      setDailyStats(data || []);
    } catch (err) {
      console.error('달력 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // 달력 그리드 생성
  const generateCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const dayStats = dailyStats.find(stat => stat.date === dateStr);
      
      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth,
        stats: dayStats
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  // 컴포넌트 마운트 시 및 월 변경 시 데이터 로드
  useEffect(() => {
    loadCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1);
  }, [currentDate]);

  const calendarDays = generateCalendarGrid();
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          disabled={loading}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h4 className="text-lg font-semibold text-gray-800">
          {currentDate.getFullYear()}년 {monthNames[currentDate.getMonth()]}
        </h4>
        
        <button
          onClick={() => changeMonth('next')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          disabled={loading}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div key={day} className={`text-center text-xs font-medium py-2 ${
            index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const isToday = day.dateStr === new Date().toISOString().split('T')[0];
          const hasStats = day.stats && day.stats.total_attempts > 0;
          
          return (
            <div
              key={index}
              className={`
                aspect-square flex flex-col items-start justify-between text-xs border rounded p-1 relative
                ${day.isCurrentMonth 
                  ? hasStats 
                    ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300 shadow-sm' 
                    : 'bg-white border-gray-300 shadow-sm'
                  : 'bg-gray-50 text-gray-300 border-gray-100'
                }
                ${isToday ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                transition-all duration-200 hover:shadow-md
              `}
            >
              {/* 날짜 - 왼쪽 위 */}
              <div className={`font-semibold text-sm ${
                index % 7 === 0 ? 'text-red-500' : 
                index % 7 === 6 ? 'text-blue-500' : 
                day.isCurrentMonth ? 'text-gray-800' : 'text-gray-300'
              }`}>
                {day.date.getDate()}
              </div>
              
              {/* 실적 - 오른쪽 아래 */}
              {hasStats && day.stats && (
                <div className="absolute bottom-1 right-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-purple-200">
                  <div className="text-xs font-bold text-purple-700">
                    {day.stats.correct_answers}/{day.stats.total_attempts}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="text-center mt-4">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-purple-400 border-r-transparent"></div>
          <p className="text-xs text-gray-500 mt-1">데이터 로딩 중...</p>
        </div>
      )}
    </div>
  );
}
