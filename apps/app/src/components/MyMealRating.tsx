import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Supabase 클라이언트 초기화
const supabase = createClientComponentClient();

interface MyMealRatingProps {
  mealId: string;
}

/**
 * 급식 전체에 대한 평균 평점을 표시하는 컴포넌트
 * 평균 평점은 "(4.2)" 형식으로 표시됨
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // 평균 평점 조회 함수
  const fetchAverageRating = async () => {
    if (!mealId) return;

    try {
      // meal_rating_stats 테이블에서 평균 평점 조회
      const { data, error } = await supabase
        .from('meal_rating_stats')
        .select('avg_rating')
        .eq('meal_id', mealId)
        .maybeSingle();

      if (error) {
        console.error('평점 조회 오류:', error.message);
        return;
      }

      // 평점이 있으면 상태 업데이트
      if (data && data.avg_rating) {
        setAvgRating(data.avg_rating);
      }
    } catch (error) {
      console.error('평점 조회 중 오류 발생:', error);
    }
  };

  // 컴포넌트 마운트 시와 mealId 변경 시 평점 조회
  useEffect(() => {
    fetchAverageRating();
  }, [mealId]);

  // 평점이 있을 때만 표시
  if (avgRating === null) {
    return <div className="text-lg font-medium my-2">오늘 나의 평가는?</div>;
  }

  // 평점이 있으면 "(4.2)" 형식으로 표시
  return (
    <div className="text-lg font-medium my-2">
      오늘 나의 평가는? ({avgRating.toFixed(1)})
    </div>
  );
};

export default MyMealRating;
