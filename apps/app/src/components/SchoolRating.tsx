'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface SchoolRatingProps {
  schoolCode: string;
  mealId: string; // 급식 ID 추가
  className?: string;
}

interface GradeRatingStats {
  grade1_avg: number | null;
  grade1_count: number;
  grade2_avg: number | null;
  grade2_count: number;
  grade3_avg: number | null;
  grade3_count: number;
  grade4_avg: number | null;
  grade4_count: number;
  grade5_avg: number | null;
  grade5_count: number;
  grade6_avg: number | null;
  grade6_count: number;
}

export default function SchoolRating({ schoolCode, mealId, className = '' }: SchoolRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [schoolName, setSchoolName] = useState<string>('');
  const [gradeRatings, setGradeRatings] = useState<GradeRatingStats | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSchoolRating() {
      if (!schoolCode) return;

      try {
        // 학교 정보 가져오기 - meal_rating_stats 테이블에서 학교별 평균 활용
        const { data: mealRatingData, error: mealRatingError } = await supabase
          .from('meal_rating_stats')
          .select(`
            avg_rating, 
            rating_count, 
            grade1_avg, 
            grade1_count,
            grade2_avg, 
            grade2_count,
            grade3_avg, 
            grade3_count,
            grade4_avg, 
            grade4_count,
            grade5_avg, 
            grade5_count,
            grade6_avg, 
            grade6_count
          `)
          .eq('school_code', schoolCode)
          .eq('meal_id', mealId) // 급식 ID로 필터링 추가
          .order('updated_at', { ascending: false })
          .limit(1);

        if (mealRatingError) {
          console.error('별점 통계 데이터를 가져오는 중 오류 발생:', mealRatingError);
          return;
        }

        if (mealRatingData && mealRatingData.length > 0) {
          // 데이터가 있으면 사용
          setRating(mealRatingData[0].avg_rating ? parseFloat(mealRatingData[0].avg_rating.toFixed(1)) : 0);
          setRatingCount(mealRatingData[0].rating_count || 0);
          
          // 학년별 통계 데이터 설정
          setGradeRatings({
            grade1_avg: mealRatingData[0].grade1_avg,
            grade1_count: mealRatingData[0].grade1_count || 0,
            grade2_avg: mealRatingData[0].grade2_avg,
            grade2_count: mealRatingData[0].grade2_count || 0,
            grade3_avg: mealRatingData[0].grade3_avg,
            grade3_count: mealRatingData[0].grade3_count || 0,
            grade4_avg: mealRatingData[0].grade4_avg,
            grade4_count: mealRatingData[0].grade4_count || 0,
            grade5_avg: mealRatingData[0].grade5_avg,
            grade5_count: mealRatingData[0].grade5_count || 0,
            grade6_avg: mealRatingData[0].grade6_avg,
            grade6_count: mealRatingData[0].grade6_count || 0
          });
        } else {
          // 데이터가 없으면 0으로 초기화
          setRating(0);
          setRatingCount(0);
          setGradeRatings(null);
        } 
      } catch (e) {
        console.error('별점 데이터 조회 중 오류:', e);
        // 오류 발생시 0으로 초기화
        setRating(0);
        setRatingCount(0);
      }
    }

    fetchSchoolRating();

    // 실시간 업데이트를 위한 구독 설정
    if (!schoolCode || !mealId) return;
    
    console.log(`실시간 구독 설정: meal_rating_stats:${schoolCode}:${mealId}`);
    const channel = supabase
      .channel(`meal_rating_stats:${schoolCode}:${mealId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'meal_rating_stats',
          filter: `school_code=eq.${schoolCode} AND meal_id=eq.${mealId}`
        }, 
        (payload) => {
          console.log('실시간 업데이트 수신:', payload);
          if (payload.new) {
            // 새 데이터로 상태 업데이트
            setRating(payload.new.avg_rating ? parseFloat(payload.new.avg_rating.toFixed(1)) : 0);
            setRatingCount(payload.new.rating_count || 0);
            
            // 학년별 통계 데이터 설정
            setGradeRatings({
              grade1_avg: payload.new.grade1_avg,
              grade1_count: payload.new.grade1_count || 0,
              grade2_avg: payload.new.grade2_avg,
              grade2_count: payload.new.grade2_count || 0,
              grade3_avg: payload.new.grade3_avg,
              grade3_count: payload.new.grade3_count || 0,
              grade4_avg: payload.new.grade4_avg,
              grade4_count: payload.new.grade4_count || 0,
              grade5_avg: payload.new.grade5_avg,
              grade5_count: payload.new.grade5_count || 0,
              grade6_avg: payload.new.grade6_avg,
              grade6_count: payload.new.grade6_count || 0
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('구독 상태:', status);
      });
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('실시간 구독 해제');
      supabase.removeChannel(channel);
    };
  }, [schoolCode, mealId, supabase]);

  // 별점에 따른 별 아이콘 생성 (SVG 사용)
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // 꽉 찬 별
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    // 반 별 - 고유한 ID 사용
    if (hasHalfStar) {
      // 학교 코드를 사용하여 고유한 gradient ID 생성
      const gradientId = `half-gradient-${schoolCode}`;
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    // 빈 별
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300 fill-current" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    return stars;
  };

  if (!rating) return null;

  return (
    <div className={`flex flex-col py-1.5 px-1 ${className} bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-indigo-100 rounded-full p-1 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="font-medium text-sm text-gray-700">전교생 평균</span>
          <span className="ml-2 text-lg font-bold text-indigo-700">{rating}</span>
          <div className="flex items-center ml-1 space-x-0.5">
            {renderStars(rating || 0)}
          </div>
          <span className="ml-1 text-xs text-gray-500">({ratingCount}명)</span>
        </div>
      </div>
      
      {gradeRatings && (
        <div className="flex items-center justify-start mt-1 overflow-x-auto space-x-2 text-xs pb-1">
          {[1, 2, 3, 4, 5, 6].map(grade => {
            const avgRating = gradeRatings[`grade${grade}_avg` as keyof GradeRatingStats] as number | null;
            const count = gradeRatings[`grade${grade}_count` as keyof GradeRatingStats] as number;
            
            // 평점이 있고 참여자가 있는 학년만 표시
            if (avgRating && count > 0) {
              return (
                <div key={grade} className="flex items-center bg-white rounded-full px-1.5 py-0.5 border border-indigo-100">
                  <span className="font-medium text-gray-600">[{grade}학년]</span>
                  <span className="ml-1 font-bold text-indigo-600">{avgRating.toFixed(1)}</span>
                  <span className="ml-1 text-gray-400">({count})</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
