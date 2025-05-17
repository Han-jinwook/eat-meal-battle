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
    const token = localStorage.getItem('supabase.auth.token');
    
    const response = await fetch('/api/menu-ratings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        menu_item_id: menuItemId,
        rating
      })
    });
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('별점 저장 오류:', error);
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
  
  const handleRating = async (value: number) => {
    if (!user || isLoading) return;
    
    setIsLoading(true);
    setRating(value); // 즉시 UI 업데이트
    
    const success = await saveRating(item.id, value);
    if (success) {
      // 저장 성공 후 업데이트된 정보 조회
      const updatedData = await fetchRating(item.id);
      if (updatedData) {
        setAvgRating(updatedData.avg_rating);
        setRatingCount(updatedData.rating_count);
      }
    } else {
      // 저장 실패 시 롤백
      setRating(item.user_rating);
    }
    
    setIsLoading(false);
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
