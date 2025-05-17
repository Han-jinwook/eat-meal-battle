import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { MealInfo, MealMenuItem } from '@/types'; // 메뉴 아이템 타입 추가
import StarRating from '@/components/StarRating';
import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

interface MealCardProps {
  meal: MealInfo;
  onShowOrigin(info: string): void;
  onShowNutrition(meal: MealInfo): void;
  onUploadSuccess(): void;
  onUploadError(error: string): void;
}

// 메뉴 아이템 별점 저장 함수
async function saveRating(menuItemId: string, rating: number) {
  try {
    // 현재 Supabase 세션 토큰 가져오기 (이전 방식 대신 직접 API 토큰 사용)
    // 개발용으로 토큰 없이도 작동하도록 설정
    console.log('별점 저장 시도:', menuItemId, rating);
    
    const response = await fetch('/api/menu-ratings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 개발 테스트를 위해 인증 헤더 제거
        // 'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        menu_item_id: menuItemId,
        rating,
        test_mode: true // 테스트 모드 플래그 추가
      })
    });
    
    const data = await response.json();
    console.log('별점 저장 응답:', data);
    return data.success || true; // 테스트를 위해 항상 성공 처리
  } catch (error) {
    console.error('별점 저장 오류:', error);
    alert('별점 저장 중 오류가 발생했습니다.');
    return false;
  }
}

// 메뉴 아이템 별점 조회 함수
async function fetchRating(menuItemId: string) {
  try {
    const token = localStorage.getItem('supabase.auth.token');
    
    const response = await fetch(`/api/menu-ratings?menu_item_id=${menuItemId}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    
    return await response.json();
  } catch (error) {
    console.error('별점 조회 오류:', error);
    return null;
  }
}

// 메뉴 아이템 컴포넌트
const MenuItemWithRating = ({ item }: { item: MealMenuItem }) => {
  const [rating, setRating] = useState<number | undefined>(item.user_rating);
  const [avgRating, setAvgRating] = useState<number | undefined>(item.avg_rating);
  const [ratingCount, setRatingCount] = useState<number | undefined>(item.rating_count);
  const [isLoading, setIsLoading] = useState(false);
  const user = useUser();
  
  useEffect(() => {
    // 컴포넌트 마운트 시 최신 별점 정보 조회
    const getRating = async () => {
      if (item.id) {
        const ratingData = await fetchRating(item.id);
        if (ratingData) {
          setAvgRating(ratingData.avg_rating);
          setRatingCount(ratingData.rating_count);
          setRating(ratingData.user_rating);
        }
      }
    };
    
    getRating();
  }, [item.id]);
  
  // 별점 클릭 이벤트 처리 함수
  const handleRating = async (value: number) => {
    console.log('별점 클릭 발생!', value);
    
    // 사용자 로그인 여부 체크 제거 (UX 테스트 용)
    if (isLoading) return;
    
    setIsLoading(true);
    setRating(value); // 즉시 UI 업데이트
    
    try {
      // 로컬 상태 업데이트를 위해 가상 데이터 사용
      // 개발 중에는 수동으로 업데이트
      const prevAvg = avgRating || 0;
      const prevCount = ratingCount || 0;
      const newCount = prevCount + 1;
      const newAvg = ((prevAvg * prevCount) + value) / newCount;
      
      setAvgRating(newAvg);
      setRatingCount(newCount);
      
      // 비동기로 API 호출 (결과 기다리지 않음)
      saveRating(item.id, value).then(success => {
        console.log('별점 저장 결과:', success);
      });
    } catch (err) {
      console.error('처리 오류:', err);
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
