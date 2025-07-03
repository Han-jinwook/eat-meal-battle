"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';
// import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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
  onRefreshNeeded?: () => void;
}

const QuizChallengeCalendar: React.FC<QuizChallengeCalendarProps> = ({ 
  currentQuizDate, 
  onDateSelect,
  onRefreshNeeded 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5, 1)); // 6월
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [weeklyTrophies, setWeeklyTrophies] = useState<WeeklyTrophy[]>([]);
  const [monthlyTrophy, setMonthlyTrophy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<{[key: string]: string}>({});
  const [monthlyStats, setMonthlyStats] = useState({ correct: 0, total: 0 });
  const [previousMonthStats, setPreviousMonthStats] = useState({ correct: 0, total: 0, month: 0 });
  
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
      
      console.log('퀴즈 결과 조회 범위:', {
        시작일: formatLocalDate(startDate),
        종료일: formatLocalDate(endDate)
      });
      
      const { data: results, error } = await supabase
        .from('quiz_results')
        .select(`
          quiz_id,
          selected_option,
          is_correct,
          meal_quizzes!inner(meal_date)
        `)
        .eq('user_id', session.data.session.user.id)
        .gte('meal_quizzes.meal_date', formatLocalDate(startDate))
        .lte('meal_quizzes.meal_date', formatLocalDate(endDate));

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error);
        return;
      }

      console.log('조회된 퀴즈 결과:', results);
      
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
      
      console.log('처리된 퀴즈 결과:', processedResults);
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
        earned: weekTotal > 0 && weekCorrect === weekTotal, // 해당 주 급식정보 있는 날수 전부 맞추면 수여
        total_correct: weekCorrect,
        total_available: weekTotal
      });
      
      currentWeek++;
      weekStart.setDate(weekStart.getDate() + 7);
      
      if (currentWeek > 6) break; // 최대 6주
    }
    
    return trophies;
  };

  // 월별 퀴즈 결과 조회 함수
  const fetchMonthlyStats = async (year: number, month: number) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session || !userSchool) return;
      
      // 현재 날짜 확인
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // JavaScript의 month는 0-11이므로 DB 조회용으로 +1 해줌
      const displayMonth = month + 1;
      
      const query = supabase
        .from('quiz_champions')
        .select('correct_count, total_count')
        .eq('user_id', session.data.session.user.id)
        .eq('year', year)
        .eq('month', displayMonth);
      
      const { data, error } = await query.single();
      
      if (error || !data) {
        console.log('월별 통계 데이터 없음:', year, displayMonth);
        setMonthlyStats({ correct: 0, total: 0 });
        return;
      }
      
      setMonthlyStats({
        correct: data.correct_count,
        total: data.total_count
      });
    } catch (error) {
      console.error('월별 통계 조회 오류:', error);
      setMonthlyStats({ correct: 0, total: 0 });
    }
  };

  const fetchPreviousMonthStats = async (year: number, month: number) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session || !userSchool) return;
      
      // month는 0부터 시작하므로 +1 해서 실제 월로 변환
      const displayMonth = month + 1;
      
      const { data, error } = await supabase
        .from('quiz_champions')
        .select('correct_count, total_count')
        .eq('user_id', session.data.session.user.id)
        .eq('year', year)
        .eq('month', displayMonth)
        .single();
      
      if (error || !data) {
        console.log('이전 월별 통계 데이터 없음:', year, displayMonth);
        setPreviousMonthStats({ correct: 0, total: 0, month: displayMonth });
        return;
      }
      
      setPreviousMonthStats({
        correct: data.correct_count,
        total: data.total_count,
        month: displayMonth
      });
    } catch (error) {
      console.error('이전 월별 통계 조회 오류:', error);
      setPreviousMonthStats({ correct: 0, total: 0, month: month + 1 });
    }
  };

  useEffect(() => {
    if (userSchool) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      console.log('데이터 조회 시작:', {
        현재년월: `${year}-${month+1}`,
        이전년월: `${month === 0 ? year-1 : year}-${month === 0 ? 12 : month}`
      });
      
      // 퀴즈 결과 데이터 먼저 조회
      fetchCalendarData(year, month);
      
      // 현재 월의 데이터 조회
      fetchMonthlyStats(year, month);
      
      // 이전 월의 데이터 조회 (표시용)
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      fetchPreviousMonthStats(prevYear, prevMonth);
    }
  }, [currentMonth, userSchool]);

  // 선택된 날짜 변경 시 달력 월 자동 업데이트
  useEffect(() => {
    if (currentQuizDate) {
      const selectedDate = new Date(currentQuizDate);
      if (!isNaN(selectedDate.getTime())) {
        const selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        
        // 현재 달력 월과 선택된 날짜의 월이 다르면 달력 월 변경
        if (selectedMonth.getTime() !== currentMonth.getTime()) {
          console.log('🔄 위쪽 날짜 선택에 따른 현황판 월 자동 변경:', {
            이전월: `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`,
            새월: `${selectedMonth.getFullYear()}-${selectedMonth.getMonth() + 1}`,
            선택날짜: currentQuizDate
          });
          setCurrentMonth(selectedMonth);
        }
      }
    }
  }, [currentQuizDate]);

  // 캘린더 데이터 새로고침 함수
  const handleRefresh = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    console.log('🔄 캘린더 데이터 새로고침:', { year, month: month + 1 });
    
    // 퀴즈 결과 데이터 새로고침
    fetchCalendarData(year, month);
    
    // 현재 월의 통계 새로고침
    fetchMonthlyStats(year, month);
    
    // 이전 월의 통계 새로고침
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    fetchPreviousMonthStats(prevYear, prevMonth);
  };

  // 외부에서 새로고침 호출 가능하도록 설정
  useEffect(() => {
    if (onRefreshNeeded) {
      // 전역 참조로 새로고침 함수 노출
      (window as any).refreshQuizCalendar = handleRefresh;
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if ((window as any).refreshQuizCalendar) {
        delete (window as any).refreshQuizCalendar;
      }
    };
  }, [onRefreshNeeded, currentMonth]);

  // 캘린더 그리드 생성
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    
    // 일요일 시작으로 조정
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - dayOfWeek);
    
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

  // 날짜 클릭 핸들러 (월 자동 변경 포함)
  const handleDateClick = (day: any) => {
    console.log('📅 날짜 클릭:', {
      날짜: day.dateStr,
      현재월여부: day.isCurrentMonth,
      퀴즈여부: day.hasQuiz
    });
    
    // 다른 달 날짜 클릭 시 월 변경
    if (!day.isCurrentMonth) {
      const clickedDate = new Date(day.dateStr);
      const newMonth = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
      
      console.log('🔄 월 변경:', {
        이전월: `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`,
        새월: `${newMonth.getFullYear()}-${newMonth.getMonth() + 1}`
      });
      
      setCurrentMonth(newMonth);
    }
    
    // 날짜 선택 (퀴즈 유무 관계없이 모든 날짜 선택 가능)
    if (onDateSelect) {
      console.log('📍 날짜 선택:', day.dateStr);
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
      {/* 헤더 - 깔끔한 중앙 정렬 디자인 */}
      <div className="text-center mb-8">
        {/* 메인 제목 */}
        <div className="border-4 border-black rounded-lg py-4 px-8 mb-6 inline-block">
          <h2 className="text-2xl font-bold text-gray-900 tracking-wide">
            급식퀴즈 챌린지
          </h2>
        </div>
        
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-2xl font-bold text-gray-600"
          >
            ‹
          </button>
          <span className="text-3xl font-bold text-blue-700">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-2xl font-bold text-gray-600"
          >
            ›
          </button>
        </div>
        
        {/* 성과 표시 */}
        <div className="text-lg font-bold text-green-600">
          ( {previousMonthStats.correct}/{previousMonthStats.total}개 맞음 )
        </div>
        
        {/* 월장원 표시 */}
        {previousMonthStats.total > 0 && previousMonthStats.correct === previousMonthStats.total && (
          <div className="text-sm text-yellow-600 font-bold mt-2">
            {previousMonthStats.month}월 장원급제 👑
          </div>
        )}
      </div>
      
      {/* 요일 헤더 */}
      <div className="grid grid-cols-9" style={{ gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1fr 1fr 0.5fr 1fr' }}>
        {['일', '월', '화', '수', '목', '금', '토', '주장원'].map((day, index) => (
          <div 
            key={day} 
            className={`text-center py-2 text-sm font-semibold ${
              index === 0 || index === 6 ? 'text-red-500 text-xs' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
        
      {/* 캘린더 그리드 */}
      <div className="grid gap-1" style={{ gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1fr 1fr 0.5fr 1fr' }}>
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
                {/* 트로피 표시 - 해당 주 급식정보 있는 날수 전부 맞추면 수여 */}
                {weeklyTrophy?.earned && (
                  <span className="text-2xl">🏆</span>
                )}
              </div>
            );
          }
          
          if (dayIndex >= calendarDays.length) {
            return <div key={`empty-${index}`} className="h-16"></div>;
          }
          
          const day = calendarDays[dayIndex];
          const isWeekend = (dayIndex % 7) === 0 || (dayIndex % 7) === 6; // 일요일(0), 토요일(6)
          
          const cellClasses = [
            'h-16 rounded-lg flex flex-col relative transition-all duration-200'
          ];
          
          // 현재 월 날짜만 테두리 적용
          if (day.isCurrentMonth) {
            if (isWeekend) {
              cellClasses.push('border border-red-300 text-red-600');
            } else {
              cellClasses.push('border-2 border-gray-500');
            }
          } else {
            // 가짜 날짜 - 테두리 없이 음영만
            cellClasses.push(
              'bg-gradient-to-br from-gray-50/80 to-gray-100/60', // 은은한 그라데이션
              'backdrop-blur-[0.5px]'                               // 미니멀 블러
            );
          }
          
          // 오늘 날짜
          if (day.isToday && day.isCurrentMonth) {
            cellClasses.push('ring-2 ring-blue-500 bg-blue-100 font-bold');
          }
          
          // 선택된 날짜
          if (day.isSelected) {
            cellClasses.push('ring-2 ring-purple-500 bg-purple-100');
          }
          
          // 모든 날짜 클릭 가능 - 월에 따른 차별화된 호버 효과
          if (day.isCurrentMonth) {
            // 현재 월: 선명한 호버 효과
            cellClasses.push(
              'cursor-pointer',
              'hover:shadow-md hover:scale-[1.05]',
              'hover:bg-white/90',
              'transition-all duration-300 ease-out'
            );
          } else {
            // 다른 월 (가짜 날짜): 은은한 호버 효과
            cellClasses.push(
              'cursor-pointer',
              'hover:shadow-sm hover:scale-[1.02]',
              'hover:bg-gray-200/40 hover:backdrop-blur-sm',
              'transition-all duration-200 ease-in-out'
            );
          }
          
          // 퀴즈가 있는 날짜는 더 강조 (현재 월에만 적용)
          if (day.hasQuiz && day.isCurrentMonth) {
            cellClasses.push('hover:shadow-lg hover:scale-110');
          }
          
          // 공휴일
          if (day.isHoliday && day.isCurrentMonth) {
            cellClasses.push('bg-pink-50 border-0');
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
                day.isToday ? 'text-blue-700 font-bold' : 
                day.isSelected ? 'text-purple-700 font-semibold' :
                !day.isCurrentMonth ? 'text-gray-500/80 font-normal' : 'text-gray-700 font-medium'
              }`}>
                {day.day}
              </span>
              
              {/* 공휴일 표시 - 가운데 */}
              {day.isHoliday && day.isCurrentMonth && (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-xs text-red-500 font-bold">
                    공휴일
                  </div>
                </div>
              )}
              
              {/* 퀴즈 결과 표시 - 선생님 채점 느낌 */}
              {day.hasQuiz && day.isCurrentMonth && (
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
    </div>
  );
};

export default QuizChallengeCalendar;
