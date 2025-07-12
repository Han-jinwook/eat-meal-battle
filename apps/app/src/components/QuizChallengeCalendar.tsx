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
  has_meal: boolean; // 급식 정보 유무 추가
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
      
      // 1. 급식 정보 조회 (meal_menus 테이블)
      const { data: mealMenus, error: mealMenusError } = await supabase
        .from('meal_menus')
        .select('meal_date, menu_items')
        .eq('school_code', userSchool.school_code)
        .gte('meal_date', formatLocalDate(startDate))
        .lte('meal_date', formatLocalDate(endDate));
        
      if (mealMenusError) {
        console.error('급식 메뉴 조회 오류:', mealMenusError);
      }
      
      // 2. 퀴즈 결과 조회
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

      // 2. 장원 기록 조회 (user_champion_records 테이블)
      const { data: championData, error: championError } = await supabase
        .from('user_champion_records')
        .select('*')
        .eq('user_id', session.data.session.user.id)
        .eq('grade', userSchool.grade)
        .eq('year', year)
        .eq('month', month + 1) // JavaScript의 month는 0부터 시작하므로 +1
        .single();

      if (championError && championError.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('장원 기록 조회 오류:', championError);
      }
      
      // 3. 퀴즈 통계 조회 (quiz_champions 테이블)
      const { data: quizStats, error: statsError } = await supabase
        .from('quiz_champions')
        .select('*')
        .eq('user_id', session.data.session.user.id)
        // school_code 컬럼이 존재하지 않으므로 제거
        .eq('grade', userSchool.grade)
        .eq('year', year)
        .eq('month', month + 1)
        .single();
        
      if (statsError && statsError.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('퀴즈 통계 조회 오류:', statsError);
      }
      
      console.log('조회된 퀴즈 결과:', results);
      console.log('조회된 장원 기록:', championData);
      console.log('조회된 급식 메뉴:', mealMenus);
      
      // 4. 퀴즈 결과 처리
      const processedResults: QuizResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        const result = results?.find((r: any) => r.meal_quizzes.meal_date === dateStr);
        
        // 주말과 공휴일 확인
        const dayOfWeek = currentDate.getDay(); // 0=일요일, 6=토요일
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = !!holidays[dateStr];
        
        let hasMeal = true; // 기본값: 표시 안 함
        
        // 주말이나 공휴일이 아닌 경우에만 급식 조회
        if (!isWeekend && !isHoliday) {
          // meal_menus에서 해당 날짜 찾기
          const mealMenu = mealMenus?.find((m: any) => m.meal_date === dateStr);
          
          // 급식 유무 판단: 
          // 1. meal_menus에 레코드가 없으면 → 아직 급식정보를 가져오지 않은 상태이므로 표시 안 함 (hasMeal = true 유지)
          // 2. meal_menus에 레코드가 있고, menu_items에 "급식 정보가 없습니다"가 포함되어 있으면 → "급식 없음" 표시 (hasMeal = false)
          // 3. meal_menus에 레코드가 있고, menu_items에 "급식 정보가 없습니다"가 없으면 → 표시 안 함 (hasMeal = true)
          if (mealMenu) {
            const menuItems = mealMenu.menu_items || '';
            if (menuItems.includes('급식 정보가 없습니다')) {
              hasMeal = false; // "급식 없음" 표시
            } else {
              hasMeal = true;  // 표시 안 함
            }
          }
          // mealMenu가 없으면 hasMeal = true 유지 (표시 안 함)
        }
        processedResults.push({
          date: dateStr,
          is_correct: result?.is_correct || false,
          has_quiz: !!result,
          has_meal: hasMeal
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      setQuizResults(processedResults);
      
      // 4. 주간 트로피 정보 설정 (DB 기반)
      const trophies: WeeklyTrophy[] = [];
      
      // 최대 6주차까지 처리
      for (let week = 1; week <= 6; week++) {
        // 장원 여부 확인
        const weekChampionField = `week_${week}_champion` as keyof typeof championData;
        const isChampion = championData ? !!championData[weekChampionField] : false;
        
        // DB에서 가져온 주차별 정답 수와 총 퀴즈 수
        const weekCorrectField = `week_${week}_correct` as keyof typeof quizStats;
        const weekTotalField = `week_${week}_total` as keyof typeof quizStats;
        
        const correctCount = quizStats && typeof quizStats[weekCorrectField] === 'number' ? quizStats[weekCorrectField] as number : 0;
        const totalCount = quizStats && typeof quizStats[weekTotalField] === 'number' ? quizStats[weekTotalField] as number : 0;
        
        trophies.push({
          week: week,
          earned: isChampion, // DB에서 가져온 장원 여부
          total_correct: correctCount,
          total_available: totalCount
        });
      }
      
      setWeeklyTrophies(trophies);
      
      // 5. 월간 트로피 설정
      setMonthlyTrophy(championData ? !!championData.month_champion : false);
      
    } catch (error) {
      console.error('데이터 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 특정 날짜의 퀴즈 결과 조회 (캘린더 UI 표시용)
  const getQuizResultForDate = (results: QuizResult[], dateStr: string): QuizResult | undefined => {
    return results.find(r => r.date === dateStr);
  };

  // 트로피 계산 함수는 제거 (DB에서 직접 조회하도록 변경)

  // 월별 퀴즈 결과 조회 함수
  const fetchMonthlyStats = async (year: number, month: number) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;
      
      // JavaScript의 month는 0-11이므로 DB 조회용으로 +1 해줌
      const displayMonth = month + 1;
      
      console.log('월별 통계 조회:', year, displayMonth, '사용자:', session.data.session.user.id);
      
      const { data, error } = await supabase
        .from('quiz_champions')
        .select('month_correct, total_count')
        .eq('user_id', session.data.session.user.id)
        .eq('year', year)
        .eq('month', displayMonth)
        .single();
      
      if (error || !data) {
        console.log('월별 통계 데이터 없음:', year, displayMonth);
        setMonthlyStats({ correct: 0, total: 0 });
        return;
      }
      
      console.log('월별 통계 결과:', {
        year,
        month: displayMonth,
        monthCorrect: data.month_correct || 0,
        totalCount: data.total_count || 0,
        data
      });
      
      setMonthlyStats({
        correct: data.month_correct || 0,
        total: data.total_count || 0
      });
    } catch (error) {
      console.error('월별 통계 조회 오류:', error);
      setMonthlyStats({ correct: 0, total: 0 });
    }
  };

  // 월별 통계 조회 useEffect
  useEffect(() => {
    console.log('월별 통계 조회 시작:', currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    fetchMonthlyStats(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth]);

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
  
  // 이전 월 퀴즈 결과 조회 함수
  const fetchPreviousMonthStats = async (year: number, month: number) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session || !userSchool) return;
      
      // JavaScript의 month는 0-11이므로 DB 조회용으로 +1 해줌
      const displayMonth = month + 1;
      
      console.log('이전 월 통계 조회:', year, displayMonth, '사용자:', session.data.session.user.id, '학년:', userSchool.grade);
      
      const query = supabase
        .from('quiz_champions')
        .select('*') // 모든 필드 조회하여 주차별 정답 수 합산
        .eq('user_id', session.data.session.user.id)
        // school_code 컬럼이 존재하지 않으므로 제거
        .eq('grade', userSchool.grade)
        .eq('year', year)
        .eq('month', displayMonth)
        .single();
      
      const { data, error } = await query;
      
      if (error || !data) {
        console.log('이전 월 통계 데이터 없음:', year, displayMonth);
        setPreviousMonthStats({ correct: 0, total: 0, month: displayMonth });
        return;
      }
      
      // 주차별 정답 수 합산
      let totalCorrect = 0;
      let totalQuizzes = 0;
      
      // 최대 6주차까지 합산
      for (let week = 1; week <= 6; week++) {
        const weekCorrectField = `week_${week}_correct` as keyof typeof data;
        const weekTotalField = `week_${week}_total` as keyof typeof data;
        
        if (typeof data[weekCorrectField] === 'number') {
          totalCorrect += data[weekCorrectField] as number;
        }
        
        if (typeof data[weekTotalField] === 'number') {
          totalQuizzes += data[weekTotalField] as number;
        }
      }
      
      setPreviousMonthStats({
        correct: totalCorrect,
        total: totalQuizzes,
        month: displayMonth
      });
    } catch (error) {
      console.error('이전 월 통계 조회 오류:', error);
      setPreviousMonthStats({ correct: 0, total: 0, month: month + 1 });
    }
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
  
  // 월이 변경될 때 데이터 가져오기
  useEffect(() => {
    if (userSchool) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      console.log('📅 월 변경 감지:', { year, month: month + 1 });
      
      // 퀴즈 결과 데이터 가져오기
      fetchCalendarData(year, month);
      
      // 현재 월의 통계 가져오기
      fetchMonthlyStats(year, month);
      
      // 이전 월의 통계 가져오기
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      fetchPreviousMonthStats(prevYear, prevMonth);
    }
  }, [currentMonth, userSchool]);

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
        isHoliday: !!holidays[dateStr],
        hasMeal: quizResult?.has_meal || false // 급식 정보 유무 추가
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
      {/* 헤더 - 컴팩한 가로 배치 디자인 */}
      <div className="text-center mb-6">
        {/* 메인 제목 */}
        <div className="border-4 border-black rounded-lg py-3 px-6 mb-4 inline-block">
          <h2 className="text-xl font-bold text-gray-900 tracking-wide">
            급식퀴즈 챌린지
          </h2>
        </div>
        
        {/* 월 네비게이션 및 성과 표시 - 가로 배치 */}
        <div className="flex items-center justify-center space-x-8">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-2xl font-bold text-gray-600"
          >
            ‹
          </button>
          
          {/* 성과 표시 */}
          <div className="text-lg font-bold text-green-600">
            ( {monthlyStats.correct}/{monthlyStats.total}개 맞음 )
          </div>
          
          {/* 월 표시 */}
          <div className="text-xl font-bold text-blue-700">
            {currentMonth.getMonth() + 1}월
          </div>
          
          {/* 월장원 트로피 공간 */}
          <div className="w-8 h-8 flex items-center justify-center">
            {monthlyStats.total > 0 && monthlyStats.correct === monthlyStats.total && (
              <span className="text-2xl">🏆</span>
            )}
          </div>
          
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-2xl font-bold text-gray-600"
          >
            ›
          </button>
        </div>
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
              
              {/* 급식 정보 없음 표시 */}
              {!day.hasMeal && day.isCurrentMonth && (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-gray-400 text-xs font-medium">
                    <span className="flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="ml-1">급식없음</span>
                    </span>
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
