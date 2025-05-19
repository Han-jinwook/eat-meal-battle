import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import StarRating from './StarRating';

// Supabase 클라이언트 초기화
const supabase = createClientComponentClient();

interface MyMealRatingProps {
  mealId: string;
}

/**
 * 급식 전체에 대한 평균 평점을 표시하고 사용자가 평점을 매길 수 있는 컴포넌트
 * 평균 평점은 "(4.2)" 형식으로 표시됨
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);

  // 내 평점 조회 함수
  const fetchMyRating = async () => {
    if (!mealId || !user) return;

    try {
      console.log('내 급식 평점 조회 시작:', mealId, user.id);
      
      // meal_ratings 테이블에서 내 평점 조회
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('내 평점 조회 오류:', error.message);
        return;
      }

      // 내 평점이 있으면 상태 업데이트
      if (data) {
        console.log('내 평점 찾음:', data.rating);
        setMyRating(data.rating);
      } else {
        console.log('내 평점 없음');
        setMyRating(null);
      }
    } catch (error) {
      console.error('내 평점 조회 중 오류 발생:', error);
    }
  };

  // 평균 평점 조회 함수
  const fetchAverageRating = async () => {
    if (!mealId) return;

    try {
      console.log('급식 평균 평점 조회 시작:', mealId);
      
      // meal_rating_stats 테이블에서 평균 평점 조회
      const { data, error } = await supabase
        .from('meal_rating_stats')
        .select('avg_rating')
        .eq('meal_id', mealId)
        .maybeSingle();

      if (error) {
        console.error('평균 평점 조회 오류:', error.message);
        return;
      }

      // 평균 평점이 있으면 상태 업데이트
      if (data && data.avg_rating) {
        console.log('평균 평점 찾음:', data.avg_rating);
        setAvgRating(data.avg_rating);
      } else {
        console.log('평균 평점 없음');
        setAvgRating(null);
      }
    } catch (error) {
      console.error('평균 평점 조회 중 오류 발생:', error);
    }
  };

  // 평점 저장 함수
  const saveRating = async (rating: number) => {
    if (!mealId || !user) return false;

    try {
      setIsLoading(true);
      console.log('급식 평점 저장 시작:', mealId, user.id, rating);
      
      // meal_ratings 테이블에 평점 저장 (upsert)
      const { error } = await supabase
        .from('meal_ratings')
        .upsert({
          user_id: user.id,
          meal_id: mealId,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,meal_id'
        });

      if (error) {
        console.error('평점 저장 오류:', error.message);
        return false;
      }

      console.log('평점 저장 성공!');
      
      // 저장 성공 후 평점 다시 조회
      await fetchMyRating();
      await fetchAverageRating();
      
      return true;
    } catch (error) {
      console.error('평점 저장 중 오류 발생:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 평점 변경 핸들러
  const handleRatingChange = async (value: number) => {
    // 로그인 확인
    if (!user) {
      alert('별점을 남기려면 로그인해주세요!');
      return;
    }
    
    console.log('별점 선택:', value);
    
    // 클릭한 값을 상태에 즉시 반영 (UI 응답성)
    const previousRating = myRating;
    setMyRating(value);
    
    // 별점 저장
    const success = await saveRating(value);
    
    if (!success) {
      // 저장 실패 시 이전 상태로 되돌림
      setMyRating(previousRating);
      console.warn('별점 저장 실패, 이전 상태로 복원');
    }
  };

  // 컴포넌트 마운트 시와 mealId, user 변경 시 평점 조회
  useEffect(() => {
    fetchAverageRating();
    if (user) {
      fetchMyRating();
    }
  }, [mealId, user]);

  return (
    <div className="my-4">
      <div className="text-lg font-medium mb-2">
        오늘 나의 평가는?
        {avgRating !== null && avgRating > 0 && (
          <span className="ml-1">({avgRating.toFixed(1)})</span>
        )}
      </div>
      
      {/* 별점 입력 컴포넌트 */}
      <div className="flex items-center">
        <StarRating
          value={myRating || 0}
          onChange={handleRatingChange}
          interactive={true}
          size="large"
          showValue={false}
        />
        
        {isLoading && (
          <span className="ml-2 text-sm text-gray-500">저장 중...</span>
        )}
      </div>
    </div>
  );
};

export default MyMealRating;
