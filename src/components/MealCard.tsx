import MealImageUploader from '@/components/MealImageUploader';
import { formatDisplayDate } from '@/utils/DateUtils';
import { getMealTypeName } from '@/utils/mealUtils';
import { MealInfo, MealMenuItem, MealImage } from '@/types'; // 이미지 타입 추가
import StarRating from '@/components/StarRating';
import { useState, useEffect, useCallback, useRef } from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { createClient } from '@/lib/supabase';
import MyMealRating from '@/components/MyMealRating';
import SchoolRating from './SchoolRating';
// battleCalculator 제거됨
import useUserSchool from '@/hooks/useUserSchool';
import { useSchoolMode } from '@/hooks/useSchoolMode';

// Supabase 클라이언트 초기화
const supabase = createClient();

// 디버깅용 콘솔 로그
console.log('MealCard 컴포넌트 로드됨, Supabase 클라이언트 초기화');

// 별점 시간 제한 체크 함수 - 이미지 승인에 종속
const canRateAtCurrentTime = async (mealId: string): Promise<boolean> => {
  try {
    // 1. 이미지 승인 여부 체크
    const { data: approvedImage } = await supabase
      .from('meal_images')
      .select('id')
      .eq('meal_id', mealId)
      .eq('status', 'approved')
      .single();
      
    return !!approvedImage; // 승인된 이미지가 있으면 true
  } catch (error) {
    console.error('이미지 승인 상태 확인 오류:', error);
    return false;
  }
};

interface MealCardProps {
  meal: MealInfo;
  onShowOrigin(info: string): void;
  onShowNutrition(meal: MealInfo): void;
  onUploadSuccess(): void;
  onUploadError(error: string): void;
  showImageOnly?: boolean;
  showInfoOnly?: boolean;
}

