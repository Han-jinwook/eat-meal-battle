import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { MealInfo, MealMenuItem } from '@/types'; // 메뉴 아이템 타입 추가
import StarRating from '@/components/StarRating';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@supabase/auth-helpers-react';
import MyMealRating from '@/components/MyMealRating';

// Supabase 클라이언트 초기화
const supabase = createClientComponentClient();

// 디버깅용 콘솔 로그
console.log('MealCard 컴포넌트 로드됨, Supabase 클라이언트 초기화');

interface MealCardProps {
  meal: MealInfo;
  onShowOrigin(info: string): void;
  onShowNutrition(meal: MealInfo): void;
  onUploadSuccess(): void;
  onUploadError(error: string): void;
}

// 별점 지정/표시 컴포넌트
function MenuItemWithRating({ item }: { item: MealMenuItem }) {
  // 상태로 사용자 관리
  const [user, setUser] = useState(null);
  
  // 컴포넌트 마운트 시 사용자 정보 가져오기
  useEffect(() => {
    // 비동기로 사용자 정보 가져오기
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      console.log('실제 사용자 정보:', data?.user);
      setUser(data?.user);
    };
    
    getUser();
  }, []);
  const [rating, setRating] = useState<number | null>(item.user_rating || null);
  const [avgRating, setAvgRating] = useState<number | null>(item.avg_rating || null);
  const [ratingCount, setRatingCount] = useState<number | null>(item.rating_count || null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 사용자 로그인 상태 콘솔에 표시 (디버깅용)
  useEffect(() => {
    console.log('MenuItemWithRating - 사용자 로그인 상태:', user ? '로그인됨' : '로그인 안됨');
    if (user) console.log('사용자 ID:', user.id); // 사용자 ID 디버깅 로그 추가
  }, [user]);

  // 사용자 별점 저장 함수 - 단순화된 버전, 타입 변환 오류 수정
  const saveRating = async (menuItemId: string, rating: number) => {
    try {
      // 사용자 인증 확인
      if (!user || !user.id) {
        console.error('❌ 사용자 로그인 상태가 아닙니다');
        alert('별점을 남기려면 로그인해주세요!');
        return false;
      }
      
      if (!menuItemId) {
        console.error('❌ 메뉴 아이템 ID가 없습니다');
        return false;
      }
      
      console.log('💾 별점 저장 시도:', menuItemId, rating);
      
      // Supabase에 별점 저장 - UPSERT 사용
      const { error } = await supabase
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id: menuItemId,
          rating: rating,  // 명시적으로 숫자 전달
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,menu_item_id'
        });
      
      if (error) {
        console.error('❌ 저장 오류:', error.message);
        return false;
      }
      
      console.log('✅ 별점 저장 성공!');
      return true;
    } catch (error) {
      console.error('❌ 별점 저장 중 오류:', error);
      return false;
    }
  };

  // 사용자 별점 삭제 함수
  const deleteRating = async (menuItemId: string) => {
    try {
      if (!user || !user.id) {
        console.error('❌ 사용자 로그인 상태가 아닙니다');
        alert('별점을 남기려면 로그인해주세요!');
        return false;
      }
      if (!menuItemId) {
        console.error('❌ 메뉴 아이템 ID가 없습니다');
        return false;
      }
      console.log('🗑️ 별점 삭제 시도:', menuItemId);
      const { error } = await supabase
        .from('menu_item_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('menu_item_id', menuItemId);
      if (error) {
        console.error('❌ 삭제 오류:', error.message);
        return false;
      }
      
      // 메뉴 아이템 별점 삭제 후 급식 평점 재계산 이벤트 발생
      console.log('🔄 메뉴 아이템 별점 삭제 성공, 급식 평점 재계산 필요');
      // 전역 이벤트 발생 - 급식 평점 재계산 요청
      const event = new CustomEvent('menu-item-rating-change', {
        detail: { menuItemId, deleted: true }
      });
      window.dispatchEvent(event);
      console.log('✅ 별점 삭제 성공!');
      return true;
    } catch (error) {
      console.error('❌ 별점 삭제 중 오류:', error);
      return false;
    }
  };

  // 별점 조회 함수 - 개선된 오류 처리 및 로깅 추가
  const fetchRating = async (menuItemId: string) => {
    try {
      console.log('➡️ 별점 정보 조회 시도 - 메뉴아이템 ID:', menuItemId);
      
      if (!menuItemId) {
        console.error('메뉴아이템 ID가 없습니다.');
        return null;
      }
      
      // 먼저 개별 메뉴 항목의 평균 평점 직접 계산
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('menu_item_ratings')
        .select('rating')
        .eq('menu_item_id', menuItemId);
        
      if (ratingsError) {
        console.error('평점 데이터 조회 오류:', ratingsError.message);
        return null;
      }

      // 평균 및 개수 계산
      const ratings = ratingsData || [];
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length
        : 0;
      const ratingCount = ratings.length;

      console.log('계산된 통계:', { avgRating, ratingCount });

      // 사용자 별점 조회 (if logged in)
      let userRating = null;
      if (user && user.id) {
        console.log('사용자 ID로 별점 조회 시도:', user.id);
        
        const { data: ratingData, error: ratingError } = await supabase
          .from('menu_item_ratings')
          .select('rating')
          .eq('menu_item_id', menuItemId)
          .eq('user_id', user.id)
          .maybeSingle();
          
        console.log('사용자 별점 조회 결과:', 
          ratingData ? `별점: ${ratingData.rating}` : '별점 없음', 
          ratingError ? `오류: ${ratingError.message}` : '성공');

        userRating = ratingData?.rating;
      } else {
        console.log('로그인되지 않아 사용자 별점을 조회하지 않습니다.');
      }
      
      const result = {
        avg_rating: avgRating,
        rating_count: ratingCount,
        user_rating: userRating
      };
      
      console.log('✅ 최종 별점 조회 결과:', result);
      return result;
    } catch (error) {
      console.error('별점 정보 조회 오류:', error);
      // 오류 발생시 기본값 반환
      return {
        avg_rating: 0,
        rating_count: 0,
        user_rating: null
      };
    }
  };

  // 별점 상태 초기화 함수 - 단순화된 버전
  const initRatingState = async () => {
    try {
      // 이미 별점 정보가 있으면 사용
      if (item.user_rating !== undefined) {
        setRating(item.user_rating);
        setAvgRating(item.avg_rating);
        setRatingCount(item.rating_count);
        return;
      }

      // 서버에서 데이터 조회
      const data = await fetchRating(item.id);
      
      if (data) {
        setRating(data.user_rating);
        setAvgRating(data.avg_rating);
        setRatingCount(data.rating_count);
      } else {
        // 조회 실패 시 기본값 사용
        setRating(null);
        setAvgRating(0);
        setRatingCount(0);
      }
    } catch (error) {
      console.error('별점 데이터 초기화 중 오류:', error);
    }
  };

  // 초기 별점 조회 및 사용자/아이템 변경 시 재조회
  useEffect(() => {
    if (item && item.id) {
      initRatingState();
    }
  }, [item.id, user, item]);

  // 별점 클릭 이벤트 처리 함수 - 별 사라짐 문제 해결 + 별점 취소(삭제) 지원
  const handleRating = async (value: number) => {
    try {
      // 로그인 확인
      if (!user) {
        alert('별점을 남기려면 로그인해주세요!');
        return;
      }
      if (!item.id) {
        console.error('메뉴 아이템 ID가 없습니다');
        return;
      }
      console.log('⭐ 별점 선택:', value);
      setIsLoading(true);
      const previousRating = rating;

      // 이미 선택된 별을 다시 클릭하면 별점 삭제
      if (rating === value) {
        setRating(null); // UI에서 별점 제거
        const deleted = await deleteRating(item.id);
        if (deleted) {
          // 별점 삭제 성공 시 평균/개수 갱신
          try {
            const updatedData = await fetchRating(item.id);
            setAvgRating(updatedData?.avg_rating || 0);
            setRatingCount(updatedData?.rating_count || 0);
          } catch (fetchError) {
            console.error('통계 조회 실패, 화면은 유지함:', fetchError);
          }
        } else {
          // 삭제 실패 시 이전 상태 복원
          setRating(previousRating);
          alert('별점 삭제에 실패했습니다.');
        }
        return;
      }

      // 별점 신규 지정/수정
      setRating(value);
      const success = await saveRating(item.id, value);
      if (success) {
        // 저장 성공해도 클릭한 값 유지 (UI 응답성)
        console.log('별점 저장 성공, 화면에 유지:', value);
        try {
          const updatedData = await fetchRating(item.id);
          if (updatedData && updatedData.avg_rating !== undefined) {
            setAvgRating(updatedData.avg_rating);
            setRatingCount(updatedData.rating_count);
          }
        } catch (fetchError) {
          console.error('통계 조회 실패, 화면은 유지함:', fetchError);
        }
      } else {
        setRating(previousRating);
        console.warn('별점 저장 실패, 이전 상태로 복원');
      }
    } catch (error) {
      console.error('별점 처리 중 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <li className="flex justify-between items-center py-2 border-b border-gray-100">
      {/* 별점 영역 - 왼쪽으로 이동 */}
      <div className="flex items-center">
        <div className="rating-container mr-3">
          {/* 사용자 여부와 관계없이 항상 클릭 가능하게 */}
          {/* 별표 크기 키움 */}
          <StarRating 
            value={rating || 0}
            onChange={handleRating}
            interactive={true}
            showValue={false}
            size="medium"
          />
        </div>
        <div className="text-gray-700">{item.item_name}</div>
      </div>
      
      {/* 평균 별점 표시 */}
      {avgRating && ratingCount ? (
        <div className="text-sm text-gray-500">
          {avgRating.toFixed(1)} ({ratingCount}명)
        </div>
      ) : null}
    </li>
  );
};

// 간단한 타입별 아이콘 헬퍼 (추후 유틸로 이동 가능)
const getMealTypeIcon = (mealType: string) => {
  switch (mealType) {
    case '조식':
      return '🍳';
    case '중식':
      return '🍚';
    case '석식':
      return '🍲';
    case '간식':
      return '🍪';
    default:
      return '🍽️';
  }
};

export default function MealCard({
  meal,
  onShowOrigin,
  onShowNutrition,
  onUploadSuccess,
  onUploadError,
}: MealCardProps) {
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* 업로더 영역 */}
      <div className="bg-gray-50 p-3 border-b">
        <MealImageUploader
          key={`uploader-${meal.id}-${meal.meal_date}`} /* 날짜 변경 시 컴포넌트 재마운트 */
          mealId={meal.id}
          schoolCode={meal.school_code}
          mealDate={meal.meal_date}
          mealType={meal.meal_type}
          onUploadSuccess={onUploadSuccess}
          onUploadError={onUploadError}
        />
      </div>

      {/* 본문 */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {meal.origin_info && (
              <button
                onClick={() => onShowOrigin(meal.origin_info!)}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                원산지
              </button>
            )}
            {(meal.kcal || meal.ntr_info) && (
              <button
                onClick={() => onShowNutrition(meal)}
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                영양정보
              </button>
            )}
          </div>
          {meal.kcal && (
            <div className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {meal.kcal}kcal
            </div>
          )}
        </div>

        {/* 오늘 나의 평가는? 섹션 */}
        <MyMealRating mealId={meal.id} />

        {/* 메뉴 목록 */}
        <div className="mb-4">
          <ul className="space-y-2">
            {meal.menuItems && meal.menuItems.length > 0 ? (
              // 개별 메뉴 아이템 표시 (새로운 데이터 구조 사용 + 별점 기능)
              meal.menuItems.map((item) => (
                <MenuItemWithRating key={item.id} item={item} />
              ))
            ) : (
              // 기존 menu_items 배열 사용 (하위 호환성 유지)
              meal.menu_items.map((item, idx) => (
                <li key={idx} className="text-gray-700">
                  {item}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 버튼들 상단으로 이동함 */}
      </div>
    </div>
  );
}
