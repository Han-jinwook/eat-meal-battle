import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { MealInfo, MealMenuItem, MealImage } from '@/types'; // 이미지 타입 추가
import StarRating from '@/components/StarRating';
import { useState, useEffect, useCallback } from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
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
  
  // 실시간 구독 설정: menu_item_rating_stats 테이블 변경 감지
  useEffect(() => {
    if (!item || !item.id) return;
    
    console.log('🔌 menu_item_rating_stats 테이블 실시간 구독 설정 - 아이템 ID:', item.id);
    
    // 실시간 업데이트를 위한 채널 생성
    const channel = supabase
      .channel(`menu_item_rating_stats:${item.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'menu_item_rating_stats',
          filter: `menu_item_id=eq.${item.id}` 
        }, 
        (payload) => {
          console.log('🔄 아이템평점 실시간 업데이트 수신:', payload);
          // 새 데이터로 상태 업데이트
          if (payload.new) {
            const newData = payload.new;
            setAvgRating(newData.avg_rating || 0);
            setRatingCount(newData.rating_count || 0);
            console.log('✅ 아이템평점 UI 업데이트 완료:', newData.avg_rating, newData.rating_count);
          }
        }
      )
      .subscribe();
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('🔌 menu_item_rating_stats 테이블 구독 해제 - 아이템 ID:', item.id);
      supabase.removeChannel(channel);
    };
  }, [item?.id]); // 아이템 ID가 변경될 때만 재실행
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
      let avgRating = 0;
      if (ratings.length > 0) {
        // 소수점 둘째 자리에서 반올림하여 결과 값 생성
        const sum = ratings.reduce((sum, item) => sum + item.rating, 0);
        const avg = sum / ratings.length;
        avgRating = Math.round(avg * 10) / 10; // 소수점 둘째 자리에서 반올림
      }
      const ratingCount = ratings.length;

      console.log('계산된 통계:', { avgRating, ratingCount });

      // 사용자 별점 조회
      let userRating = null;
      if (user && user.id) {
        // 현재 사용자의 별점 조회 - single() 대신 limit(1) 사용
        const { data: ratingData, error: ratingError } = await supabase
          .from('menu_item_ratings')
          .select('rating')
          .eq('menu_item_id', menuItemId)
          .eq('user_id', user.id)
          .limit(1);

        // 오류 처리
        if (ratingError) {
          console.error('❌ 사용자 별점 조회 오류:', ratingError.message);
        } else {
          // 배열에서 첫 번째 항목 사용 (존재할 경우)
          if (ratingData && ratingData.length > 0) {
            userRating = ratingData[0].rating;
            console.log('✅ 사용자 별점 조회 성공:', userRating);
          } else {
            console.log('ℹ️ 사용자 별점 기록 없음');
          }
        }
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
        }
        
        console.log('클릭한 별점이 이미 저장된 별점과 같음, 별점 삭제 시도');
        
        // 이벤트 발생 - 다른 컴포넌트에 변경 알리기
        const event = new CustomEvent('menu-item-rating-change', {
          detail: { menuItemId: item.id, deleted: true, previousRating }
        });
        window.dispatchEvent(event);
        
        // 서버에 삭제 요청 전송
        const success = await deleteRating(item.id);
        
        if (!success) {
          // 삭제 실패시 이전 상태로 되돌리기
          console.warn('별점 삭제 실패, 이전 상태 유지');
          setRating(previousRating);
          // 위에서 변경한 평균도 되돌려야 함
          await fetchRating(item.id); // 실제 최신 데이터로 다시 재조회
        } else {
          console.log('별점 삭제 성공, UI 이미 업데이트됨');
          
          // 약간의 지연 후 실제 데이터로 업데이트 (최종 확인)
          setTimeout(async () => {
            await fetchRating(item.id);
          }, 500);
        }
      } else {
        // 새로운 별점 저장 - 이곳도 낙관적 업데이트 적용
        setRating(value);
        
        // 평균 별점 및 카운트 임시 업데이트 (단순 예상)
        if (avgRating && ratingCount) {
          const oldSum = avgRating * ratingCount;
          // 처음 별점이면 카운트 증가, 그렇지 않으면 이전 별점 반영
          const newCount = previousRating === null ? ratingCount + 1 : ratingCount;
          const newSum = previousRating === null ? oldSum + value : oldSum - previousRating + value;
          const newAvg = newSum / newCount;
          setAvgRating(Math.round(newAvg * 10) / 10);
          setRatingCount(newCount);
        } else {
          // 처음 별점이면 바로 설정
          setAvgRating(value);
          setRatingCount(1);
        }
        
        console.log('새로운 별점 저장 시도:', value);
        
        // 이벤트 발생 - 다른 컴포넌트에 변경 알리기
        const event = new CustomEvent('menu-item-rating-change', {
          detail: { menuItemId: item.id, newRating: value, previousRating }
        });
        window.dispatchEvent(event);
        
        // 서버에 저장 요청 전송
        const success = await saveRating(item.id, value);
        
        if (!success) {
          // 저장 실패시 이전 상태로 되돌리기
          console.warn('별점 저장 실패, 이전 상태로 복원');
          setRating(previousRating);
          // 위에서 변경한 평균도 되돌려야 함
          await fetchRating(item.id); // 실제 최신 데이터로 다시 재조회
        } else {
          console.log('별점 저장 성공, UI 이미 업데이트됨');
          
          // 약간의 지연 후 실제 데이터로 업데이트 (최종 확인)
          setTimeout(async () => {
            await fetchRating(item.id);
          }, 500);
        }
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
      
      {/* 평균 별점 표시 - 소수점 첨째자리까지만 표시 */}
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
  // 이미지 목록 상태 관리
  const [approvedImages, setApprovedImages] = useState<MealImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // 이미지 목록 가져오기 함수
  const fetchMealImages = useCallback(async () => {
    if (!meal?.id) return;
    
    try {
      setLoadingImages(true);
      console.log('🔍 이미지 목록 조회 시작 - meal_id:', meal.id);
      
      // 승인된 이미지만 조회 (임의의 파라미터를 추가하여 캐시 방지)
      const timestamp = new Date().getTime(); // 현재 시간을 캐시 방지용으로 사용
      const { data, error } = await supabase
        .from('meal_images')
        .select(`
          *,
          users!uploaded_by(id, nickname, profile_image)
        `)
        .eq('meal_id', meal.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20); // 이미지 수 제한
      
      if (error) {
        console.error('❌ 이미지 로드 오류:', error);
        return;
      }
      
      // 이미지 데이터 확인 (자세한 디버깅)
      console.log('🧑‍💻 이미지 데이터 상세 확인:', data?.map(img => ({
        id: img.id,
        uploaded_by: img.uploaded_by,
        created_at: img.created_at,
        status: img.status,
        nickname: img.users?.nickname || '익명',
        hasUserInfo: !!img.users
      })));
      
      setApprovedImages(data || []);
      console.log('✅ 이미지 목록 로드 완료:', data?.length || 0, '개');
    } catch (error) {
      console.error('❌ 이미지 조회 중 오류:', error);
    } finally {
      setLoadingImages(false);
    }
  }, [meal?.id]); // meal.id가 바뀔 때만 함수 재생성
  
  // 컴포넌트 마운트 시 이미지 목록 로드
  useEffect(() => {
    if (meal?.id) {
      fetchMealImages();
    }
  }, [meal?.id, fetchMealImages]);
  
  // meal_images 테이블의 변경사항 실시간 구독 설정
  useEffect(() => {
    if (!meal?.id) return;
    
    console.log('🔗 meal_images 테이블 실시간 구독 설정 - meal_id:', meal.id);
    
    // 실시간 업데이트를 위한 채널 생성
    const channel = supabase
      .channel(`meal-images-${meal.id}`)
      .on('postgres_changes', 
        { 
          event: '*', // 모든 이벤트(INSERT, UPDATE, DELETE) 감지
          schema: 'public', 
          table: 'meal_images',
          filter: `meal_id=eq.${meal.id}` // 현재 meal.id에 해당하는 변경만 감지
        }, 
        (payload) => {
          console.log('🔄 이미지 실시간 업데이트 수신:', payload);
          
          // 상태 변경 (승인/반려 등) 또는 새 이미지 업로드시 발생
          // 지연을 주어 DB에 변경사항이 완전히 반영되도록 함
          setTimeout(() => {
            console.log('🔄 이미지 목록 새로고침 시작');
            fetchMealImages(); // 이미지 목록 다시 불러와 상태 갱신
          }, 500);
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ meal_images 구독 성공:', meal.id);
          // 구독 성공 후 초기 데이터 로드
          fetchMealImages();
        }
      });
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('🔗 meal_images 테이블 구독 해제:', meal.id);
      supabase.removeChannel(channel);
    };
  }, [meal?.id, fetchMealImages]); // meal.id가 바뀔 때만 재실행
  
  // 이미지 업로드/승인 시 호출되는 함수 (로컨 핸들러)
  const handleImageChange = useCallback(() => {
    console.log('📣 이미지 변경 알림 받음, 목록 새로고침');
    fetchMealImages(); // 이미지 목록 다시 로드
    
    // 최상위 컴포넌트의 콜백도 호출 (있는 경우)
    if (onUploadSuccess) {
      onUploadSuccess();
    }
  }, [fetchMealImages, onUploadSuccess]);
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
          onUploadSuccess={handleImageChange} /* 로컨 핸들러로 변경 */
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

        {/* 승인된 이미지 보기 */}
        {approvedImages.length > 0 && (
          <div className="mt-4">
            <h4 className="text-lg font-medium mb-2">승인된 이미지</h4>
            <div className="grid grid-cols-2 gap-2">
              {approvedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                    <ImageWithFallback
                      src={img.image_url}
                      alt={`급식 이미지 - ${meal.meal_date} ${meal.meal_type}`}
                      className="w-full h-40 object-cover rounded-md"
                      width={150}
                      height={150}
                    />
                  </a>
                  
                  {/* 사용자 닉네임 표시 - DB 스키마에 맞게 수정 필요 */}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 버튼들 상단으로 이동함 */}
      </div>
    </div>
  );
}
