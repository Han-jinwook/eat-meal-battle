import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { MealInfo, MealMenuItem } from '@/types'; // 메뉴 아이템 타입 추가
import StarRating from '@/components/StarRating';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@supabase/auth-helpers-react';

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
  const { user } = useUser(); // useUser에서 user 프로퍼티만 구조분해할당
  const [rating, setRating] = useState<number | null>(item.user_rating || null);
  const [avgRating, setAvgRating] = useState<number | null>(item.avg_rating || null);
  const [ratingCount, setRatingCount] = useState<number | null>(item.rating_count || null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 사용자 로그인 상태 콘솔에 표시 (디버깅용)
  useEffect(() => {
    console.log('MenuItemWithRating - 사용자 로그인 상태:', user ? '로그인됨' : '로그인 안됨');
    if (user) console.log('사용자 ID:', user.id); // 사용자 ID 디버깅 로그 추가
  }, [user]);

  // 사용자 별점 저장 함수
  const saveRating = async (menuItemId: string, rating: number) => {
    try {
      if (!user) {
        console.log("사용자 인증 없음, 별점 저장 불가");
        return false;
      }
      
      console.log("별점 저장 시도:", menuItemId, rating, "사용자:", user.id);
      console.log('사용자 객체 내용:', user); // 디버깅용 추가 로그
      
      const { error } = await supabase
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id: menuItemId,
          rating,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,menu_item_id' 
        });
      
      if (error) {
        console.error('Supabase 저장 오류:', error);
        return false;
      }
      
      console.log('별점 저장 성공!');
      return true;
    } catch (error) {
      console.error('별점 저장 중 오류:', error);
      return false;
    }
  };

  // 별점 조회 함수
  const fetchRating = async (menuItemId: string) => {
    try {
      console.log('별점 정보 조회 시도:', menuItemId);
      
      // 평균 별점 및 평가 개수 조회
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_menu_item_rating_stats', { item_id: menuItemId });
        
      console.log('통계 함수 결과:', statsData, statsError);

      // 사용자 별점 조회 (if logged in)
      let userRating = null;
      if (user) {
        const { data: ratingData, error: ratingError } = await supabase
          .from('menu_item_ratings')
          .select('rating')
          .eq('menu_item_id', menuItemId)
          .eq('user_id', user.id)
          .maybeSingle();
          
        console.log('사용자 별점 조회 결과:', ratingData, ratingError);

        userRating = ratingData?.rating;
      }

      if (statsError) {
        console.error('평균 별점 조회 오류:', statsError);
        return null;
      }
      
      const result = {
        avg_rating: statsData?.avg_rating || 0,
        rating_count: statsData?.rating_count || 0,
        user_rating: userRating
      };
      
      console.log('최종 별점 조회 결과:', result);
      return result;
    } catch (error) {
      console.error('별점 정보 조회 오류:', error);
      return null;
    }
  };

  // 초기 별점 조회
  useEffect(() => {
    const getRating = async () => {
      // 이미 아이템에 사용자 별점이 있으면 가져옴
      if (item.user_rating) {
        setRating(item.user_rating);
        setAvgRating(item.avg_rating);
        setRatingCount(item.rating_count);
        return;
      }

      // 사용자 권한 없으면 평균만 표시
      if (!user) {
        setAvgRating(item.avg_rating);
        setRatingCount(item.rating_count);
        return;
      }

      // 서버에서 데이터 가져오기
      const data = await fetchRating(item.id);
      if (data) {
        setRating(data.user_rating);
        setAvgRating(data.avg_rating);
        setRatingCount(data.rating_count);
      }
    };

    getRating();
  }, [item.id, user]);

  // 별점 클릭 이벤트 처리 함수
  const handleRating = async (value: number) => {
    // 로그인되지 않은 경우 로그만 출력
    if (!user) {
      console.log('로그인되지 않은 사용자는 별점을 남길 수 없습니다');
      // 어러트 추가 - 사용자에게 로그인 필요함을 알리기
      alert('별점을 남기려면 로그인해주세요!'); 
      return;
    }
    
    // 디버깅용 사용자 ID 확인
    console.log('별점 클릭 시 사용자 ID:', user.id);
    
    setIsLoading(true);
    setRating(value); // 화면에 바로 반영
    
    console.log('별점 만들기 시도:', value, '메뉴아이템 ID:', item.id);
    
    // Supabase에 저장
    const success = await saveRating(item.id, value);
    
    if (success) {
      // 성공 시 새로운 평균 별점 조회
      const updatedData = await fetchRating(item.id);
      if (updatedData) {
        setAvgRating(updatedData.avg_rating);
        setRatingCount(updatedData.rating_count);
      }
    } else {
      // 저장 실패 시 롤백
      setRating(item.user_rating);
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
