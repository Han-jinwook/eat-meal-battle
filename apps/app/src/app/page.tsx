'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase'; // 아직 일부 로직에서 사용
import useUserSchool from '@/hooks/useUserSchool';
import Link from 'next/link';
import MealCard from '@/components/MealCard';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useMeals from '@/hooks/useMeals';
import useModal from '@/hooks/useModal';
import { MealInfo } from '@/types'; // types.ts에서 가져오도록 수정
import { CommentSection } from '@/components/comments';
import DateNavigator from '@/components/DateNavigator';
import ShareButton from '@/components/ShareButton';
import ShareModal from '@/components/ShareModal';
// 디버그 패널 제거

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  
  // 공유 모달 상태 관리
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [currentMeal, setCurrentMeal] = useState<MealInfo | null>(null);

  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError } = useUserSchool();

  // URL에서 날짜 매개변수 가져오기
  // 클라이언트 사이드에서만 처리
  const [dateParam, setDateParam] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // URL 매개변수를 사용하여 날짜 갱신하는 함수
  const updateDateWithUrl = (date: string) => {
    // 상태 업데이트
    setSelectedDate(date);
    
    // 클라이언트에서만 실행 (window 객체 존재 확인)
    if (typeof window !== 'undefined') {
      try {
        // 현재 URL 매개변수 복사
        const params = new URLSearchParams(window.location.search);
        // 날짜 매개변수 업데이트
        params.set('date', date);
        
        // 히스토리 상태 업데이트 (페이지 새로고침 없이)
        const url = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', url);
      } catch (error) {
        console.error('주소 갱신 오류:', error);
      }
    }
  };

  // 이미지 업로드 관련 상태
  const [refreshImageList, setRefreshImageList] = useState(0);

  // 날짜 관련 유틸리티 함수는 @/utils/DateUtils로 이동

  // 페이지 자체 로딩/에러 (사용자·학교 정보용)
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  // 급식 데이터 훅
  const {
    meals,
    isLoading,
    error,
    dataSource,
    fetchMealInfo,
  } = useMeals();

  // userError 발생 시 오류 처리 및 로그인 페이지 리다이렉트
  useEffect(() => {
    if (userError) {
      // Auth session missing 에러인 경우 로그인 페이지로 리다이렉트
      if (userError.includes('Auth session missing') || userError.includes('session missing')) {
        router.push('/login');
        return;
      }
      setPageError(userError);
    }
  }, [userError, router]);

  // 클라이언트 사이드에서 URL 매개변수 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateFromUrl = params.get('date');
      
      // URL에서 날짜 파라미터가 있으면 그 값을 사용, 없으면 오늘 날짜 사용
      const dateToUse = dateFromUrl || getCurrentDate();
      console.log('URL에서 날짜 초기화:', { dateFromUrl, dateToUse });
      
      // 상태 업데이트 - selectedDate를 설정하여 날짜 기억
      setDateParam(dateFromUrl);
      setSelectedDate(dateToUse);
      
      // 기존 handleDateChange 함수에서 급식 정보를 가져오는 로직이 있으므로 여기서는 하지 않음
    }
  }, []);

  // URL 파라미터에서 notification ID 가져오기
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const notificationId = params.get('notification');

    if (notificationId) {
      // notification_id로 관련된 급식 정보 조회
      const fetchNotificationMeal = async () => {
        // ============== TEST LOG START ============== 
        console.log('CASCADE_TEST_LOG: fetchNotificationMeal called with notificationId:', notificationId, 'at', new Date().toISOString());
        // ============== TEST LOG END ============== 

        try {
          // 1. 알림 정보 조회
          const { data: notification, error: notificationError } = await supabase
            .from('notifications')
            .select('related_type, related_id')
            .eq('id', notificationId)
            .maybeSingle();

          if (notificationError && notificationError.code !== 'PGRST116') {
            console.error('알림 조회 오류:', notificationError);
            setPageLoading(false);
            updateDateWithUrl(getCurrentDate());
            return;
          }

          if (!notification || !notification.related_id) {
            console.log('Notification found, but no valid related_id for id:', notificationId, 'Notification object:', notification);
            updateDateWithUrl(getCurrentDate());
            return;
          }

          console.log('Proceeding to fetch meal with related_id:', notification.related_id);

          // 2. 급식 정보 조회
          const { data: meal, error: mealError } = await supabase
            .from('meals')
            .select('meal_date') // Original select in code
            .eq('id', notification.related_id)
            .maybeSingle();

          // Check for meal data first, then for error if data is missing
          if (!meal?.meal_date) {
            console.log('Meal not found for related_id:', notification.related_id);
            if (mealError && mealError.code !== 'PGRST116') { // PGRST116 (0 rows) is expected for maybeSingle if not found
              console.error('Error fetching meal (when meal data is missing):', mealError);
            }
            updateDateWithUrl(getCurrentDate()); // Set to today if no specific meal to show
            return;
          }

          // If meal data exists but there was still some other error
          if (mealError && mealError.code !== 'PGRST116') {
            // Potentially throw or handle, but data is prioritized if available
          }

          // YYYYMMDD 형식을 YYYY-MM-DD로 변환
          const formattedDate = meal.meal_date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
          updateDateWithUrl(formattedDate);

        } catch (error) {
          // This catch is for unexpected errors during the async operations
          console.error('알림 관련 급식 정보 조회 중 예기치 않은 실패:', error);
          updateDateWithUrl(getCurrentDate());
        }
      };

      fetchNotificationMeal();
    }
    // URL에 날짜 파라미터가 있는 경우
    else if (dateParam && !userLoading) {
      // 유효한 날짜 형식인지 확인
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        updateDateWithUrl(dateParam);
      } else {
        updateDateWithUrl(getCurrentDate());
      }
    }
    // 다른 파라미터 없을 경우 오늘 날짜로 설정
    else if (!selectedDate && !userLoading && userSchool) {
      updateDateWithUrl(getCurrentDate());
    }
  }, [dateParam, userLoading, userSchool, supabase]);

  // 페이지 진입 시 학교 정보와 날짜가 설정되면 급식 정보 자동 로드
  useEffect(() => {
    // 학교 정보와 날짜가 모두 있을 때만 실행
    if (userSchool?.school_code && selectedDate && !pageLoading && !isLoading && !userLoading) {
      console.log(`급식 정보 자동 로드 - 학교: ${userSchool.school_code}, 날짜: ${selectedDate}`);
      // 페이지 진입 시 자동 로드에서 발생하는 문제 해결을 위한 디버깅 로그
      console.log(`자동 로드 시 날짜 형식: ${selectedDate}, 타입: ${typeof selectedDate}`);
      fetchMealInfo(userSchool.school_code, selectedDate, resolveOfficeCode());
    }
  }, [userSchool?.school_code, selectedDate, pageLoading, userLoading]);

  // 주말 체크 함수는 @/utils/DateUtils로 이동

  // 교육청 코드 파악 함수
  const getOfficeCode = (region: string): string => {
    // 교육청 코드 매핑
    const officeCodes: { [key: string]: string } = {
      '서울': 'B10',
      '부산': 'C10',
      '대구': 'D10',
      '인천': 'E10',
      '광주': 'F10',
      '대전': 'G10',
      '울산': 'H10',
      '세종': 'I10',
      '경기': 'J10',
      '강원': 'K10',
      '충북': 'M10',
      '충남': 'N10',
      '전북': 'P10',
      '전남': 'Q10',
      '경북': 'R10',
      '경남': 'S10',
      '제주': 'T10'
    };

    // 지역명에서 첫 2글자만 추출하여 매칭
    for (const [key, code] of Object.entries(officeCodes)) {
      if (region && region.includes(key)) {
        return code;
      }
    }

    // 기본값: 서울
    return 'B10';
  };

  // userSchool 정보 기준 officeCode 결정
  const resolveOfficeCode = () => {
    let office = 'E10';
    if (userSchool) {
      if (userSchool.office_code) {
        office = userSchool.office_code;
      } else if (userSchool.region) {
        office = getOfficeCode(userSchool.region);
      }
    }
    return office;
  };

  // 날짜 변경 핸들러 - 날짜 변경 시 자동으로 조회
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    // URL 파라미터와 상태 동시 업데이트
    updateDateWithUrl(newDate);
    // 날짜 변경 시 기존 오류 메시지 초기화
    setPageError('');
    
    // 학교 정보가 있으면 자동으로 급식 정보 조회
    if (userSchool?.school_code) {
      fetchMealInfo(userSchool.school_code, newDate, resolveOfficeCode());
      
      // 이미지 목록 새로고침 트리거 - 급식 정보 가져온 후 약간의 지연 후 이미지 목록 갱신
      setTimeout(() => {
        setRefreshImageList(prev => prev + 1);
      }, 300);
    }
  };

  // 급식 타입별 아이콘
  const getMealTypeIcon = (mealType: string) => {
    switch(mealType) {
      case '조식':
        return '🍳'; // 아침
      case '중식':
        return '🍚'; // 점심
      case '석식':
        return '🍲'; // 저녁
      case '간식':
        return '🍪'; // 간식
      default:
        return '🍽️'; // 기본
    }
  };

  // 모달 표시 함수
  const { isOpen: showModal, title: modalTitle, content: modalContent, openModal, closeModal } = useModal();

  // 영양정보 모달 표시 함수
  const showNutritionModal = (meal: MealInfo) => {
    openModal('영양 정보', formatNutritionInfo(meal));
  };

  // 영양정보 포맷팅 함수 - 단순화 버전 (서버에서 이미 정규화된 데이터를 받음)
  const formatNutritionInfo = (meal: MealInfo): string => {
    if (!meal || !meal.ntr_info) {
      return '영양 정보가 없습니다.';
    }
    
    try {
      // HTML 태그 제거 및 줄바꾸기 처리 (이미 서버에서 처리되었을 수 있음)
      const cleanNtrInfo = meal.ntr_info.replace(/<br\s*\/?>/gi, '\n');
      const items = cleanNtrInfo.split(/\n/).map(item => item.trim()).filter(Boolean);
      
      if (items.length === 0) {
        return '영양 정보가 없습니다.';
      }
      
      // 지방 항목 아래에 한 줄 띄우기 추가
      const modifiedItems = [];
      for (let i = 0; i < items.length; i++) {
        modifiedItems.push(items[i]);
        
        // 지방 항목 다음에 한 줄 띄우기
        if (items[i].includes('지방') && i < items.length - 1) {
          modifiedItems.push(''); // 빈 줄 추가
        }
      }
      
      // 각 줄 그대로 표시 (이모티콘 없이)
      let result = modifiedItems.join('\n');
      
      return result.trim();
    } catch (error) {
      console.error('영양소 정보 파싱 오류:', error);
      return '영양 정보 표시 중 오류가 발생했습니다.';
    }
  };

  // 원산지 정보 표시 함수 - 초단순화 버전 (서버에서 모든 처리 완료)
  const formatOriginInfo = (originInfo: any) => {
    // originInfo가 없거나 빈 배열이거나 빈 문자열일 경우 처리
    if (!originInfo || (Array.isArray(originInfo) && originInfo.length === 0) || originInfo === '[]') {
      return '상세 원산지 정보가 없습니다.';
    }

    // 문자열로 변환 및 <br>, <br/> 태그를 줄바꿈으로 변환
    let strOriginInfo = typeof originInfo === 'string' ? originInfo : JSON.stringify(originInfo);
    let formattedInfo = strOriginInfo.replace(/<br\s*\/?>/gi, '\n');
    
    // 서버에서 모든 정렬 및 처리가 완료되었으므로 그대로 반환
    return formattedInfo;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* 디버그 패널 제거 */}


      
      {/* 모달 (상세 정보) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-center">{modalTitle}</h3>
              <button 
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="whitespace-pre-wrap break-words text-left">
              {modalContent}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* 학교 정보 표시 (복원, region → grade/class) */}
{userSchool ? (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
    <span className="text-blue-700 text-base font-semibold">
      {userSchool.school_name}
    </span>
    {(userSchool.grade || userSchool.class) && (
      <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
        {userSchool.grade ? `${userSchool.grade}학년` : ''}
        {userSchool.class ? ` ${userSchool.class}반` : ''}
      </span>
    )}
  </div>
) : (
  <div className="mb-6"></div>
)}

        {/* 날짜 선택 - DateNavigator 컴포넌트 사용 */}
        <DateNavigator 
          selectedDate={selectedDate}
          onDateChange={(date) => {
            // 기존 handleDateChange 로직과 동일하게 처리
            setSelectedDate(date);
            updateDateWithUrl(date);
            
            // 급식 정보 자동 조회
            if (userSchool?.school_code && !userLoading) {
              fetchMealInfo(userSchool.school_code, date, resolveOfficeCode());
            }
          }}
        />
        
        {/* 에러 메시지 */}
        {(error || pageError || userError) && !meals.length && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error || pageError || userError}
          </div>
        )}

        {/* 급식 정보 표시 */}
        {!isLoading && !pageLoading && !userLoading && (
          <>
            {meals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {meals.map((meal) => (
                  <div key={meal.id} className="meal-wrapper">
                    <MealCard
                      meal={meal}
                      onShowOrigin={(info) => {
                        openModal('원산지 정보', formatOriginInfo(info));
                      }}
                      onShowNutrition={(m) => {
                        openModal('영양 정보', formatNutritionInfo(m));
                      }}
                      onUploadSuccess={() => setRefreshImageList((prev) => prev + 1)}
                      onUploadError={(e) => {
                        setPageError(e);
                        setTimeout(() => setPageError(''), 3000);
                      }}
                    />
                    {/* 공유 버튼 - MealCard와 CommentSection 사이에 배치 */}
                    <ShareButton 
                      onClick={() => {
                        setCurrentMeal(meal);
                        setIsShareModalOpen(true);
                      }} 
                    />
                    {/* 댓글 섹션 - MealCard 외부에 배치 */}
                    <CommentSection 
                      mealId={meal.id} 
                      className="mt-4" 
                      schoolCode={meal.school_code} 
                    />
                  </div>
                ))}
                
                {/* 데이터 소스 정보 표시 */}
                {dataSource && (
                  <div className="col-span-1 md:col-span-2 mt-2 text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-300">
                      데이터 소스: <span className="font-medium">{dataSource}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white shadow-md rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-yellow-100 rounded-full p-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                <h3 className="text-lg font-medium text-center mb-2 text-gray-900 dark:text-white">
                  {userSchool?.school_name || '학교'} {formatDisplayDate(selectedDate)} 급식 정보
                </h3>

                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-gray-700 dark:text-white font-medium">
                    {(error || pageError || userError) || '해당 날짜의 급식 정보가 없습니다.'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
                    다른 날짜를 선택해보세요.
                  </p>
                  {dataSource && (
                    <p className="text-xs text-gray-500 dark:text-gray-300 mt-4">
                      데이터 소스: <span className="font-medium">{dataSource}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 공유 모달 */}
      {currentMeal && userSchool && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          mealDate={formatDisplayDate(currentMeal.meal_date)}
          schoolName={userSchool.school_name}
        />
      )}
    </div>
  );
}
