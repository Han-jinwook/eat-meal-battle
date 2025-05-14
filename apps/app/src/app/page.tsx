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
// import { MealInfo } from '@/types'; // 중복 타입 제거
// 디버그 패널 제거

// 급식 정보 타입 정의
interface MealInfo {
  id: string;
  school_code: string;
  office_code: string;
  school_name?: string; // UI에 표시할 학교명
  meal_date: string;
  meal_type: string;
  menu_items: string[];
  kcal: string;
  ntr_info?: string;
  origin_info?: string;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

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

  // userError 발생 시 오류 처리
  useEffect(() => {
    if (userError) {
      setPageError(userError);
    }
  }, [userError]);

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
            .select('type, related_id')
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

  // 영양정보 포맷팅 함수 - 개선된 형태
  const formatNutritionInfo = (meal: MealInfo): string => {
    // 영양소 결과 문자열 초기화 (칼로리는 외부에서 표시하므로 생략)
    let result = '';
    
    // 영양소 대표 아이콘 - 하나만 사용
    const nutrientIcon = '💠'; // 미네랄(다이아몬드) 이모티콘
    
    // 대표 영양소 순서 정의 (고정 순서)
    const mainNutrientOrder = [
      '탄수화물',
      '단백질',
      '지방'
    ];
    
    // ntr_info가 있는지 확인
    if (!meal.ntr_info) {
      return '상세 영양 정보가 없습니다.';
    }
    
    try {
      // <br> 태그로 구분된 항목들 파싱
      const items = meal.ntr_info.split(/<br\s*\/?>/i);
      
      // 영양소 그룹 분류
      const mainNutrients: Array<{name: string, value: string, numeric: number}> = [];
      const otherNutrients: Array<{name: string, value: string, numeric: number}> = [];
      
      // 파싱 및 분류
      items.forEach(item => {
        // 예: 탄수화물(g) : 73.6
        const match = item.match(/(.+?)\s*[:\uff1a]\s*(.+)/);
        if (match) {
          let nutrientName = match[1].trim();
          let value = match[2].trim();
          
          // 영양소 이름과 단위 분리
          let baseName = nutrientName;
          let unit = '';
          
          // (g) 같은 단위가 있는지 추출
          const unitMatch = nutrientName.match(/\(([^)]+)\)/);
          if (unitMatch) {
            unit = unitMatch[1];
            // 영양소 이름에서 단위 제거
            baseName = nutrientName.replace(/\s*\([^)]*\)\s*/, '');
          }
          
          // 숫자 값 추출 - 정렬을 위해 필요
          const numericValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          
          // '영양소명 : 수치(단위)' 형식으로 변경
          const formattedText = unit 
            ? `${baseName} : ${numericValue}(${unit})` 
            : `${baseName} : ${numericValue}`;
          
          // 영양소 분류
          if (mainNutrientOrder.includes(baseName)) {
            mainNutrients.push({ 
              name: baseName, 
              value, 
              numeric: numericValue,
              displayText: formattedText
            });
          } else {
            otherNutrients.push({ 
              name: baseName, 
              value, 
              numeric: numericValue,
              displayText: formattedText
            });
          }
        }
      });
      
      // 결과 포맷팅
      let hasAnyNutrients = false;
      
      // 대표 영양소 정렬 (고정 순서대로: 탄수화물, 단백질, 지방)
      const sortedMainNutrients = [...mainNutrients].sort((a, b) => {
        const indexA = mainNutrientOrder.indexOf(a.name);
        const indexB = mainNutrientOrder.indexOf(b.name);
        return indexA - indexB;
      });
      
      // 기타 영양소는 값이 많은 순서로 정렬 (많은 순서에서 적은 순서로)
      const sortedOtherNutrients = [...otherNutrients].sort((a, b) => b.numeric - a.numeric);
      
      // 대표 영양소 출력 (제목 없이, 하나의 아이콘만 사용)
      if (sortedMainNutrients.length > 0) {
        hasAnyNutrients = true;
        
        sortedMainNutrients.forEach((nutrient) => {
          // '영양소명 : 수치(단위)' 형식 사용
          result += `${nutrientIcon} ${nutrient.displayText}\n`;
        });
        
        // 구분을 위한 개행
        if (sortedOtherNutrients.length > 0) {
          result += '\n';
        }
      }
      
      // 기타 영양소 출력 (제목 없이, 동일한 아이콘 사용)
      if (sortedOtherNutrients.length > 0) {
        hasAnyNutrients = true;
        
        sortedOtherNutrients.forEach((nutrient) => {
          // 원본 데이터 형식 그대로 사용
          result += `${nutrientIcon} ${nutrient.displayText}\n`;
        });
      }
      
