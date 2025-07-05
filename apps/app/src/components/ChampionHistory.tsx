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
  const { userSchool } = useUserSchool();

  // 장원 통계 데이터 가져오기
  const fetchChampionStats = async (year: number, month: number) => {
    if (!userSchool) return;
    
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const stats: ChampionStats[] = [];
      const userId = session.data.session.user.id;
      
      // 주장원 통계 (최대 6주까지)
      for (let week = 1; week <= 6; week++) {
        try {
          const response = await fetch('/api/champion/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              school_code: userSchool.school_code,
              grade: userSchool.grade,
              year: year,
              month: month,
              week_number: week,
              period_type: 'weekly'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.total_meal_days > 0) {
              stats.push({
                period_type: 'weekly',
                period_label: `${year}년 ${month}월 ${week}주`,
                my_record: result.data.is_champion ? '주장원' : 'pass',
                me_count: result.data.is_champion ? 1 : 0,
                class_count: 0, // TODO: API에서 반별 통계 추가 필요
                grade_count: 0, // TODO: API에서 학년별 통계 추가 필요
                school_count: 0, // TODO: API에서 학교별 통계 추가 필요
                total_meal_days: result.data.total_meal_days,
                total_students: 0 // TODO: 추가 필요
              });
            }
          }
        } catch (error) {
          console.log(`${week}주차 통계 오류:`, error);
        }
      }
      
      // 월장원 통계
      try {
        const response = await fetch('/api/champion/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            school_code: userSchool.school_code,
            grade: userSchool.grade,
            year: year,
            month: month,
            period_type: 'monthly'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            stats.push({
              period_type: 'monthly',
              period_label: `${year}년 ${month}월 전체`,
              my_record: result.data.is_champion ? '월장원' : 'pass',
              me_count: result.data.is_champion ? 1 : 0,
              class_count: 0, // TODO: API에서 반별 통계 추가 필요
              grade_count: 0, // TODO: API에서 학년별 통계 추가 필요
              school_count: 0, // TODO: API에서 학교별 통계 추가 필요
              total_meal_days: result.data.total_meal_days,
              total_students: 0 // TODO: 추가 필요
            });
          }
        }
      } catch (error) {
        console.log('월장원 통계 오류:', error);
      }
      
      setChampionStats(stats);
      console.log('장원 통계 데이터:', stats);
      
    } catch (error) {
      console.error('장원 통계 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 로드
  useEffect(() => {
    if (userSchool) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      fetchChampionStats(year, month);
    }
  }, [currentMonth, userSchool]);

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
          급식퀴즈 장원
        </h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p>아직 이번 달 급식이 시작되지 않았습니다.</p>
          <p className="text-sm">퀴즈를 풀어보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-bold text-center mb-4 border-2 border-black rounded-lg py-2">
        급식퀴즈 장원
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
