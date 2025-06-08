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
      // 'menu_item_id' 대신 'id' 컬럼 사용 - 테이블 구조에 맞게 수정
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
      
      // 메뉴 아이템 평점들의 평균 계산
      const menuItemRatingsArray: MenuItemRating[] = data;
      setMenuItemRatings(menuItemRatingsArray);
      
      // 마운트 상태 확인 - 언마운트 후 상태 업데이트 방지
      if (!isMounted.current) return;
      
      // 급식 평점 계산 및 저장
      const avgRating = calculateAverageRating(menuItemRatingsArray);
      if (avgRating !== null) {
        await saveRating(avgRating);
        
        // 마운트 상태 확인 - 언마운트 후 상태 업데이트 방지
        if (!isMounted.current) return;
        
        setMyRating(avgRating);
      }
    } catch (error) {
      console.error('급식 평점 계산 및 저장 중 오류 발생:', error);
    }
  };

  // 내 급식 평점 조회 함수
  const fetchMyRating = async () => {
    if (!mealId || !user) return;
    
    try {
      // 로딩 상태 설정
      setIsLoading(true);
      
      console.log('내 급식 평점 조회 시작:', mealId, user.id);
      
      // 웨일 브라우저 호환성 강화를 위해 AbortController 사용
      const controller = new AbortController();
      const signal = controller.signal;
      
      // 타임아웃 설정 (10초)
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // meal_ratings 테이블에서 사용자의 급식 평점 조회
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .maybeSingle(); // no rows 처리를 위해 maybeSingle 사용
      
      // 타임아웃 정리
      clearTimeout(timeoutId);
      
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (!isMounted.current) return;
      
      if (error && error.code !== 'PGRST116') { // 결과 없음 에러는 무시 (PGRST116)
        console.error('내 급식 평점 조회 오류:', error.message);
        return;
      }
      
      if (data) {
        console.log('내 급식 평점 조회 결과:', data.rating);
        setMyRating(data.rating);
      } else {
        console.log('내 급식 평점이 없음');
        setMyRating(null);
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.log('급식 평점 조회 요청 타임아웃');
      } else {
        console.error('내 급식 평점 조회 중 오류 발생:', error);
      }
    } finally {
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // 급식 평점 통계 조회 함수
  const fetchMealRatingStats = async () => {
    if (!mealId) return;
    
    try {
      // 로딩 상태 설정
      setIsLoading(true);
      
      console.log('급식 평점 통계 조회 시작:', mealId);
      
      // 웨일 브라우저 호환성 강화를 위해 AbortController 사용
      const controller = new AbortController();
      const signal = controller.signal;
      
      // 타임아웃 설정 (10초)
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // meal_ratings 테이블에서 해당 급식의 평균 평점 계산
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId);
      
      // 타임아웃 정리
      clearTimeout(timeoutId);
      
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (!isMounted.current) return;
      
      if (error) {
        console.error('급식 평점 통계 조회 오류:', error.message);
        return;
      }
      
      if (data && data.length > 0) {
        // 평균 평점 계산
        const total = data.reduce((sum, item) => sum + item.rating, 0);
        const avg = total / data.length;
        console.log('급식 평점 통계 조회 결과:', avg);
        setAvgRating(avg);
      } else {
        console.log('급식 평점 통계가 없음');
        setAvgRating(null);
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.log('급식 평점 통계 조회 요청 타임아웃');
      } else {
        console.error('급식 평점 통계 조회 중 오류 발생:', error);
      }
    } finally {
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // 평점 평균 계산 함수
  const calculateAverageRating = (ratings: MenuItemRating[]): number | null => {
    if (!ratings || ratings.length === 0) return null;
    
    const sum = ratings.reduce((sum, item) => sum + item.rating, 0);
    return sum / ratings.length;
  };

  // 별점 남기기 API 호출 함수 (웨일 브라우저 호환성 강화)
  const submitRating = async (rating: number) => {
    if (!mealId || !user) {
      console.log('급식 ID 또는 사용자 정보가 없음');
      return false;
    }
    
    try {
      setIsLoading(true);
      
      console.log('급식 평점 저장 시작:', mealId, user.id, rating);
      
      // 웨일 브라우저 호환성 강화를 위해 AbortController 사용
      const controller = new AbortController();
      const signal = controller.signal;
      
      // 타임아웃 설정 (10초)
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
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
      
      // 타임아웃 정리
      clearTimeout(timeoutId);
      
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (!isMounted.current) return false;
      
      if (error) {
        console.error('급식 평점 저장 오류:', error.message);
        return false;
      }
      
      console.log('급식 평점 저장 성공!');
      
      // 로컬 UI 업데이트를 위해 이벤트 발생 - 웨일 브라우저 호환성 강화
      try {
        const event = new CustomEvent('meal-rating-change', { 
          detail: { 
            mealId: mealId,
            userId: user.id,
            rating: rating 
          } 
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.error('이벤트 발생 중 오류:', e);
      }
      
      return true;
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.log('급식 평점 저장 요청 타임아웃');
      } else {
        console.error('급식 평점 저장 중 오류 발생:', error);
      }
      return false;
    } finally {
      // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // 평점 저장 함수 (1~5만 upsert, 그 외는 무조건 삭제)
  const saveRating = async (rating: number | null) => {
    if (!mealId || !user) return false;
    
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoading) return false;
    
    try {
      // 0점 이하 또는 5점 초과이면 무조건 삭제
      if (rating !== null && (rating < 1 || rating > 5)) {
        console.log('유효하지 않은 평점. 평점 삭제:', rating);
        
        // 평점 삭제 
        const { error } = await supabase
          .from('meal_ratings')
          .delete()
          .eq('user_id', user.id)
          .eq('meal_id', mealId);
          
        if (error) {
          console.error('평점 삭제 오류:', error.message);
          return false;
        }
        
        // 상태 업데이트
        if (isMounted.current) {
          setMyRating(null);
        }
        
        return true;
      }

      // 유효한 평점이면 저장 함수 호출
      return submitRating(rating!);
    } catch (error) {
      console.error('평점 저장 또는 삭제 중 오류 발생:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
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
    // 이벤트 전달용 커스텀 이벤트의 값 확인
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
      // 삭제 처리된 경우 - 현재 모든 별점이 삭제되면 myRating도 null 처리
      if (menuItemRatings.length <= 1) {
        setMyRating(null);
      }
    } else if (detail.newRating && !myRating) {
      // 처음 별점을 주는 경우 - 임시로 값 표시
      setMyRating(detail.newRating);
    } else if (detail.newRating && myRating) {
      // 기존 별점 변경 - 임시 계산 처리
      const updatedRatings = [...menuItemRatings];
      const index = updatedRatings.findIndex(r => r.menu_item_id === detail.menuItemId);
      
      if (index >= 0) {
        // 기존 평점 업데이트
        updatedRatings[index] = { 
          ...updatedRatings[index], 
          rating: detail.newRating! 
        };
      } else {
        // 새 평점 추가
        updatedRatings.push({ 
          menu_item_id: detail.menuItemId!, 
          rating: detail.newRating! 
        });
      }
      
      // 새 평균 계산
      const newAvg = calculateAverageRating(updatedRatings);
      setMyRating(newAvg);
    }
    
    // 이전 타이머 정리
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 2. 백그라운드에서 실제 데이터 계산 및 저장 처리
    // 연속 클릭시 디바운스 처리
    timerRef.current = window.setTimeout(async () => {
      // 마운트 상태 확인
      if (!isMounted.current) return;
      
      // 실제 계산 및 저장
      await calculateAndSaveMealRating();
      
      // 마운트 상태 확인
      if (!isMounted.current) return;
      
      // 통계 데이터 갱신
      fetchMealRatingStats();
    }, 500);
  };
  
  // 윈도우 포커스 이벤트 처리 함수 - 앱 복귀 시 데이터 갱신
  const handleFocus = () => {
    // 마운트 상태 확인
    if (!isMounted.current) return;
    
    console.log('윈도우 포커스 감지 - 평점 정보 갱신');
    
    // 다른 탭에서 평점을 수정했을 수 있으므로 데이터 새로고침
    fetchMyRating();
    fetchMealRatingStats();
  };
  
  // 별점 변경 핸들러 - StarRating 컴포넌트의 onRatingChange prop으로 전달
  const handleRatingChange = (newRating: number) => {
    // 마운트 상태 확인
    if (!isMounted.current) return;
    
    console.log('별점 변경:', newRating);
    
    if (!user) {
      console.log('로그인 필요');
      return;
    }
    
    // 이전과 같은 평점을 선택하면 평점 삭제
    if (myRating === newRating) {
      console.log('이전과 동일한 평점 선택 - 평점 삭제');
      saveRating(null);
      return;
    }
    
    // 평점 저장 (1~5)
    saveRating(newRating);
    
    // UI 즉시 반응을 위해 상태 업데이트
    setMyRating(newRating);
  };
  
  // 데이터 로드 및 갱신 처리
  useEffect(() => {
    // 사용자나 mealId가 없으면 로드하지 않음
    if (!user || !mealId) return;
    
    console.log('데이터 로드 시작:', mealId);
    
    // 내 평점 로드
    fetchMyRating();
    
    // 메뉴 아이템 별점의 평균으로 급식 평점 계산 및 저장
    calculateAndSaveMealRating();
    
    // 전체 평균 평점 로드
    fetchMealRatingStats();
  }, [user, mealId]);
  
  return (
    <div className="flex items-center">
      {/* 로딩 상태 표시 */}
      {isLoading && (
        <div className="mr-2 text-sm text-gray-500">
          <span className="loading loading-spinner loading-xs"></span>
        </div>
      )}
      
      {/* 별점 UI - 로그인한 경우만 평점 입력 가능 */}
      {user ? (
        <StarRating
          initialRating={myRating || 0}
          onRatingChange={handleRatingChange}
          size="md"
        />
      ) : (
        <div className="text-sm text-gray-500">
          {avgRating ? `(${avgRating.toFixed(1)})` : ''}
        </div>
      )}
      
      {/* 평균 평점 표시 */}
      {avgRating && (
        <div className="ml-2 text-sm text-gray-500">
          ({avgRating.toFixed(1)})
        </div>
      )}
    </div>
  );
};

export default MyMealRating;