      // 영양소가 하나도 없는 경우
      if (!hasAnyNutrients) {
        result += '상세 영양 정보가 없습니다.';
      }
      
    } catch (error) {
      console.error('영양정보 파싱 오류:', error);
      result += '영양정보 표시 오류가 발생했습니다.';
    }
    
    return result;
  };

  // 원산지 정보 포맷팅
  const formatOriginInfo = (originInfo: any) => {
    // originInfo가 없거나 빈 배열이거나 빈 문자열일 경우 처리
    if (!originInfo || (Array.isArray(originInfo) && originInfo.length === 0) || originInfo === '[]') {
      return '상세 원산지 정보가 없습니다.';
    }

    // 문자열로 변환 및 <br>, <br/> 태그를 줄바꿈으로 변환
    let strOriginInfo = typeof originInfo === 'string' ? originInfo : JSON.stringify(originInfo);
    let clean = strOriginInfo.replace(/<br\s*\/?>/gi, '\n');

    // 각 줄별로 정리, "비고" 등 제외
    const lines = clean
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        return line && 
               !line.startsWith('비고') &&
               line.includes(' : ') && // ' : '가 포함된 줄만 포함 (원산지 정보가 있는 줄)
               !line.includes('수산가공품') && // 수산가공품 제외
               !line.includes('식육가공품'); // 식육가공품 제외
      });
      
    // 한우 처리를 위한 한우 관련 줄 찾기
    const hanwooLine = clean
      .split('\n')
      .find(line => line.includes('한우') || line.includes('쇠고기(종류)') || (line.includes('쇠고기') && line.includes('국내산')));
    
    // 원산지별 재료 분류
    const originGroups: Record<string, Set<string>> = {};
    
    // 한우가 있는 경우 국내산에 쇠고기 추가
    if (hanwooLine) {
      if (!originGroups['국내산']) {
        originGroups['국내산'] = new Set<string>();
      }
      originGroups['국내산'].add('쇠고기');
    }
    
    // 한우 관련 줄 제외
    const filteredLines = lines.filter(line => 
      !line.includes('한우') && 
      !line.includes('쇠고기(종류)') && 
      !(line.includes('쇠고기') && line.includes('국내산(한우)'))
    );
    
    // skipPatterns에 일치하는 원산지 정보는 건너뛸
    const skipPatterns = [/비고/i, /가공품/i, /수산가공품/i, /식육가공품/i];

    filteredLines.forEach(line => {
      // 특수케이스 제외
      if (skipPatterns.some(pattern => pattern.test(line))) {
        return;
      }

      // 재료명과 원산지 분리
      const parts = line.split(' : ');
      if (parts.length === 2) {
        let ingredient = parts[0];
        let origin = parts[1];
        
        // 괄호와 그 안의 내용 추출 (예: 수입산(중국외) -> 중국)
        const bracketMatch = origin.match(/\(([^)]*)\)/);
        
        // 원산지가 '국내산' 또는 '국산'인 경우 '국내산'으로 통일
        if (origin === '국내산' || origin === '국산') {
          if (!originGroups['국내산']) {
            originGroups['국내산'] = new Set<string>();
          }
          originGroups['국내산'].add(ingredient);
          return;
        } 

        // 괄호 안에 나라 이름이 있는 경우 그것을 사용
        if (bracketMatch && bracketMatch[1]) {
          let countryText = bracketMatch[1];
          
          // '외', '등' 등의 불필요한 단어 제거
          countryText = countryText.replace(/\s*\uc678$/, '').replace(/\s*\ub4f1$/, '');
          
          // 콤마로 구분된 나라들이 있는 경우
          if (countryText.includes(',')) {
            // 괄호 안의 나라 이름들을 각각 처리
            const countries = countryText.split(',').map(c => c.trim().replace(/\s*\ub4f1$/, '').replace(/\s*\uc678$/, ''));
          
            // 각 나라마다 재료 추가
            countries.forEach(country => {
              if (country && country !== '등' && country !== '외') {
                if (!originGroups[country]) {
                  originGroups[country] = new Set<string>();
                }
                originGroups[country].add(ingredient);
              }
            });
            return; // 각 나라로 처리했으니 더 이상 처리 안함
          } else {
            // 단일 나라인 경우
            if (countryText && countryText !== '등' && countryText !== '외') {
              if (!originGroups[countryText]) {
                originGroups[countryText] = new Set<string>();
              }
              originGroups[countryText].add(ingredient);
              return; // 처리 완료
            }
          }
        }
        
        // 괄호가 없거나 괄호 안에 유의미한 값이 없는 경우
        // 원산지 처리
        origin = origin.replace(/\([^)]*\)/g, '').trim();
        
        // '수입산'이 있는 경우 건너뛸
        if (origin === '수입산') {
          return;
        }
        
        // '외국산'이 있는 경우 건너뛸
        if (origin === '외국산') {
          return;
        }
        
        // '러시아', '베트남' 등 나라 이름은 그대로 사용
        
        // 가공품, 식육가공품 등 불필요한 단어 제거
        ingredient = ingredient
          .replace(/\s*\uac00\uacf5\ud488$/g, '')
          .replace(/\s*\uc2dd\uc721\uac00\uacf5\ud488$/g, '')
          .replace(/\uc2dd\uc721/g, '')
          .replace(/\uc218\uc0b0/g, '')
          // "고기" 중복 제거 (쇠고기 → 쇠, 돼지고기 → 돼지)
          .replace(/\uace0\uae30$/g, '')
          .trim();
        
        // 쇠고기(종류) 제거
        if (ingredient.includes('(종류)')) {
          ingredient = ingredient.replace(/\(\uc885\ub958\)/g, '').trim();
          
          // 쇠고기는 국내산으로 처리
          if (ingredient === '쇠고기' || ingredient.includes('한우')) {
            if (!originGroups['국내산']) {
              originGroups['국내산'] = new Set<string>();
            }
            originGroups['국내산'].add('쇠고기');
            return;
          }
        }
        
        // 원산지별 중복없는 Set 초기화
        if (!originGroups[origin]) {
          originGroups[origin] = new Set<string>();
        }
        
        // 중복 없이 저장 (세트 사용)
        originGroups[origin].add(ingredient);
      }
    });
    
    // 결과 포맷팅
    let result = '';
    
    // 국내산을 가장 먼저 표시하고, 나머지는 알파벳 순서로 정렬
    // 국내산 먼저 출력
    if (originGroups['국내산'] && originGroups['국내산'].size > 0) {
      result += `국내산 : ${Array.from(originGroups['국내산']).join(', ')}\n`;
    }
    
    // 나머지 원산지는 알파벳 순서로 정렬하여 출력
    Object.keys(originGroups)
      .filter(origin => origin !== '국내산') // 국내산 제외
      .sort() // 알파벳 순서로 정렬
      .forEach(origin => {
        if (originGroups[origin].size > 0) {
          result += `${origin} : ${Array.from(originGroups[origin]).join(', ')}\n`;
        }
      });
    
    return result || '원산지 정보\n' + lines.join('\n');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* 디버그 패널 제거 */}


      
      {/* 모달 (상세 정보) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{modalTitle}</h3>
              <button 
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="whitespace-pre-wrap break-words text-center">
              {modalContent}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">학교 급식 정보</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            홈으로
          </Link>
        </div>

        {/* 학교 정보 표시 */}
        {userSchool ? (
          <div className="bg-white shadow-md rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-lg mb-2">
              {userSchool.school_name}
            </h2>
            <p className="text-gray-600 text-sm">
              {userSchool.region} {/* school_type 필드가 없어서 제거 */}
            </p>
          </div>
        ) : (
          <div className="mb-6"></div>
        )}

        {/* 날짜 선택 */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                날짜 선택
              </label>
              <div className="flex items-center">
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {selectedDate && (
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    {(() => {
                      const date = new Date(selectedDate);
                      if (!isNaN(date.getTime())) {
                        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                        return `(${weekdays[date.getDay()]})`; // 요일 표시
                      }
                      return '';
                    })()}
                  </span>
                )}
              </div>
            </div>
            {(isLoading || pageLoading || userLoading) && (
              <div className="flex items-center text-gray-600 mt-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">급식 정보를 가져오는 중...</span>
              </div>
            )}
          </div>
          
          {/* 에러 메시지 */}
          {(error || pageError || userError) && !meals.length && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error || pageError || userError}
            </div>
          )}
        </div>

        {/* 급식 정보 표시 */}
        {!isLoading && !pageLoading && !userLoading && (
          <>
            {meals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {meals.map((meal) => (
                  <MealCard
                    key={meal.id}
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
                ))}
                
                {/* 데이터 소스 정보 표시 */}
                {dataSource && (
                  <div className="col-span-1 md:col-span-2 mt-2 text-right">
                    <p className="text-xs text-gray-500">
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

                <h3 className="text-lg font-medium text-center mb-2">
                  {userSchool?.school_name || '학교'} {formatDisplayDate(selectedDate)} 급식 정보
                </h3>

                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-gray-700 font-medium">
                    {(error || pageError || userError) || '해당 날짜의 급식 정보가 없습니다.'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    다른 날짜를 선택해보세요.
                  </p>
                  {dataSource && (
                    <p className="text-xs text-gray-500 mt-4">
                      데이터 소스: <span className="font-medium">{dataSource}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
