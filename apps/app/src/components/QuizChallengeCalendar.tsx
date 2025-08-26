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

interface CalendarDay {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasQuiz: boolean;
  isCorrect: boolean;
  isHoliday: boolean;
  hasMeal: boolean;
  weekLabel?: string;
}

interface QuizChallengeCalendarProps {
  currentQuizDate?: string;
  onDateSelect?: (date: string) => void;
  onRefreshNeeded?: () => void;
  onMonthChange?: (month: Date) => void; // 월 변경 콜백 추가
  viewingUserId?: string; // For viewing shared quizzes
}

const QuizChallengeCalendar: React.FC<QuizChallengeCalendarProps> = ({ 
  currentQuizDate, 
  onDateSelect,
  onRefreshNeeded,
  onMonthChange,
  viewingUserId 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5, 1)); // 6월
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [weeklyTrophies, setWeeklyTrophies] = useState<WeeklyTrophy[]>([]);
  const [championCriteria, setChampionCriteria] = useState<any>(null);
  const [monthlyTrophy, setMonthlyTrophy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<{[key: string]: string}>({});
  const [monthlyStats, setMonthlyStats] = useState({ correct: 0, total: 0 });
  const [previousMonthStats, setPreviousMonthStats] = useState({ correct: 0, total: 0, month: 0 });
  
  const { userSchool } = useUserSchool();

  // 한국 공휴일 API에서 데이터 가져오기
  useEffect(() => {
    const fetchHolidays = async () => {
      const currentYear = currentMonth.getFullYear();
      const currentMonthNum = currentMonth.getMonth() + 1;
      const holidayMap: {[key: string]: string} = {};
      
      try {
        // 현재 월과 다음 월의 공휴일 데이터를 가져옴 (캘린더에 표시되는 범위)
        const monthsToFetch = [currentMonthNum];
        if (currentMonthNum === 12) {
          monthsToFetch.push(1); // 12월이면 다음해 1월도 가져옴
        } else {
          monthsToFetch.push(currentMonthNum + 1);
        }
        
        for (const month of monthsToFetch) {
          const year = month === 1 && currentMonthNum === 12 ? currentYear + 1 : currentYear;
          const response = await fetch(`/api/holidays?year=${year}&month=${month.toString().padStart(2, '0')}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.holidays) {
              data.holidays.forEach((holiday: any) => {
                const dateStr = holiday.locdate.toString();
                const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                holidayMap[formattedDate] = holiday.dateName;
              });
            }
          }
        }
      } catch (error) {
        console.error('공휴일 데이터 로드 실패:', error);
        // Fallback: 기본 공휴일 데이터
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
          holidayMap['2025-10-06'] = '추석연휴';
          holidayMap['2025-10-07'] = '추석';
          holidayMap['2025-10-08'] = '추석연휴';
          holidayMap['2025-10-03'] = '개천절';
          holidayMap['2025-10-09'] = '한글날';
          holidayMap['2025-12-25'] = '크리스마스';
        }
      }
      
      setHolidays(holidayMap);
    };
    
    fetchHolidays();
  }, [currentMonth]);

  // 퀴즈 결과 데이터 가져오기
  const fetchCalendarData = async (year: number, month: number) => {
    if (!userSchool) return;
    
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;
      
      // 관람 모드일 때는 관람 대상 사용자의 학교 정보를 가져와야 함
      let targetSchoolInfo = userSchool;
      if (viewingUserId) {
        const { data: viewingSchoolData } = await supabase
          .from('school_infos')
          .select('school_code, grade')
          .eq('user_id', viewingUserId)
          .single();
          
        if (viewingSchoolData) {
          targetSchoolInfo = {
            ...userSchool,
            school_code: viewingSchoolData.school_code,
            grade: viewingSchoolData.grade
          };
        }
      }

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
        .eq('school_code', targetSchoolInfo.school_code)
        .gte('meal_date', formatLocalDate(startDate))
        .lte('meal_date', formatLocalDate(endDate));
        
      if (mealMenusError) {
        console.error('급식 메뉴 조회 오류:', mealMenusError);
      }
      
      // 1.5 주차 기준일(토요일) 정보 및 월별 급식일수 조회 (champion_criteria 테이블)
      const { data: weekCriteria, error: criteriaError } = await supabase
        .from('champion_criteria')
        .select(`
          week_1_saturday, 
          week_2_saturday, 
          week_3_saturday, 
          week_4_saturday, 
          week_5_saturday,
          month_total
        `)
        .eq('school_code', targetSchoolInfo.school_code)
        .eq('year', year)
        .eq('month', month + 1) // JavaScript의 month는 0부터 시작하므로 +1
        .single();
        
      if (criteriaError && criteriaError.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('주차 기준일 조회 오류:', criteriaError);
      }
      
      console.log('조회된 주차별 토요일 정보:', weekCriteria);
      
      // 주차별 토요일 정보 상태 업데이트
      setChampionCriteria(weekCriteria || null);
      
      // 2. 장원 기록 조회 (user_champion_records 테이블)
      // 관람 모드일 때는 관람 대상 사용자의 데이터를 조회
      const targetUserId = viewingUserId || session.data.session.user.id;
      const { data: championData, error: championError } = await supabase
        .from('user_champion_records')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('grade', targetSchoolInfo.grade)
        .eq('year', year)
        .eq('month', month + 1) // JavaScript의 month는 0부터 시작하므로 +1
        .single();

      if (championError && championError.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('장원 기록 조회 오류:', championError);
      }
      
      // 3. 퀴즈 통계 조회 (quiz_champions 테이블) - 일별 결과 포함
      const { data: quizStats, error: statsError } = await supabase
        .from('quiz_champions')
        .select(`
          *,
          day_1, day_2, day_3, day_4, day_5, day_6, day_7, day_8, day_9, day_10,
          day_11, day_12, day_13, day_14, day_15, day_16, day_17, day_18, day_19, day_20,
          day_21, day_22, day_23, day_24, day_25, day_26, day_27, day_28, day_29, day_30, day_31,
          week_1_correct, week_2_correct, week_3_correct, week_4_correct, week_5_correct, 
          month_correct, total_count
        `)
        .eq('user_id', targetUserId)
        .eq('year', year)
        .eq('month', month + 1)
        .single();
        
      if (statsError && statsError.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('퀴즈 통계 조회 오류:', statsError);
      }
      
      console.log('조회된 퀴즈 결과 (quiz_champions):', quizStats);
      console.log('조회된 장원 기록:', championData);
      console.log('조회된 급식 메뉴:', mealMenus);
      console.log('조회된 주차별 토요일:', weekCriteria);
      
      // 4. 퀴즈 결과 처리 - quiz_champions 테이블의 day_N 필드 사용
      const processedResults: QuizResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        const dayOfMonth = currentDate.getDate();
        
        // quiz_champions 테이블의 day_N 필드에서 퀴즈 결과 가져오기
        const dayFieldName = `day_${dayOfMonth}` as keyof typeof quizStats;
        const quizResult = quizStats?.[dayFieldName] as string | null;
        
        // 디버깅: 1일, 2일 데이터 확인
        if (dayOfMonth === 1 || dayOfMonth === 2) {
          console.log(`퀴즈 결과 디버깅 - ${dateStr}:`, {
            dayOfMonth,
            dayFieldName,
            quizResult,
            quizStats: quizStats ? 'exists' : 'null'
          });
        }
        
        // 퀴즈 결과 해석: 'O' = 정답, 'X' = 오답, null/undefined = 퀴즈 없음
        const hasQuiz = quizResult === 'O' || quizResult === 'X';
        const isCorrect = quizResult === 'O';
        
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
          is_correct: isCorrect,
          has_quiz: hasQuiz,
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
      
      // 관람 모드일 때는 관람 대상 사용자의 데이터를 조회
      const targetUserId = viewingUserId || session.data.session.user.id;
      console.log('월별 통계 조회:', year, displayMonth, '사용자:', targetUserId);
      
      const { data, error } = await supabase
        .from('quiz_champions')
        .select('month_correct, total_count')
        .eq('user_id', targetUserId)
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
          onMonthChange?.(selectedMonth); // 부모 컴포넌트에 월 변경 알림
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

  // viewingUserId 변경 시 데이터 새로고침
  useEffect(() => {
    if (userSchool) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      console.log('👀 관람 모드 변경 감지:', { viewingUserId, year, month: month + 1 });
      
      // 관람 모드 변경 시 모든 데이터 새로고침
      fetchCalendarData(year, month);
      fetchMonthlyStats(year, month);
      
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      fetchPreviousMonthStats(prevYear, prevMonth);
    }
  }, [viewingUserId, userSchool, currentMonth]);

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
    
    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);
    
    // 주차별 토요일 날짜 매핑 객체 생성 (DB에서 가져온 정보)
    const weekSaturdays: {[key: string]: string} = {};
    
    // champion_criteria 테이블에서 가져온 주차별 토요일 정보
    if (championCriteria) {
      for (let week = 1; week <= 5; week++) {
        const fieldName = `week_${week}_saturday` as keyof typeof championCriteria;
        const saturdayDate = championCriteria[fieldName] as string | null;
        
        if (saturdayDate) {
          weekSaturdays[saturdayDate] = `${month + 1}월${week}주차`;
        }
      }
    }
    
    // 6주 * 7일 = 42일
    for (let i = 0; i < 42; i++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const quizResult = quizResults.find(r => r.date === dateStr);
      
      // 주차 레이블 확인 - champion_criteria 테이블의 토요일 날짜와 비교
      let weekLabel = weekSaturdays[dateStr] || undefined;
      
      days.push({
        day: currentDate.getDate(),
        dateStr,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === today.toDateString(),
        isSelected: dateStr === currentQuizDate,
        hasQuiz: quizResult?.has_quiz || false,
        isCorrect: quizResult?.is_correct || false,
        isHoliday: !!holidays[dateStr],
        hasMeal: quizResult?.has_meal || false, // 급식 정보 유무 추가
        weekLabel // 주차 레이블 추가
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
      onMonthChange?.(newMonth); // 부모 컴포넌트에 월 변경 알림
    }
    
    // 날짜 선택 (퀴즈 유무 관계없이 모든 날짜 선택 가능)
    if (onDateSelect) {
      console.log('📍 날짜 선택:', day.dateStr);
      onDateSelect(day.dateStr);
    }
  };

  // 월 변경 핸들러
  const handlePrevMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth); // 부모 컴포넌트에 월 변경 알림
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth); // 부모 컴포넌트에 월 변경 알림
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
            ( {monthlyStats.correct}/{championCriteria?.month_total || monthlyStats.total}개 맞음 )
          </div>
          
          {/* 월 표시 */}
          <div className="text-xl font-bold text-blue-700">
            {currentMonth.getMonth() + 1}월
          </div>
          
          {/* 월장원 트로피 공간 */}
          <div className="w-8 h-8 flex items-center justify-center">
            {championCriteria?.month_total > 0 && monthlyStats.correct === championCriteria.month_total && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M3 19L12 15L21 19V21H3V19Z" fill="#4B5563" stroke="#000" strokeWidth="1"/>
                <path d="M12 15L21 11L12 7L3 11L12 15Z" fill="#6B7280" stroke="#000" strokeWidth="1"/>
                <circle cx="21" cy="16" r="1.5" fill="#DC2626"/>
                <path d="M21 17.5L21 20" stroke="#DC2626" strokeWidth="1.5"/>
                {/* 장식 */}
                <path d="M12 7L12 3L10 4L12 5L14 4L12 3Z" fill="#F59E0B" stroke="#000" strokeWidth="0.5"/>
                <path d="M9 5L11 6L13 5L15 6L13 7L11 6L9 7L11 6Z" fill="#F59E0B" stroke="#000" strokeWidth="0.5"/>
              </svg>
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
            // 주장원 트로피 열 - 해당 주차의 토요일을 찾기 위한 좀더 효율적인 로직
            // 이 주의 토요일은 인덱스 6에 있음 (0=일요일, 6=토요일)
            const saturdayIndex = Math.floor(index / 8) * 7 + 6;
            const saturdayDay = saturdayIndex < calendarDays.length ? calendarDays[saturdayIndex] : null;
            
            // 주차 번호와 트로피 정보
            let weekNumber = null;
            let weeklyTrophy = null;
            
            // 토요일이 있고 해당 월의 토요일이면 그 주차 정보 가져오기
            if (saturdayDay && saturdayDay.isCurrentMonth && saturdayDay.weekLabel) {
              // 주차 레이블에서 번호 추출 ("7월1주차" -> 1)
              const labelMatch = saturdayDay.weekLabel.match(/([0-9])주차/);
              if (labelMatch && labelMatch[1]) {
                weekNumber = parseInt(labelMatch[1]);
                // 주차 번호에 맞는 트로피 찾기 (1부터 시작하므로 -1)
                weeklyTrophy = weeklyTrophies[weekNumber - 1];
                
                // 디버깅
                console.log(`트로피 열 ${weekIndex}: 토요일=${saturdayDay.dateStr}, 주차=${weekNumber}, 트로피=`, weeklyTrophy);
              }
            }
            
            return (
              <div
                key={`trophy-${weekIndex}`}
                className="h-16 border border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg flex items-center justify-center"
              >
                {/* 트로피 표시 - 해당 주차의 트로피 정보가 있는 경우만 표시 */}
                {weeklyTrophy && weeklyTrophy.earned && (
                  <div title={`${weekNumber}주차 장원`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M3 19L12 15L21 19V21H3V19Z" fill="#4B5563" stroke="#000" strokeWidth="1"/>
                      <path d="M12 15L21 11L12 7L3 11L12 15Z" fill="#6B7280" stroke="#000" strokeWidth="1"/>
                      <circle cx="21" cy="16" r="1.5" fill="#000"/>
                      <path d="M21 17.5L21 20" stroke="#000" strokeWidth="1"/>
                    </svg>
                  </div>
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
                <div className="absolute inset-0 flex items-center justify-center mt-1">
                  {day.isCorrect ? (
                    <img 
                      src="/images/quiz-correct.png" 
                      alt="정답" 
                      className="w-8 h-8 transform rotate-12 drop-shadow-sm"
                    />
                  ) : (
                    <img 
                      src="/images/quiz-incorrect.png" 
                      alt="오답" 
                      className="w-8 h-8 transform -rotate-12 drop-shadow-sm"
                    />
                  )}
                </div>
              )}
              
              {/* 주차 레이블 표시 (토요일) - PC에서만 표시 */}
              {day.weekLabel && day.isCurrentMonth && (
                <span className="hidden lg:block absolute bottom-0.5 right-0.5 text-[10px] font-medium bg-gray-100/80 px-1 py-0.5 rounded-sm text-gray-500 shadow-sm max-w-[calc(100%-4px)] truncate">
                  {day.weekLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizChallengeCalendar;
