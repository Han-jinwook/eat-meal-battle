'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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
import SchoolSearchModal from '@/components/SchoolSearchModal';
import ShareModal from '@/components/ShareModal';
import { useReferralParam } from '@/hooks/useReferralParam';
import ReferralHandler from '@/components/ReferralHandler';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { useSchoolMode } from '@/hooks/useSchoolMode';
// 디버그 패널 제거

// 추천 파라미터 처리 컴포넌트
function ReferralParamHandler() {
  useReferralParam();
  return null;
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  
  // 공유 모달 상태 관리
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [currentMeal, setCurrentMeal] = useState<MealInfo | null>(null);

  // 관심학교 드롭다운 상태 관리
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [interestSchools, setInterestSchools] = useState<any[]>([]);
  const [interestSchoolsLoading, setInterestSchoolsLoading] = useState<boolean>(false);
  
  // 학교검색 모달 상태 관리
  const [isSchoolSearchOpen, setIsSchoolSearchOpen] = useState<boolean>(false);

  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError } = useUserSchool();
  
  // 학교 모드 관리 훅
  const schoolMode = useSchoolMode(userSchool);
  
  // 디버그 로그 (개발 중에만)
  console.log('학교 모드 상태:', {
    currentMode: schoolMode.currentMode,
    hasMySchool: schoolMode.hasMySchool,
    isStudentMode: schoolMode.isStudentMode,
    permissions: schoolMode.permissions,
    currentSchoolInfo: schoolMode.currentSchoolInfo
  });

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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

  // 페이지 진입 시 학교 정보와 날짜가 설정되면 급식 정보 자동 로드 (내 학교만)
  useEffect(() => {
    // 관심학교가 선택된 경우 자동 로드 하지 않음 (관심학교 선택 핸들러에서 처리)
    if (schoolMode.selectedInterestSchool) {
      console.log('관심학교 선택됨, 자동 로드 건너뜀');
      return;
    }
    
    // 내 학교 정보와 날짜가 모두 있을 때만 실행
    if (userSchool?.school_code && selectedDate && !pageLoading && !isLoading && !userLoading) {
      console.log(`급식 정보 자동 로드 (내 학교) - 학교: ${userSchool.school_code}, 날짜: ${selectedDate}`);
      console.log(`현재 모드: ${schoolMode.currentMode}`);
      fetchMealInfo(userSchool.school_code, selectedDate, resolveOfficeCode());
    }
  }, [userSchool?.school_code, selectedDate, pageLoading, userLoading, schoolMode.selectedInterestSchool]);

  // 관심학교 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // 관심학교 드롭다운 토글 함수
  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
    // 드롭다운을 열 때만 관심학교 데이터 로드
    if (!isDropdownOpen && user && interestSchools.length === 0) {
      fetchInterestSchools();
    }
  };

  // 관심학교 데이터 조회 함수
  const fetchInterestSchools = async () => {
    if (!user) return;
    
    try {
      setInterestSchoolsLoading(true);
      console.log('관심학교 데이터 조회 시작:', user.id);
      
      const { data, error } = await supabase
        .from('interest_schools')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('관심학교 조회 오류:', error);
        return;
      }
      
      console.log('관심학교 데이터 조회 성공:', data);
      setInterestSchools(data || []);
      
    } catch (error) {
      console.error('관심학교 조회 중 예외 발생:', error);
    } finally {
      setInterestSchoolsLoading(false);
    }
  };

  // 관심학교 등록 함수
  const addInterestSchool = async (schoolData: any) => {
    if (!user) {
      console.error('사용자 인증이 필요합니다');
      return;
    }

    // 최대 3개 제한 확인
    if (interestSchools.length >= 3) {
      alert('최대 3개의 관심학교만 등록할 수 있습니다.');
      return;
    }

    // 중복 등록 확인
    const isDuplicate = interestSchools.some(
      school => school.school_code === schoolData.SD_SCHUL_CODE
    );
    
    if (isDuplicate) {
      alert('이미 등록된 관심학교입니다.');
      return;
    }

    try {
      console.log('관심학교 등록 시작:', schoolData);
      
      const { data, error } = await supabase
        .from('interest_schools')
        .insert({
          user_id: user.id,
          school_name: schoolData.SCHUL_NM,
          school_code: schoolData.SD_SCHUL_CODE,
          office_code: schoolData.ATPT_OFCDC_SC_CODE // 교육청 코드만 추가
        })
        .select();
      
      if (error) {
        console.error('관심학교 등록 오류:', error);
        alert('관심학교 등록에 실패했습니다.');
        return;
      }
      
      console.log('관심학교 등록 성공:', data);
      
      // 로컬 상태 업데이트
      if (data && data[0]) {
        setInterestSchools(prev => [data[0], ...prev]);
      }
      
      // 모달 닫기
      setIsSchoolSearchOpen(false);
      alert('관심학교가 성공적으로 등록되었습니다!');
      
    } catch (error) {
      console.error('관심학교 등록 중 예외 발생:', error);
      alert('관심학교 등록 중 오류가 발생했습니다.');
    }
  };

  // 학교등록 버튼 클릭 핸들러
  const handleSchoolRegister = () => {
    if (interestSchools.length >= 3) {
      alert('최대 3개의 관심학교만 등록할 수 있습니다.');
      return;
    }
    setIsSchoolSearchOpen(true);
  };

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

  // 현재 선택된 학교 정보 기준 officeCode 결정
  const resolveOfficeCode = () => {
    console.log('현재 선택된 학교:', schoolMode.selectedInterestSchool);
    console.log('내 학교 정보:', userSchool);
    
    // 관심학교가 선택되었으면 해당 학교의 office_code 사용
    if (schoolMode.selectedInterestSchool?.office_code) {
      console.log('관심학교 office_code 사용:', schoolMode.selectedInterestSchool.office_code);
      return schoolMode.selectedInterestSchool.office_code;
    }
    
    // 내 학교의 office_code 사용
    let office = 'E10';
    if (userSchool) {
      if (userSchool.office_code) {
        office = userSchool.office_code;
        console.log('내 학교 office_code 사용:', office);
      } else if (userSchool.region) {
        office = getOfficeCode(userSchool.region);
        console.log('내 학교 region에서 office_code 계산:', office);
      }
    }
    console.log('최종 office_code:', office);
    return office;
  };

  // 날짜 변경 핸들러 - 날짜 변경 시 자동으로 조회
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    // URL 파라미터와 상태 동시 업데이트
    updateDateWithUrl(newDate);
    // 날짜 변경 시 기존 오류 메시지 초기화
    setPageError('');
    
    // 현재 표시할 학교 코드 결정 (관심학교가 선택되었으면 해당 학교, 아니면 내 학교)
    const currentSchoolCode = schoolMode.selectedInterestSchool?.school_code || userSchool?.school_code;
    
    // 학교 정보가 있으면 자동으로 급식 정보 조회
    if (currentSchoolCode) {
      console.log(`날짜 변경 - 학교: ${currentSchoolCode}, 날짜: ${newDate}`);
      fetchMealInfo(currentSchoolCode, newDate, resolveOfficeCode());
      
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
        {/* 학교 정보 표시 (현재 선택된 학교 기준) */}
{schoolMode.currentSchoolInfo ? (
  <div className={`shadow-sm rounded p-2 mb-3 border-l-2 flex items-center justify-between ${
    schoolMode.isStudentMode 
      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500' 
      : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-500'
  }`}>
    {/* 왼쪽: 학교 정보 (내 학교 모드일 때만 표시) */}
    <div className="flex items-center">
      {schoolMode.isStudentMode && (
        <>
          <span className="text-blue-700 text-base font-semibold">
            {userSchool?.school_name}
          </span>
          
          {/* 학년/반 정보 */}
          {(userSchool?.grade || userSchool?.class) && (
            <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
              {userSchool.grade ? `${userSchool.grade}학년` : ''}
              {userSchool.class ? ` ${userSchool.class}반` : ''}
            </span>
          )}
        </>
      )}
    </div>
    
    {/* 오른쪽: 관심학교 드롭다운 */}
    <div className="relative" ref={dropdownRef}>
      <button 
        className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300 rounded-md hover:bg-white transition-colors text-sm font-medium shadow-sm"
        onClick={handleDropdownToggle}
      >
        <span>
          {schoolMode.isStudentMode 
            ? '관심학교' 
            : `관심학교 - ${schoolMode.getDisplaySchoolName()}`
          }
        </span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* 드롭다운 메뉴 */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3">
            {/* 학교등록 버튼 */}
            <button 
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors mb-3"
              onClick={handleSchoolRegister}
            >
              <span>학교등록 ({interestSchools.length}/3)</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-3"></div>
            
            {/* 내 학교 (사용자 학교가 있을 때만 표시) */}
            {schoolMode.hasMySchool && (
              <button 
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md mb-2 transition-colors ${
                  schoolMode.isStudentMode 
                    ? 'text-gray-700 bg-green-50' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => {
                  // 내 학교로 돌아가기
                  schoolMode.returnToMySchool();
                  
                  // 내 학교의 급식 데이터 새로 가져오기
                  if (userSchool?.school_code && selectedDate) {
                    console.log(`내 학교로 돌아가기 - 학교: ${userSchool.school_code}, 날짜: ${selectedDate}`);
                    fetchMealInfo(userSchool.school_code, selectedDate, resolveOfficeCode());
                    
                    // 이미지 목록 새로고침
                    setTimeout(() => {
                      setRefreshImageList(prev => prev + 1);
                    }, 300);
                  }
                  
                  setIsDropdownOpen(false);
                }}
              >
                <span className="text-green-600">🏠</span>
                <div className="flex-1 text-left">
                  <div className="font-medium">내 학교</div>
                  <div className="text-xs text-gray-500">
                    {schoolMode.isStudentMode ? '현재' : '내 학교로 돌아가기'}
                  </div>
                </div>
                {schoolMode.isStudentMode && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">현재</span>
                )}
              </button>
            )}
            
            {/* 관심학교 목록 또는 빈 상태 */}
            {interestSchoolsLoading ? (
              <div className="text-center py-6 text-gray-500">
                <div className="text-sm">로딩 중...</div>
              </div>
            ) : interestSchools.length > 0 ? (
              <div className="space-y-2">
                {interestSchools.map((school) => {
                  const isSelected = schoolMode.selectedInterestSchool?.id === school.id;
                  
                  return (
                    <button 
                      key={school.id}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                        isSelected 
                          ? 'text-gray-700 bg-blue-50' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        // 관심학교 선택
                        schoolMode.selectInterestSchool({
                          id: school.id,
                          school_name: school.school_name,
                          school_code: school.school_code,
                          office_code: school.office_code, // 교육청 코드만 추가
                          created_at: school.created_at
                        });
                        
                        // 선택된 관심학교의 급식 데이터 새로 가져오기
                        console.log(`관심학교 선택 - 학교: ${school.school_code}, office_code: ${school.office_code}, 날짜: ${selectedDate}`);
                        if (selectedDate) {
                          fetchMealInfo(school.school_code, selectedDate, school.office_code || 'E10');
                          
                          // 이미지 목록 새로고침
                          setTimeout(() => {
                            setRefreshImageList(prev => prev + 1);
                          }, 300);
                        }
                        
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className="text-blue-600">🏠</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{school.school_name}</div>
                        <div className="text-xs text-gray-500">
                          {isSelected ? '현재 선택됨' : '관심학교'}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">현재</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="text-2xl mb-2">📚</div>
                <div className="text-sm">등록된 관심학교가 없습니다</div>
                <div className="text-xs text-gray-400 mt-1">학교등록 버튼을 눌러 추가해보세요</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
                      mealDate={meal.meal_date}
                      schoolName={userSchool?.school_name || meal.school_name || '학교정보 없음'}
                      schoolCode={meal.school_code}
                      rating={4.1}
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
          schoolCode={currentMeal.school_code}
        />
      )}
      
      {/* 학교검색 모달 */}
      <SchoolSearchModal 
        isOpen={isSchoolSearchOpen}
        onClose={() => setIsSchoolSearchOpen(false)}
        onSelectSchool={addInterestSchool}
      />
      
      {/* 추천 관계 처리 */}
      <Suspense fallback={null}>
        <ReferralParamHandler />
        <ReferralHandler />
      </Suspense>
      
      {/* PWA 설치 프롬프트 */}
      <PWAInstallPrompt />
    </div>
  );
}
