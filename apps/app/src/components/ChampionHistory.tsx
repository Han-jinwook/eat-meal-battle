"use client";

import React, { useState, useEffect } from 'react';
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
}

const ChampionHistory: React.FC<ChampionHistoryProps> = ({ 
  currentMonth = new Date() 
}) => {
  const [championStats, setChampionStats] = useState<ChampionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApiCalling, setIsApiCalling] = useState(false);
  const { userSchool } = useUserSchool();

  // 장원 통계 데이터 가져오기
  const fetchChampionStats = useCallback(async () => {
    if (!userSchool?.school_code || isApiCalling) {
      console.log('❌ API 호출 차단:', { userSchool: !!userSchool, isApiCalling });
      return;
    }
    
    console.log('🔄 장원 통계 API 호출 시작:', { school: userSchool.school_code });
    setIsApiCalling(true);
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const stats: ChampionStats[] = [];
      const userId = session.data.session.user.id;
      
      // 주별 통계 (1-4주) - GET 방식으로 변경
      const weeklyPromises = [1, 2, 3, 4].map(async (week) => {
        try {
          const params = new URLSearchParams({
            user_id: userId,
            school_code: userSchool.school_code,
            grade: String(userSchool.grade || 1),
            year: String(currentMonth.getFullYear()),
            month: String(currentMonth.getMonth() + 1),
            week_number: String(week),
            period_type: 'weekly'
          })

          const response = await fetch(`/api/champion/calculate?${params.toString()}`)

          if (!response.ok) {
            console.warn(`주 ${week} 통계 조회 실패:`, response.status, await response.text())
            return { week, is_champion: false, error: true }
          }

          const result = await response.json()
          console.log(`🔍 주 ${week} API 응답:`, result)
          
          const data = result.data || {}
          return {
            week,
            is_champion: data.is_champion || false,
            total_meal_days: data.total_meal_days || 0,
            correct_count: data.correct_count || 0
          }
        } catch (error) {
          console.warn(`주 ${week} 통계 조회 예외:`, error)
          return { week, is_champion: false, error: true }
        }
      })

      // 월별 통계 - GET 방식으로 변경
      const monthlyPromise = (async () => {
        try {
          const params = new URLSearchParams({
            user_id: userId,
            school_code: userSchool.school_code,
            grade: String(userSchool.grade || 1),
            year: String(currentMonth.getFullYear()),
            month: String(currentMonth.getMonth() + 1),
            period_type: 'monthly'
          })

          const response = await fetch(`/api/champion/calculate?${params.toString()}`)

          if (!response.ok) {
            console.warn('월별 통계 조회 실패:', response.status, await response.text())
            return { is_champion: false, error: true }
          }

          const result = await response.json()
          console.log('🔍 월별 API 응답:', result)
          
          const data = result.data || {}
          return {
            is_champion: data.is_champion || false,
            total_meal_days: data.total_meal_days || 0,
            correct_count: data.correct_count || 0
          }
        } catch (error) {
          console.warn('월별 통계 조회 예외:', error)
          return { is_champion: false, error: true }
        }
      })()

      // 모든 요청 병렬 처리
      const [weeklyResults, monthlyResult] = await Promise.all([
        Promise.all(weeklyPromises),
        monthlyPromise
      ])

      console.log('📊 주별 통계 결과:', weeklyResults)
      console.log('📊 월별 통계 결과:', monthlyResult)

      // 주별 통계 데이터 가공
      const weeklyStats = weeklyResults.map((result) => {
        return {
          period_type: 'weekly',
          period_label: `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월 ${result.week}주`,
          my_record: result.is_champion ? '주장원' : 'pass',
          me_count: result.is_champion ? 1 : 0,
          class_count: 0, // TODO: API에서 반별 통계 추가 필요
          grade_count: 0, // TODO: API에서 학년별 통계 추가 필요
          school_count: 0, // TODO: API에서 학교별 통계 추가 필요
          total_meal_days: result.total_meal_days || 0,
          total_students: 0 // TODO: 추가 필요
        }
      })

      // 월별 통계 데이터 가공
      const monthlyStats = {
        period_type: 'monthly',
        period_label: `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월 전체`,
        my_record: monthlyResult.is_champion ? '월장원' : 'pass',
        me_count: monthlyResult.is_champion ? 1 : 0,
        class_count: 0, // TODO: API에서 반별 통계 추가 필요
        grade_count: 0, // TODO: API에서 학년별 통계 추가 필요
        school_count: 0, // TODO: API에서 학교별 통계 추가 필요
        total_meal_days: monthlyResult.total_meal_days || 0,
        total_students: 0 // TODO: 추가 필요
      }

      setChampionStats([...weeklyStats, monthlyStats])
      
    } catch (error) {
      console.error('장원 통계 조회 오류:', error);
      setChampionStats([]); // 오류 시 빈 배열로 초기화
    } finally {
      setLoading(false);
      setIsApiCalling(false);
      console.log('✅ 장원 통계 API 호출 완료');
    }
  }, [currentMonth.getFullYear(), currentMonth.getMonth(), userSchool?.school_code]);

  // 데이터 로드 - 안전한 의존성 배열로 무한 루프 방지
  useEffect(() => {
    if (userSchool?.school_code && !isApiCalling) {
      fetchChampionStats();
    }
  }, [fetchChampionStats, userSchool?.school_code, isApiCalling]);

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
        <div className="text-center py-8 text-gray-500">
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
            <tr className="bg-gray-50">
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
                    <span className="text-gray-500">pass</span>
                  )}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500">
                  {stat.class_count}명 / {stat.total_students || 0}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500">
                  {stat.grade_count}명 / {stat.total_students || 0}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-500">
                  {stat.school_count}명 / {stat.total_students || 0}
                </td>
              </tr>
            ))}
            
            {/* 빈 행들 채우기 */}
            {Array.from({ length: Math.max(0, 5 - championStats.length) }, (_, index) => (
              <tr key={`empty-${index}`}>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300">-</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-300">-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 범례 */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>🏆 주장원: 해당 주 급식일수만큼 모두 정답 | 👑 월장원: 해당 월 급식일수만큼 모두 정답</p>
        <p>* 반/학년/학교 통계는 추후 업데이트 예정</p>
      </div>
    </div>
  );
};

export default ChampionHistory;
