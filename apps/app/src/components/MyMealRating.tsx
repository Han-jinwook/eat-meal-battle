import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import StarRating from './StarRating';

// Supabase 클라이언트 초기화
const supabase = createClientComponentClient();

interface MyMealRatingProps {
  mealId: string;
}

interface MenuItemRating {
  menu_item_id: string;
  rating: number;
}

/**
 * 급식 전체에 대한 평균 평점을 표시하고 사용자가 평점을 매길 수 있는 컴포넌트
 * 평균 평점은 "(4.2)" 형식으로 표시됨
 * 급식 평점은 해당 급식의 메뉴 아이템 평점들의 평균으로 계산됨
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuItemRatings, setMenuItemRatings] = useState<MenuItemRating[]>([]);

  // 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);

  // 급식의 메뉴 아이템 ID 목록 조회
  const fetchMenuItems = async () => {
    if (!mealId) return [];

    try {
      console.log('급식 메뉴 아이템 조회 시작:', mealId);
      
      // 해당 급식의 메뉴 아이템 ID 목록 조회
      const { data, error } = await supabase
        .from('meal_menu_items')
        .select('menu_item_id')
        .eq('meal_id', mealId);
        
      if (error) {
        console.error('메뉴 아이템 조회 오류:', error.message);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('메뉴 아이템이 없음');
        return [];
      }
      
      console.log('메뉴 아이템 조회 결과:', data.length, '개 항목');
      return data.map(item => item.menu_item_id);
    } catch (error) {
      console.error('메뉴 아이템 조회 중 오류 발생:', error);
      return [];
    }
  };

  // 메뉴 아이템 별점의 평균을 계산하여 급식 평점 저장
  const calculateAndSaveMealRating = async () => {
    if (!mealId || !user) return;

    try {
      // 메뉴 아이템 ID 목록 조회
      const menuItemIds = await fetchMenuItems();
      if (menuItemIds.length === 0) {
        // 메뉴 아이템 자체가 없으면 급식 평점도 삭제
        await saveRating(null);
        setMenuItemRatings([]);
        setMyRating(null);
        return;
      }
      
      console.log('내 메뉴 아이템 평점 조회 시작:', menuItemIds.length, '개 항목');
      
      // 사용자의 메뉴 아이템 평점 조회
      const { data, error } = await supabase
        .from('menu_item_ratings')
        .select('menu_item_id, rating')
        .eq('user_id', user.id)
        .in('menu_item_id', menuItemIds);
        
      if (error) {
        console.error('메뉴 아이템 평점 조회 오류:', error.message);
        return;
      }
      
      if (!data || data.length === 0) {
        // 메뉴 아이템 별점이 모두 삭제된 경우 급식 평점도 삭제
        console.log('메뉴 아이템 평점이 없음, 급식 평점 row 삭제');
        setMenuItemRatings([]);
        setMyRating(null);
        await saveRating(null);
        return;
      }
      
      console.log('메뉴 아이템 평점 조회 결과:', data.length, '개 항목');
      setMenuItemRatings(data);
      
      // 메뉴 아이템 별점의 평균 계산
      const avgItemRating = calculateAverageRating(data);
      
      // 계산된 평균을 meal_ratings 테이블에 저장
      await saveRating(avgItemRating); // avgItemRating이 null이면 삭제
      setMyRating(avgItemRating);
    } catch (error) {
      console.error('메뉴 아이템 평점 조회 중 오류 발생:', error);
    }
  };

  // 내 급식 평점 조회 함수
  const fetchMyRating = async () => {
    if (!mealId || !user) return;

    try {
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
        setMyRating(data.rating);
      } else {
        setMyRating(null);
        // 메뉴 아이템 별점의 평균을 계산하여 급식 평점 저장
        await calculateAndSaveMealRating();
      }
    } catch (error) {
      console.error('내 평점 조회 중 오류 발생:', error);
    }
  };

  // 급식 평점 통계 조회 함수
  const fetchMealRatingStats = async () => {
    if (!mealId) return;

    try {
      // meal_rating_stats 테이블에서 평균 평점 조회
      const { data, error } = await supabase
        .from('meal_rating_stats')
        .select('avg_rating')
        .eq('meal_id', mealId)
        .maybeSingle();

      if (error) {
        console.error('급식 평점 통계 조회 오류:', error.message);
        return;
      }

      // 평균 평점이 있으면 상태 업데이트
      if (data && data.avg_rating) {
        setAvgRating(data.avg_rating);
      } else {
        setAvgRating(null);
      }
    } catch (error) {
      console.error('급식 평점 통계 조회 중 오류 발생:', error);
    }
  };

  // 평점 평균 계산 함수
  const calculateAverageRating = (ratings: MenuItemRating[]): number | null => {
    if (!ratings || ratings.length === 0) return null;
    
    const sum = ratings.reduce((total, item) => total + item.rating, 0);
    const avg = sum / ratings.length;
    
    console.log('평점 평균 계산:', sum, '/', ratings.length, '=', avg);
    return Math.round(avg * 10) / 10; // 소수점 첫째 자리까지 반올림
  };

  // 평점 저장 함수 (1~5만 upsert, 그 외는 무조건 삭제)
  const saveRating = async (rating: number | null) => {
    if (!mealId || !user) return false;

    try {
      setIsLoading(true);
      // rating이 1~5가 아니면 무조건 삭제
      if (rating === null || rating < 1 || rating > 5) {
        // CHECK 제약조건: rating은 1~5만 허용
        console.log('급식 평점 row 삭제 시도:', mealId, user.id);
        const { error } = await supabase
          .from('meal_ratings')
          .delete()
          .eq('user_id', user.id)
          .eq('meal_id', mealId);
        if (error) {
          console.error('평점 row 삭제 오류:', error.message);
          return false;
        }
        console.log('평점 row 삭제 성공!');
        await fetchMealRatingStats();
        return true;
      } else {
        // rating이 1~5인 경우에만 upsert
        console.log('급식 평점 저장 시작:', mealId, user.id, rating);
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
        await fetchMealRatingStats();
        return true;
      }
    } catch (error) {
      console.error('평점 저장/삭제 중 오류 발생:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };


  // 메뉴 아이템 평점 저장 함수
  const saveMenuItemRating = async (menuItemId: string, rating: number) => {
    if (!user) return false;

    try {
      console.log('메뉴 아이템 평점 저장 시작:', menuItemId, user.id, rating);
      
      // menu_item_ratings 테이블에 평점 저장 (upsert)
      const { error } = await supabase
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id: menuItemId,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,menu_item_id'
        });

      if (error) {
        console.error('메뉴 아이템 평점 저장 오류:', error.message);
        return false;
      }

      console.log('메뉴 아이템 평점 저장 성공!');
      return true;
    } catch (error) {
      console.error('메뉴 아이템 평점 저장 중 오류 발생:', error);
      return false;
    }
  };



  // 컴포넌트 마운트 시와 mealId, user 변경 시 평점 조회
  useEffect(() => {
    fetchMealRatingStats();
    if (user) {
      fetchMyRating();
    }
  }, [mealId, user]);

  // 로딩 중에도 메시지는 항상 표시
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
        {/* 로그인 + 별점 입력한 유저만 평점 표시, 0점도 표시 */}
        {user && myRating !== null && (
          <span className="ml-1">({myRating.toFixed(1)})</span>
        )}
      </div>
    </div>
  );
};

export default MyMealRating;
