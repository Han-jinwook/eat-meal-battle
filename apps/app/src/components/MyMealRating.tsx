// [MEMO] 테스트용 메모: 2025-06-23, Cascade 수정
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

// Supabase 클라이언트 초기화
const supabase = createClient();

interface MyMealRatingProps {
  mealId: string;
}

/**
 * 급식 전체에 대한 개인 평점을 표시하는 컴포넌트 (별점 UI 없이 평점만 표시)
 * 평점은 "(4.2)" 형식으로 표시됨
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 컴포넌트 마운트 상태 추적
  const isMounted = useRef<boolean>(true);

  // 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted.current) {
        setUser(data?.user);
      }
    };
    getUser();

    // 컴포넌트 언마운트 시 cleanup
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 내 평점 조회 함수
  const fetchMyRating = async () => {

    if (!mealId || !user) return;
    
    try {
      setIsLoading(true);
      
      // meal_ratings 테이블에서 사용자의 급식 평점 조회
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (!isMounted.current) return;
      
      if (error && error.code !== 'PGRST116') { // 결과 없음 에러는 무시
        console.error('내 급식 평점 조회 오류:', error.message);
        return;
      }
      
      if (data) {
        setMyRating(data.rating);
      } else {
        setMyRating(null);
      }
    } catch (error) {
      console.error('내 급식 평점 조회 중 오류 발생:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // 데이터 로드
  useEffect(() => {

    if (!user || !mealId) return;
    fetchMyRating();
  }, [user, mealId]);

  // menu_item_ratings, menu_item_rating_stats, meal_rating_stats 중 하나에 변경이 발생할 때 내 평점을 재계산/저장
  useEffect(() => {
    if (!mealId || !user) return;
    // 여러 테이블에 대해 실시간 구독을 설정
    const tables = [
      { table: 'menu_item_ratings', filter: '' },
      { table: 'menu_item_rating_stats', filter: '' },
      { table: 'meal_rating_stats', filter: `meal_id=eq.${mealId}` },
    ];
    const channels = tables.map(({ table, filter }) =>
      supabase
        .channel(`${table}:${mealId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        }, async () => {
          // 메뉴별 별점이 바뀌면 내 급식 평점을 재계산해서 meal_ratings에 upsert
          await recalculateAndSaveMyMealRating();
          // 그리고 UI에 반영
          fetchMyRating();
        })
        .subscribe()
    );
    // 언마운트 시 구독 해제
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [mealId, user]);

  // meal_rating_stats 실시간 구독 추가 (급식별 평점 변경 시 자동 갱신)
  useEffect(() => {
    if (!mealId) return;
    // Supabase 실시간 구독 채널 생성
    const channel = supabase
      .channel(`meal_rating_stats:${mealId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_rating_stats',
        filter: `meal_id=eq.${mealId}`
      }, (payload) => {

        // 평점 변경 시 fetchMyRating 호출
        fetchMyRating();
      })
      .subscribe();
    // 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mealId]);

  // 메뉴별 별점 기반으로 내 급식 평점을 재계산하여 meal_ratings에 저장
  const recalculateAndSaveMyMealRating = async () => {
    // menu_item_ratings에서 내 별점만 모아와서 평균 계산
    const { data: ratings, error } = await supabase
      .from('menu_item_ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('meal_id', mealId);
    if (error || !ratings || ratings.length === 0) return;
    const avg = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
    // meal_ratings에 upsert
    await supabase.from('meal_ratings').upsert({
      meal_id: mealId,
      user_id: user.id,
      rating: avg,
    });
  };

  // 로딩 상태일 때
  if (isLoading) {
    return (
      <div className="my-4">
        <div className="text-lg font-medium">
          오늘 나의 평가는?
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="text-lg font-medium">
        오늘 나의 평가는?
        {/* 로그인 + 평점 있는 유저만 평점 표시 */}
        {user && myRating !== null && (
          <span className="ml-1">({myRating.toFixed(1)})</span>
        )}
      </div>
      {/* 시간 제약 안내 문구 - 작은 글씨 */}
      <div className="text-xs text-gray-500 mt-1">
        (별점은 당일 오후 12시부터 자정까지만 가능합니다.)
      </div>
    </div>
  );
};

export default MyMealRating;
