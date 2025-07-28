import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { calculateDailyMenuBattle, calculateMonthlyMenuBattle, calculateDailyMealBattle, calculateMonthlyMealBattle } from '@/utils/battleCalculator';

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
  
  // 배틀 계산 디바운싱을 위한 ref
  const battleCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 디바운싱을 위한 타이머 참조
  const recalculateTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 실행 중 플래그 (중복 실행 방지)
  const isRecalculatingRef = useRef<boolean>(false);
  
  // 배틀 계산 트리거 함수 (meal_rating_stats 변경 시 호출)
  const triggerBattleCalculation = useCallback(async () => {
    if (!mealId) return;
    
    try {
      // 급식 정보 조회를 위해 meal_menus 테이블에서 날짜와 학교 코드 조회
      const { data: mealData, error: mealError } = await supabase
        .from('meal_menus')
        .select('meal_date, school_code')
        .eq('id', mealId)
        .single();
        
      if (mealError) {
        console.error('⚠️ 급식 정보 조회 실패:', mealError);
        return;
      }
      
      if (mealData) {
        // 배틀 계산 트리거 (디바운싱 적용)
        // 기존 타이머가 있으면 취소
        if (battleCalculationTimeoutRef.current) {
          clearTimeout(battleCalculationTimeoutRef.current);
        }
        
        // 2초 후에 배틀 계산 실행 (중복 방지)
        battleCalculationTimeoutRef.current = setTimeout(async () => {
          try {
            const mealDate = mealData.meal_date;
            const schoolCode = mealData.school_code;
            
            console.log('🏆 배틀 계산 시작 (meal_rating_stats 트리거):', { mealDate, schoolCode });
            
            const date = new Date(mealDate);
            
            // 메뉴 배틀 계산 (메뉴 아이템 간 경쟁)
            await calculateDailyMenuBattle(mealDate, schoolCode);
            console.log(`✅ 일별 메뉴 배틀 계산 완료: ${mealDate}`);
            
            await calculateMonthlyMenuBattle(date.getFullYear(), date.getMonth() + 1, schoolCode);
            console.log(`✅ 월별 메뉴 배틀 계산 완료: ${date.getFullYear()}-${date.getMonth() + 1}`);
            
            // 급식 배틀 계산 (학교 간 경쟁)
            await calculateDailyMealBattle(mealDate, schoolCode);
            console.log(`✅ 일별 급식 배틀 계산 완료: ${mealDate}`);
            
            await calculateMonthlyMealBattle(date.getFullYear(), date.getMonth() + 1, schoolCode);
            console.log(`✅ 월별 급식 배틀 계산 완료: ${date.getFullYear()}-${date.getMonth() + 1}`);
          } catch (battleError) {
            console.error('⚠️ 배틀 계산 중 오류:', battleError);
          }
        }, 2000); // 2초 디바운싱
      }
    } catch (error) {
      console.error('⚠️ 배틀 계산 트리거 중 오류:', error);
    }
  }, [mealId, supabase]);
  
  // 메뉴별 별점 기반으로 전체 급식 평점을 재계산하여 meal_ratings에 저장 (디바운싱 적용)
  const recalculateAndSaveMyMealRating = useCallback(async () => {
    if (!user || !mealId) return;
    
    // 이미 실행 중이면 무시
    if (isRecalculatingRef.current) {
      // 이미 재계산 중이므로 스킵
      return;
    }
    
    // 이전 타이머 취소
    if (recalculateTimerRef.current) {
      clearTimeout(recalculateTimerRef.current);
    }
    
    // 500ms 디바운싱 적용
    recalculateTimerRef.current = setTimeout(async () => {
      // 실행 시작 플래그 설정
      isRecalculatingRef.current = true;
      try {
        // 급식 평점 재계산 시작
        
        // 1단계: meal_menu_items에서 해당 급식의 메뉴 아이템 ID들 조회
        const { data: menuItems, error: menuError } = await supabase
          .from('meal_menu_items')
          .select('id')
          .eq('meal_id', mealId);
          
        if (menuError) {
          console.error('메뉴 아이템 조회 오류:', menuError);
          return;
        }
        
        if (!menuItems || menuItems.length === 0) {
          // 메뉴 아이템이 없음
          return;
        }
        
        const menuItemIds = menuItems.map(item => item.id);
        
        // 2단계: menu_item_ratings에서 내 별점만 모아와서 평균 계산
        const { data: ratings, error: ratingsError } = await supabase
          .from('menu_item_ratings')
          .select('rating')
          .eq('user_id', user.id)
          .in('menu_item_id', menuItemIds);
          
        if (ratingsError) {
          console.error('메뉴 별점 조회 오류:', ratingsError);
          return;
        }
        
        if (!ratings || ratings.length === 0) {
          // 메뉴 별점이 없어서 meal_ratings 삭제
          // 별점이 없으면 meal_ratings에서 삭제
          await supabase
            .from('meal_ratings')
            .delete()
            .eq('user_id', user.id)
            .eq('meal_id', mealId);
          return;
        }
        
        // 평균 계산
        const avg = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
        // 평균 계산 완료
        
        // meal_ratings에 upsert (올바른 문법 사용)
        const { error: upsertError } = await supabase
          .from('meal_ratings')
          .upsert({
            meal_id: mealId,
            user_id: user.id,
            rating: avg,
          }, {
            onConflict: 'user_id,meal_id'
          });
          
        if (upsertError) {
          console.error('meal_ratings upsert 오류:', upsertError);
        } else {
          // 급식 평점 재계산 완료
          console.log('✅ 급식 평점 저장 성공 (배틀 계산은 meal_rating_stats 변경 시 자동 트리거됨)');
          // 배틀 계산은 meal_rating_stats 변경 시 별도로 트리거됨
        }
      } catch (error) {
        console.error('❌ 급식 평점 재계산 실패:', error);
      } finally {
        // 실행 완료 플래그 해제
        isRecalculatingRef.current = false;
      }
    }, 500);
  }, [user, mealId, supabase]);

  // 데이터 로드 및 실시간 구독
  useEffect(() => {
    console.log('🍽️ MyMealRating useEffect 실행:', { user: !!user, mealId });
    
    if (!user || !mealId) {
      console.log('❌ MyMealRating: user 또는 mealId 없음', { user: !!user, mealId });
      return;
    }
    
    console.log('실제 사용자 정보:', { userId: user.id, mealId });
    
    fetchMyRating();
  }, [user, mealId]);

  // meal_rating_stats 변경 시 배틀 계산, meal_ratings 변경 시 UI 업데이트
  useEffect(() => {
    if (!mealId || !user) {
      console.log('❌ 실시간 구독 설정 불가:', { mealId, userId: user?.id });
      return;
    }
    
    console.log('🔔 실시간 구독 설정 시작:', { mealId, userId: user.id });
    
    // 배틀 계산용: meal_rating_stats 구독 (학교/학년별 통계 완료 후)
    // UI 업데이트용: meal_ratings 구독 (개인 평점 표시용)
    // 실시간 구독 설정
    const tables = [
      { table: 'meal_rating_stats', filter: `meal_id=eq.${mealId}` },
      { table: 'meal_ratings', filter: `meal_id=eq.${mealId}` },
    ];
    
    const channels = tables.map(({ table, filter }) => {
      console.log(`🔔 ${table} 구독 채널 생성:`, { table, filter });
      
      return supabase
        .channel(`${table}:${mealId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        }, (payload) => {
          // 테이블 실시간 업데이트 수신
          console.log(`🔔 ${table} 변경 감지:`, payload);
          
          if (table === 'meal_rating_stats') {
            // 급식 통계 완료 시 배틀 계산 트리거
            console.log('📊 meal_rating_stats 변경 감지, 배틀 계산 트리거 시작...', payload);
            triggerBattleCalculation();
          } else if (table === 'meal_ratings') {
            // 현재 사용자의 데이터인지 확인
            if (payload.new && 
                typeof payload.new === 'object' && 
                'user_id' in payload.new && 
                payload.new.user_id === user.id && 
                'rating' in payload.new) {
              setMyRating(payload.new.rating as number);
            }
          }
        })
        .subscribe()
    );
    
    // 언마운트 시 구독 해제
    return () => {
      console.log('실시간 구독 해제');
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [mealId, user]);

  // 로딩 상태일 때
  if (isLoading) {
    return (
      <div className="my-4">
        <div className="text-lg font-medium text-gray-900">
          오늘 나의 평가는?
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="text-lg font-medium text-gray-900">
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
