import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import StarRating from './StarRating';

// Supabase 클라이언트 초기화
const supabase = createClient();

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
 * 
 * 웨일 브라우저 호환성을 위한 안전장치 추가:
 * - 컴포넌트 마운트 상태 추적으로 언마운트 후 상태 업데이트 방지
 * - 타이머 정리 기능으로 메모리 누수 방지
 * - 비동기 작업 취소 기능으로 불필요한 네트워크 요청 방지
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuItemRatings, setMenuItemRatings] = useState<MenuItemRating[]>([]);
  
  // 컴포넌트 마운트 상태 추적
  const isMounted = useRef<boolean>(true);
  // 타이머 참조 저장
  const timerRef = useRef<number | null>(null);

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
      // 'menu_item_id' 대신 'id' 컴럼 사용 - 테이블 구조에 맞게 수정
      const { data, error } = await supabase
        .from('meal_menu_items')
        .select('id')
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
      // item.menu_item_id 대신 item.id 사용
      return data.map(item => item.id);
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
      console.log(' 내 급식 평점 조회 시도 - 급식 ID:', mealId, '사용자 ID:', user.id);
      
      // meal_ratings 테이블에서 내 평점 조회 - maybeSingle 대신 limit(1) 사용
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error(' 내 평점 조회 오류:', error.message);
        return;
      }

      // 데이터 배열에서 첫 번째 항목 사용 (없으면 null 처리)
      if (data && data.length > 0) {
        console.log(' 내 평점 조회 성공:', data[0].rating);
        setMyRating(data[0].rating);
      } else {
        console.log(' 내 급식 평점 없음, 메뉴 아이템 평점 기반으로 계산 시도');
        setMyRating(null);
        // 메뉴 아이템 별점의 평균을 계산하여 급식 평점 저장
        await calculateAndSaveMealRating();
      }
    } catch (error) {
      console.error(' 내 평점 조회 중 오류 발생:', error);
    }
  };

  // 급식 평점 통계 조회 함수
  const fetchMealRatingStats = async () => {
    if (!mealId) return;

    try {
      console.log('급식 평점 통계 조회 시작 - 급식 ID:', mealId);
      
      // meal_rating_stats 테이블에서 평균 평점 조회 - maybeSingle 대신 get 사용
      const { data, error } = await supabase
        .from('meal_rating_stats')
        .select('avg_rating')
        .eq('meal_id', mealId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('급식 평점 통계 조회 오류:', error.message);
        return;
      }

      // 데이터 배열에서 첫 번째 항목 사용 (없으면 null 처리)
      if (data && data.length > 0 && data[0].avg_rating) {
        console.log('급식 평점 통계 조회 성공:', data[0].avg_rating);
        setAvgRating(data[0].avg_rating);
      } else {
        console.log('급식 평점 통계 없음');
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
    return Math.round(avg * 10) / 10; // 소수점 둘째 자리에서 반올림하여 첨째 자리까지만 표시 (4.53 -> 4.5 / 3.75 -> 3.8)
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
            rating: rating, // 소수점 값 그대로 저장 (meal_ratings 테이블의 rating 컬럼은 float4 타입)
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


  // 이벤트 리스너 등록 및 제거
  useEffect(() => {
    // 이벤트 리스너 등록
    window.addEventListener('menu-item-rating-change', handleMenuItemRatingChange as EventListener);
    window.addEventListener('focus', handleFocus);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거 및 타이머 정리
    return () => {
      // 마운트 상태 업데이트
      isMounted.current = false;
      
      // 이벤트 리스너 제거
      window.removeEventListener('menu-item-rating-change', handleMenuItemRatingChange as EventListener);
      window.removeEventListener('focus', handleFocus);
      
      // 타이머 정리
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mealId, user]);

  // 메뉴 아이템 평점 변경 이벤트 처리 함수
  const handleMenuItemRatingChange = (event: Event) => {
    // 타입 안전을 위한 커스텀 이벤트 타입 가드
    if (!('detail' in event) || !event.detail) return;
    
    const detail = event.detail as { menuItemId?: string; newRating?: number; deleted?: boolean };
    if (!detail.menuItemId) return;
    
    // 마운트 상태 확인 - 언마운트 후 처리 방지
    if (!isMounted.current) {
      console.log('언마운트된 컴포넌트의 이벤트 처리 무시');
      return;
    }
    
    console.log('메뉴 아이템 평점 변경 감지:', detail);
    
    // 1. UI 즉시 반응을 위한 임시 처리
    if (detail.deleted && myRating) {
      // 삭제 처리인 경우 - 현재 모든 별점이 삭제되면 myRating도 null 처리
      if (menuItemRatings.length <= 1) {
        setMyRating(null);
      }
    } else if (detail.newRating && !myRating) {
      // 처음 별점을 주는 경우 - 임시로 값 표시
      setMyRating(detail.newRating);
    } else if (detail.newRating && myRating) {
      // 기존 별점 변경 - 임시 계산
      const tempRating = detail.newRating;
      setMyRating(tempRating);
    }
    
    // 이전 타이머 정리
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 2. 백그라운드에서 실제 데이터 계산 및 저장 처리
    // 약간의 지연 후 유저 시각적 방해 없이 계산
    timerRef.current = window.setTimeout(async () => {
      try {
        // 컴포넌트가 여전히 마운트된 상태인지 확인
        if (!isMounted.current) {
          console.log('타이머 콜백: 컴포넌트가 언마운트됨, 작업 취소');
          return;
        }
        
        await calculateAndSaveMealRating(); // 실제 계산 및 DB 저장
        
        // 컴포넌트가 여전히 마운트된 상태인지 다시 확인
        if (!isMounted.current) return;
        
        // 3. UI 업데이트를 위해 정확한 데이터 재조회
        await fetchMyRating(); // 내 별점 조회
        await fetchMealRatingStats(); // 전체 평점 통계 조회
      } catch (error) {
        console.error('별점 업데이트 중 오류:', error);
        // 오류가 발생해도 타이머 참조 정리
        timerRef.current = null;
      }
    }, 300) as any;
  };

  // 포커스를 가질 때마다 재조회하여 최신 데이터 보장
  const handleFocus = () => {
    // 컴포넌트가 마운트된 상태일 때만 처리
    if (!isMounted.current) return;
    
    if (user && mealId) {
      fetchMyRating();
      fetchMealRatingStats();
    }
  };

  // 의존성 배열이 이미 useEffect 바로 위에 정의되어 있으므로 삭제

  // 초기 데이터 로딩 함수
  const fetchInitialData = async () => {
    try {
      await fetchMealRatingStats();
      if (user) {
        await fetchMyRating();
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.log('요청이 취소됨');
      } else {
        console.error('초기 데이터 로딩 중 오류:', error);
      }
    }
  };
  
  // 컴포넌트 마운트 시와 mealId, user 변경 시 평점 조회
  useEffect(() => {
    // 초기화 시에 마운트 상태를 true로 설정
    isMounted.current = true;
    
    // AbortController 생성
    const abortController = new AbortController();
    
    // 초기 데이터 로딩
    fetchInitialData();
    
    // 정리 함수
    return () => {
      abortController.abort();
      isMounted.current = false;
    };
  }, [mealId, user]);

  // 별점 변경 핸들러 - 별점 클릭 시 호출됨
  const handleRatingChange = (value: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!isMounted.current) return;

    setMyRating(value);
    saveRating(value);
  };

  // 로딩 중에도 메시지는 항상 표시
  if (isLoading) {
    return (
      <div className="my-4">
        <div className="text-lg font-medium">
          오늘 나의 평가는?
        </div>
        <div className="mt-1 flex items-center">
          <div className="opacity-50">
            <StarRating value={0} onChange={() => {}} interactive={false} showValue={false} size="large" />
          </div>
          <span className="ml-2 text-sm text-gray-400">로딩 중...</span>
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
      <div className="mt-2">
        {/* 별점 입력 컴포넌트 */}
        <StarRating 
          value={myRating || 0}
          onChange={handleRatingChange}
          interactive={!!user}
          showValue={false}
          size="large"
        />
        {!user && <span className="ml-2 text-sm text-gray-500">별점을 남기려면 로그인하세요</span>}
      </div>
      {/* 평균 표시 - 오류 방지를 위해 avgRating이 존재하는 경우에만 표시 */}
      {avgRating !== null && (
        <div className="mt-2 text-sm text-gray-600">
          평균 평점: {avgRating.toFixed(1)}
        </div>
      )}
    </div>
  );
};

export default MyMealRating;
