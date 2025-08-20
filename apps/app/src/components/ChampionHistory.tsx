"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import useUserSchool from '@/hooks/useUserSchool';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 장원 통계 인터페이스
interface ChampionStats {
  period_type: 'weekly' | 'monthly';
  period_label: string;
  my_record: string; // "주장원", "월장원", "pass" 등
  me_count: number;
  class_count: number;
  grade_count: number;
  school_count: number;
  total_meal_days: number;
  total_students: number;
}

interface ChampionHistoryProps {
  currentMonth?: Date;
  viewingUserId?: string; // For viewing shared quizzes
}

const ChampionHistory: React.FC<ChampionHistoryProps> = ({ 
  currentMonth = new Date(),
  viewingUserId 
}) => {
  const [championStats, setChampionStats] = useState<ChampionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApiCalling, setIsApiCalling] = useState(false);
  const { userSchool } = useUserSchool();

  // 장원 통계 데이터 가져오기 - quiz_champions 테이블의 day_N 필드를 활용하는 최적화 방식으로 변경
  const fetchChampionStats = useCallback(async () => {
    if (!userSchool?.school_code) {
      console.log('❌ userSchool 정보 없음');
      return;
    }
    
    if (isApiCalling) {
      console.log('❌ 이미 호출 중');
      return;
    }
    
    console.log('🔄 장원 히스토리 조회 시작');
    setIsApiCalling(true);
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

      // 관람 모드일 때는 관람 대상 사용자의 ID 사용
      const userId = viewingUserId || session.data.session.user.id;
      
      // 1. champion_criteria에서 월/주차 정보 가져오기
      const { data: criteriaData } = await supabase
        .from('champion_criteria')
        .select('*')
        .eq('school_code', targetSchoolInfo.school_code)
        .eq('year', currentMonth.getFullYear())
        .eq('month', currentMonth.getMonth() + 1)
        .single();

      // 2. quiz_champions 테이블에서 일별 퀴즈 결과와 통계를 한번에 가져오기 (성능 최적화)
      const { data: quizStats } = await supabase
        .from('quiz_champions')
        .select(`
          *,
          day_1, day_2, day_3, day_4, day_5, day_6, day_7, day_8, day_9, day_10,
          day_11, day_12, day_13, day_14, day_15, day_16, day_17, day_18, day_19, day_20,
          day_21, day_22, day_23, day_24, day_25, day_26, day_27, day_28, day_29, day_30, day_31,
          week_1_correct, week_1_total, week_2_correct, week_2_total, 
          week_3_correct, week_3_total, week_4_correct, week_4_total, 
          week_5_correct, week_5_total, month_correct, total_count
        `)
        .eq('user_id', userId)
        .eq('year', currentMonth.getFullYear())
        .eq('month', currentMonth.getMonth() + 1)
        .single();

      // 3. user_champion_records에서 장원 기록 가져오기
      const { data: myRecords } = await supabase
        .from('user_champion_records')
        .select('*')
        .eq('user_id', userId)
        .eq('school_code', targetSchoolInfo.school_code)
        .eq('grade', targetSchoolInfo.grade)
        .eq('year', currentMonth.getFullYear())
        .eq('month', currentMonth.getMonth() + 1)
        .single();

      // 4. school_champions에서 집계 데이터 가져오기 - 간소화
      const { data: schoolStats } = await supabase
        .from('school_champions')
        .select('*')
        .eq('school_code', targetSchoolInfo.school_code)
        .eq('year', currentMonth.getFullYear())
        .eq('month', currentMonth.getMonth() + 1);
      
      console.log('퀴즈 통계 데이터:', quizStats);
      console.log('장원 기록:', myRecords);
      
      // 5. 주차별 데이터 생성 - quiz_champions에서 바로 주차별 정답 수 활용
      const stats: ChampionStats[] = [];
      const targetMonth = currentMonth.getMonth() + 1; // 1-12
      
      // criteriaData에서 실제 존재하는 주차만 처리하도록 변경
      const availableWeeks = [];
      for (let week = 1; week <= 5; week++) {
        const weekSaturdayField = `week_${week}_saturday` as keyof typeof criteriaData;
        const saturdayDateStr = criteriaData?.[weekSaturdayField] as string;
        const weekDaysField = `week_${week}_days` as keyof typeof criteriaData;
        const weekDays = criteriaData?.[weekDaysField] as number || 0;
        
        // 토요일 날짜가 있고 급식일수가 0보다 크면 유효한 주차
        if (saturdayDateStr && weekDays > 0) {
          availableWeeks.push(week);
        }
      }
      
      // 실제 존재하는 주차만 처리
      for (const week of availableWeeks) {
        // criteriaData에서 해당 주차 급식일수 확인
        const weekDaysField = `week_${week}_days` as keyof typeof criteriaData;
        const weekDays = criteriaData?.[weekDaysField] as number || 0;
        
        // myRecords에서 해당 주차 장원 여부 확인  
        const weekChampionField = `week_${week}_champion` as keyof typeof myRecords;
        const isWeekChampion = myRecords?.[weekChampionField] as boolean || false;
        
        // quiz_champions에서 해당 주차의 정답 수와 총 문제 수 바로 사용
        const weekCorrectField = `week_${week}_correct` as keyof typeof quizStats;
        const weekTotalField = `week_${week}_total` as keyof typeof quizStats;
        const weekCorrect = quizStats?.[weekCorrectField] as number || 0;
        const weekTotal = quizStats?.[weekTotalField] as number || 0;
        
        // school_champions에서 집계 데이터 계산 - 새로운 구조 사용
        const weekStats = schoolStats?.find(s => 
          s.week_number === week && 
          s.grade === targetSchoolInfo.grade
        );
        
        // 우리 반 장원수
        const myClassCount = weekStats?.[`class_${targetSchoolInfo.class}`] || 0;
        
        // 우리 학년 장원수  
        const myGradeCount = weekStats?.grade_total || 0;
        
        // 학교 전체 장원수 (모든 학년 합산)
        const allGradeStats = schoolStats?.filter(s => s.week_number === week) || [];
        const schoolTotal = allGradeStats.reduce((sum, stat) => sum + (stat.grade_total || 0), 0);
        
        // 퀴즈 정답률을 바탕으로 my_record 상태 결정
        let myRecord = '🥊'; // 도전 이모지
        if (isWeekChampion || (weekTotal > 0 && weekCorrect === weekTotal)) {
          myRecord = '🏆'; // 트로피 이모지
        }
        
        stats.push({
          period_type: 'weekly',
          period_label: `${targetMonth}월 ${week}주`,
          my_record: myRecord,
          me_count: weekCorrect,
          class_count: myClassCount,
          grade_count: myGradeCount,  
          school_count: schoolTotal,
          total_meal_days: weekDays,
          total_students: schoolTotal
        });
      }
      
      // 6. 월별 데이터 추가 - quiz_champions에서 바로 월별 정답 수 활용
      const monthDays = criteriaData?.month_total || 0;
      const isMonthChampion = myRecords?.month_champion || false;
      const monthCorrect = quizStats?.month_correct || 0;
      const monthTotal = quizStats?.total_count || 0;
      
      if (monthDays > 0) {
        // 월간 집계 데이터 찾기 - 새로운 구조 사용
        const monthlyStats = schoolStats?.find(s => 
          s.week_number === null && 
          s.grade === targetSchoolInfo.grade
        );
        
        // 우리 반 월장원수
        const monthlyClassCount = monthlyStats?.[`class_${targetSchoolInfo.class}`] || 0;
        
        // 우리 학년 월장원수  
        const monthlyGradeCount = monthlyStats?.grade_total || 0;
        
        // 학교 전체 월장원수 (모든 학년 합산)
        const allMonthlyGradeStats = schoolStats?.filter(s => s.week_number === null) || [];
        const monthlySchoolTotal = allMonthlyGradeStats.reduce((sum, stat) => sum + (stat.grade_total || 0), 0);
        
        // 월간 통계를 바탕으로 my_record 상태 결정
        let myMonthRecord = '🥊'; // 도전 이모지
        if (isMonthChampion || (monthTotal > 0 && monthCorrect === monthTotal)) {
          myMonthRecord = '🏆'; // 트로피 이모지
        }
        
        stats.push({
          period_type: 'monthly',
          period_label: `${currentMonth.getMonth() + 1}월`,
          my_record: myMonthRecord,
          me_count: monthCorrect,
          class_count: monthlyClassCount,
          grade_count: monthlyGradeCount,
          school_count: monthlySchoolTotal,
          total_meal_days: monthDays,
          total_students: monthlySchoolTotal
        });
      }

      console.log('📊 장원 히스토리 결과:', stats);
      setChampionStats(stats);
      
    } catch (error) {
      console.error('장원 통계 조회 오류:', error);
      setChampionStats([]); // 오류 시 빈 배열로 초기화
    } finally {
      setIsApiCalling(false);
      setLoading(false);
      console.log('✅ 장원 통계 조회 완료');
    }
  }, [currentMonth.getFullYear(), currentMonth.getMonth(), userSchool?.school_code, viewingUserId]);

  // 데이터 로드 - 무한 루프 방지를 위한 최적화된 의존성 배열
  useEffect(() => {
    if (userSchool?.school_code) {
      fetchChampionStats();
    }
  }, [fetchChampionStats]); // isApiCalling 제거로 무한 루프 방지

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">장원 히스토리 로딩중...</span>
        </div>
      </div>
    );
  }

  // 통계가 없는 경우
  if (championStats.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
        <h3 className="text-lg font-bold text-center mb-4 border-2 border-black rounded-lg py-2">
          급식장원 History
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-700">
          <div className="text-4xl mb-2">🔍</div>
          <p>장원 데이터를 불러오는 중 문제가 발생했습니다.</p>
          <p className="text-sm">API 응답: {championStats.length}개 항목</p>
          <p className="text-xs text-gray-400 mt-2">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월 데이터 조회 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-bold text-center mb-4 border-2 border-black rounded-lg py-2">
        급식장원 History
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50 dark:bg-white">
              <th className="border border-gray-300 px-3 py-2 text-sm font-semibold">월/주차</th>
              <th className="border border-gray-300 px-3 py-2 text-sm font-semibold">나의 기록</th>
              <th className="border border-gray-300 px-3 py-2 text-sm font-semibold">반</th>
              <th className="border border-gray-300 px-3 py-2 text-sm font-semibold">학년</th>
              <th className="border border-gray-300 px-3 py-2 text-sm font-semibold">학교</th>
            </tr>
          </thead>
          <tbody>
            {championStats.map((stat, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 text-sm text-center">
                  {stat.period_label.replace(`${currentMonth.getFullYear()}년 `, '')}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center">
                  {stat.my_record === '주장원' && (
                    <span className="text-yellow-600 font-bold">🏆 주장원</span>
                  )}
                  {stat.my_record === '월장원' && (
                    <span className="text-purple-600 font-bold">👑 월장원</span>
                  )}
                  {stat.my_record === 'pass' && (
                    <span className="text-indigo-500">💪 도전</span>
                  )}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500 dark:text-gray-700">
                  {stat.class_count}명 / {stat.total_students || 0}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500 dark:text-gray-700">
                  {stat.grade_count}명 / {stat.total_students || 0}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500 dark:text-gray-700">
                  {stat.school_count}명 / {stat.total_students || 0}
                </td>
              </tr>
            ))}
            
            {/* 빈 행들 채우기 */}
            {Array.from({ length: Math.max(0, 5 - championStats.length) }, (_, index) => (
              <tr key={`empty-${index}`}>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300 dark:text-gray-400">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300 dark:text-gray-400">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300 dark:text-gray-400">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300 dark:text-gray-400">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300 dark:text-gray-400">-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 범례 */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-700 text-center">
        <p>🏆 주장원: 해당 주 급식일수만큼 모두 정답 | 👑 월장원: 해당 월 급식일수만큼 모두 정답</p>
        <p>* 반/학년/학교 통계는 추후 업데이트 예정</p>
      </div>
    </div>
  );
};

export default ChampionHistory;