// 별점 지정/표시 컴포넌트
function MenuItemWithRating({ item, interactive = true, mealDate }: { item: MealMenuItem; interactive?: boolean; mealDate?: string }) {
  // iOS Safari 호환성을 위해 useUserSchool 훅 사용 (일관된 사용자 상태 관리)
  const { user, userSchool, loading: userLoading } = useUserSchool();
  
  // 권한 확인
  const schoolMode = useSchoolMode(userSchool);
  const canRate = schoolMode.canPerformAction('canRate');
  
  // iOS Safari 및 사용자 상태 디버깅 로그
  useEffect(() => {
    console.log('🍎 MenuItemWithRating - 사용자 상태 상세:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      itemId: item?.id,
      itemName: item?.item_name,
      userObject: user,
      timestamp: new Date().toISOString()
    });
  }, [user, item?.id]);
  
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
            const newData = payload.new as { avg_rating?: number; rating_count?: number };
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
  // iOS Safari 호환성을 위한 강화된 상태 관리
  const [rating, setRating] = useState<number | null>(() => {
    // 초기값을 더 안전하게 설정
    return item.user_rating !== undefined ? item.user_rating : null;
  });
  const [avgRating, setAvgRating] = useState<number | null>(() => {
    return item.avg_rating !== undefined ? item.avg_rating : null;
  });
  const [ratingCount, setRatingCount] = useState<number | null>(() => {
    return item.rating_count !== undefined ? item.rating_count : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // iOS Safari 메모리 관리를 위한 상태 백업
  const ratingBackupRef = useRef<{
    rating: number | null;
    avgRating: number | null;
    ratingCount: number | null;
  }>({
    rating: item.user_rating || null,
    avgRating: item.avg_rating || null,
    ratingCount: item.rating_count || null
  });
  

  // 사용자 별점 저장 함수 (Netlify Functions 사용)
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
      
      console.log('💾 별점 저장 시도 (Netlify Functions):', menuItemId, rating);
      
      // 🔥 Netlify Functions를 통한 별점 저장 (배틀 계산 트리거 포함)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ 인증 토큰이 없습니다');
        return false;
      }
      
      const response = await fetch('/.netlify/functions/menu-ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          rating: rating
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 저장 오류:', result.error);
        return false;
      }
      
      console.log('✅ 별점 저장 성공 (배틀 계산 트리거 포함)!');
      return true;
    } catch (error) {
      console.error('❌ 별점 저장 중 오류:', error);
      return false;
    }
  };

  // 사용자 별점 삭제 함수 (Netlify Functions 사용)
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
      
      console.log('🗑️ 별점 삭제 시도 (Netlify Functions):', menuItemId);
      
      // 🔥 Netlify Functions를 통한 별점 삭제 (배틀 계산 트리거 포함)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ 인증 토큰이 없습니다');
        return false;
      }
      
      const response = await fetch('/.netlify/functions/menu-ratings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          menu_item_id: menuItemId
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 삭제 오류:', result.error);
        return false;
      }
      
      // 메뉴 아이템 별점 삭제 후 급식 평점 재계산 이벤트 발생
      console.log('🔄 메뉴 아이템 별점 삭제 성공, 급식 평점 재계산 필요');
      // 전역 이벤트 발생 - 급식 평점 재계산 요청
      const event = new CustomEvent('menu-item-rating-change', {
        detail: { menuItemId, deleted: true }
      });
      window.dispatchEvent(event);
      console.log('✅ 별점 삭제 성공 (배틀 계산 트리거 포함)!');
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
        user_rating: userRating
      };
      
      console.log('✅ 최종 별점 조회 결과:', result);
      return result;
    } catch (error) {
      console.error('별점 정보 조회 오류:', error);
      // 오류 발생시 기본값 반환
      return {
        user_rating: null
      };
    }
  };

  // iOS Safari 호환성을 위한 강화된 별점 상태 초기화 함수
  const initRatingState = async () => {
    try {
      console.log('🍎 iOS 호환 별점 초기화 시작 - 아이템:', item.id);
      
      // 1. localStorage 백업부터 확인 (iOS Safari 최우선 복원)
      if (user?.id) {
        try {
          const backupKey = `rating_backup_${item.id}_${user.id}`;
          const backupData = localStorage.getItem(backupKey);
          if (backupData) {
            const parsed = JSON.parse(backupData);
            // 백업이 24시간 이내인지 확인 (오래된 백업은 무시)
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
              console.log('💾 localStorage 백업 복원:', parsed.rating);
              setRating(parsed.rating);
              
              // 메모리 백업도 업데이트
              ratingBackupRef.current.rating = parsed.rating;
              return;
            }
          }
        } catch (e) {
          console.warn('localStorage 백업 읽기 실패:', e);
        }
      }
      
      // 2. 메모리 백업 확인 (iOS Safari 메모리 이슈 대응)
      if (ratingBackupRef.current.rating !== null) {
        setRating(ratingBackupRef.current.rating);
        return;
      }
      
      // 2. 프롭스에서 전달된 별점 정보 사용
      if (item.user_rating !== undefined) {
        console.log('📊 프롭스 별점 정보 사용:', item.user_rating);
        const newRating = item.user_rating;
        
        setRating(newRating);
        
        // 백업에도 저장 (iOS Safari 메모리 관리)
        ratingBackupRef.current.rating = newRating;
        
        // iOS Safari를 위한 localStorage 영구 백업
        if (user?.id) {
          try {
            const backupKey = `rating_backup_${item.id}_${user.id}`;
            localStorage.setItem(backupKey, JSON.stringify({
              rating: newRating,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('localStorage 백업 실패:', e);
          }
        }
        return;
      }

      // 3. 서버에서 데이터 조회 (마지막 수단)
      console.log('🌐 서버에서 별점 데이터 조회');
      const data = await fetchRating(item.id);
      
      if (data) {
        setRating(data.user_rating);
        
        // 백업에도 저장
        ratingBackupRef.current.rating = data.user_rating;
      } else {
        // 조회 실패 시 기본값 사용
        setRating(null);
        
        // 백업 초기화
        ratingBackupRef.current.rating = null;
      }
    } catch (error) {
      console.error('🚨 별점 데이터 초기화 중 오류:', error);
    }
  };

  // 전체 통계 조회 (초기 로드 및 아이템 변경 시)
  useEffect(() => {
    const fetchStats = async () => {
      if (!item?.id) return;
      const { data, error } = await supabase
        .from('menu_item_rating_stats')
        .select('avg_rating, rating_count')
        .eq('menu_item_id', item.id)
        .single();

      if (data) {
        setAvgRating(data.avg_rating);
        setRatingCount(data.rating_count);
      } else {
        setAvgRating(null);
        setRatingCount(0);
      }
    };
    fetchStats();
  }, [item?.id]);

  // 개인 별점 조회 (사용자 변경 시)
  useEffect(() => {
    if (item && item.id) {
      initRatingState();
    }
  }, [item.id, user]);

  // iOS Safari 페이지 포커스 복원 시 상태 복원
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        console.log('📱 iOS Safari 페이지 포커스 복원 - 별점 상태 확인');
        
        // localStorage에서 최신 백업 확인
        try {
          const backupKey = `rating_backup_${item.id}_${user.id}`;
          const backupData = localStorage.getItem(backupKey);
          if (backupData) {
            const parsed = JSON.parse(backupData);
            // 백업이 24시간 이내이고 현재 상태와 다르면 복원
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 && rating !== parsed.rating) {
              setRating(parsed.rating);
              setAvgRating(parsed.avgRating);
              setRatingCount(parsed.ratingCount);
              
              // 메모리 백업도 동기화
              ratingBackupRef.current = {
                rating: parsed.rating,
                avgRating: parsed.avgRating,
                ratingCount: parsed.ratingCount
              };
              return;
            }
          }
        } catch (e) {
          console.warn('포커스 복원 시 localStorage 읽기 실패:', e);
        }
        
        // localStorage 백업이 없으면 메모리 백업 확인
        if (ratingBackupRef.current.rating !== null && rating !== ratingBackupRef.current.rating) {
          setRating(ratingBackupRef.current.rating);
          setAvgRating(ratingBackupRef.current.avgRating);
          setRatingCount(ratingBackupRef.current.ratingCount);
        }
      }
    };

    // iOS Safari에서만 이벤트 리스너 추가
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
    if (isIOSSafari) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);
      window.addEventListener('pageshow', handleVisibilityChange); // iOS Safari 백그라운드 복원 대응
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleVisibilityChange);
        window.removeEventListener('pageshow', handleVisibilityChange);
      };
    }
  }, [rating, user?.id, item.id]);

  // 별점 클릭 이벤트 처리 함수 - 별 사라짐 문제 해결 + 별점 취소(삭제) 지원
  const handleRating = async (value: number) => {
    try {
      // 상세 로그인 상태 디버깅
      if (userLoading) {
        alert(`⏳ 로딩 중입니다. 잠시만 기다려주세요.`);
        return;
      }

      // 상세 로그인 상태 디버깅
      console.log('🎯 별점 클릭 디버깅:', {
        value,
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        itemId: item?.id,
        itemName: item?.item_name,
        currentRating: rating,
        timestamp: new Date().toISOString()
      });
      
      // 로그인 확인
      if (!user) {
        alert(`❌ 로그인이 필요합니다!\n\n다시 로그인해주세요.`);
        return;
      }
      
      // 권한 확인
      console.log('🔒 별점 클릭 시 권한 체크:', {
        canRate,
        currentMode: schoolMode.currentMode,
        isStudentMode: schoolMode.isStudentMode,
        userId: user?.id
      });
      
      if (!canRate) {
        console.log('❌ 별점 권한 없음 - 방문자 모드');
        alert('내 학교에서만 별점을 남길 수 있습니다.');
        return;
      }
      if (!item.id) {
        console.error('메뉴 아이템 ID가 없습니다');
        return;
      }
      
      // 시간 제한 체크 - 개발자 도구 등으로 UI 조작 우회 방지
      if (mealDate && !canRateAtCurrentTime(mealDate)) {
        // 조용히 차단 (메시지 없이)
        return;
      }
      setIsLoading(true);
      const previousRating = rating;

      // 이미 선택된 별을 다시 클릭하면 별점 삭제
      if (rating === value) {
        setRating(null); // UI에서 별점 제거
        
        // iOS Safari 백업도 업데이트
        ratingBackupRef.current.rating = null;
        
        // localStorage 백업도 삭제
        if (user?.id) {
          try {
            const backupKey = `rating_backup_${item.id}_${user.id}`;
            localStorage.removeItem(backupKey);
          } catch (e) {
            console.warn('localStorage 백업 삭제 실패:', e);
          }
        }
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
          
          // iOS Safari 백업도 되돌리기
          ratingBackupRef.current.rating = previousRating;
          
          // localStorage 백업도 되돌리기 (삭제 실패)
          if (user?.id) {
            try {
              const backupKey = `rating_backup_${item.id}_${user.id}`;
              if (previousRating !== null) {
                localStorage.setItem(backupKey, JSON.stringify({
                  rating: previousRating,
                  avgRating: avgRating,
                  ratingCount: ratingCount,
                  timestamp: Date.now()
                }));
              }
            } catch (e) {
              console.warn('localStorage 백업 되돌리기 실패:', e);
            }
          }
          
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
        
        // iOS Safari 백업도 업데이트
        ratingBackupRef.current.rating = value;
        
        // localStorage 백업도 업데이트
        if (user?.id) {
          try {
            const backupKey = `rating_backup_${item.id}_${user.id}`;
            localStorage.setItem(backupKey, JSON.stringify({
              rating: value,
              avgRating: avgRating,
              ratingCount: ratingCount,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('localStorage 백업 실패:', e);
          }
        }
        
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
          
          // iOS Safari 백업도 되돌리기
          ratingBackupRef.current.rating = previousRating;
          
          // localStorage 백업도 되돌리기 (저장 실패)
          if (user?.id) {
            try {
              const backupKey = `rating_backup_${item.id}_${user.id}`;
              if (previousRating !== null) {
                localStorage.setItem(backupKey, JSON.stringify({
                  rating: previousRating,
                  avgRating: avgRating,
                  ratingCount: ratingCount,
                  timestamp: Date.now()
                }));
              } else {
                localStorage.removeItem(backupKey);
              }
            } catch (e) {
              console.warn('localStorage 백업 되돌리기 실패:', e);
            }
          }
          
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
            interactive={interactive && canRate && !userLoading}
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
  showImageOnly = false,
  showInfoOnly = false,
}: MealCardProps) {
  // 메뉴 평가 권한 상태 관리
  const [canRate, setCanRate] = useState<boolean>(false);
  
  // 이미지 승인 상태에 따른 평가 권한 확인
  useEffect(() => {
    const checkRatingPermission = async () => {
      if (Array.isArray(meal.menu_items) && meal.menu_items.length === 1 && meal.menu_items[0] === '급식 정보가 없습니다') {
        setCanRate(false);
      } else {
        const allowed = await canRateAtCurrentTime(meal.id);
        setCanRate(allowed);
      }
    };
    
    checkRatingPermission();
  }, [meal.id, meal.menu_items]);

  // 이미지 업로드 성공 시 호출되는 함수 (단순화됨)
  const handleImageChange = useCallback(() => {
    console.log('📣 이미지 변경 알림 받음');
    
    // 이미지 변경 시 평가 권한 재확인
    const recheckPermission = async () => {
      const allowed = await canRateAtCurrentTime(meal.id);
      setCanRate(allowed);
    };
    recheckPermission();
    
    // 최상위 컴포넌트의 콜백 호출 (있는 경우)
    if (onUploadSuccess) {
      onUploadSuccess();
    }
  }, [onUploadSuccess, meal.id]);

  // 이미지만 표시하는 경우
  if (showImageOnly) {
    return (
      <div className="bg-white overflow-hidden rounded-lg shadow-sm">
        <div className="p-2">
          <MealImageUploader
            key={`uploader-${meal.id}-${meal.meal_date}`}
            schoolCode={meal.school_code}
            mealDate={meal.meal_date}
            mealType={meal.meal_type}
            onUploadSuccess={handleImageChange}
            onUploadError={onUploadError}
          />
        </div>
      </div>
    );
  }

  // 정보만 표시하는 경우
  if (showInfoOnly) {
    return (
      <div className="bg-white overflow-hidden rounded-lg shadow-sm h-full">
        <div className="p-4 h-full flex flex-col">
          {/* 학교 별점 */}
          <SchoolRating schoolCode={meal.school_code} mealId={meal.id} className="mb-4" />

          {/* 원산지/영양정보 버튼 */}
          <div className="flex justify-between items-center mb-4 text-xs">
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
              <div className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                {meal.kcal}kcal
              </div>
            )}
          </div>

          {/* 오늘 나의 평가는? 섹션 */}
          <div className="mb-4">
            <MyMealRating mealId={meal.id} />
          </div>

          {/* 메뉴 목록 */}
          <div className="flex-1">
            <ul className="space-y-3">
              {meal.menuItems && meal.menuItems.length > 0 ? (
                meal.menuItems.map((item) => (
                  <MenuItemWithRating
                    key={item.id}
                    item={item}
                    mealDate={meal.meal_date}
                    interactive={canRate}
                  />
                ))
              ) : (
                meal.menu_items.map((item, idx) => (
                  <li key={idx} className="text-gray-700 py-1">
                    {item}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 기본 전체 표시 (모바일용)
  return (
    <div className="bg-white overflow-hidden">

      {/* 본문 */}
      <div className="p-2">

        {/* 학교 별점 */}
        <SchoolRating schoolCode={meal.school_code} mealId={meal.id} className="mb-2" />

        {/* 이미지 업로더 */}
        <MealImageUploader
          key={`uploader-${meal.id}-${meal.meal_date}`} /* 날짜 변경 시 컴포넌트 재마운트 */
          schoolCode={meal.school_code}
          mealDate={meal.meal_date}
          mealType={meal.meal_type}
          onUploadSuccess={handleImageChange} /* 로컨 핸들러로 변경 */
          onUploadError={onUploadError}
        />

        {/* 원산지/영양정보 버튼 */}
        <div className="flex justify-between items-center my-2 text-xs">
          <div className="flex items-center gap-2">
            {meal.origin_info && (
              <button
                onClick={() => onShowOrigin(meal.origin_info!)}
                className="text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                원산지
              </button>
            )}
            {(meal.kcal || meal.ntr_info) && (
              <button
                onClick={() => onShowNutrition(meal)}
                className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                영양정보
              </button>
            )}
          </div>
          {meal.kcal && (
            <div className="bg-orange-100 text-orange-800 text-xs px-1.5 py-0.5 rounded">
              {meal.kcal}kcal
            </div>
          )}
        </div>

        {/* 오늘 나의 평가는? 섹션 */}
        <div className="mt-3">
          <MyMealRating mealId={meal.id} />
        </div>

        {/* 목록 */}
        <div className="mb-4">
          <ul className="space-y-2">
            {meal.menuItems && meal.menuItems.length > 0 ? (
              // 개별 메뉴 아이템 표시 (새로운 데이터 구조 사용 + 별점 기능)
              meal.menuItems.map((item, idx) => (
                <MenuItemWithRating
                  key={idx}
                  item={{ id: `${meal.id}-${idx}`, name: item }}
                  mealDate={meal.meal_date}
                  interactive={canRate}
                />
              ))
            ) : (
              // 기존 menu_items 배열 사용 (하위 호환성 유지)
              meal.menu_items.map((item, idx) => (
                <MenuItemWithRating
                  key={idx}
                  item={{ id: `${meal.id}-${idx}`, name: item }}
                  mealDate={meal.meal_date}
                  interactive={canRate}
                />
              ))
            )}
          </ul>
        </div>

        {/* 버튼들 상단으로 이동함 */}
      </div>
    </div>
  );
}
