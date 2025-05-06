'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import MealImageUploader from '@/components/MealImageUploader';
import MealImageList from '@/components/MealImageList';
import { formatDisplayDate, formatApiDate, getCurrentDate, isWeekend } from '@/utils/DateUtils';
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
  const [user, setUser] = useState<any>(null);  // 사용자 정보
  const [userSchool, setUserSchool] = useState<any>(null); // 학교 정보
  const [meals, setMeals] = useState<MealInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState(''); // 데이터 소스 추적 (database 또는 api)
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  
  // 이미지 업로드 관련 상태
  const [refreshImageList, setRefreshImageList] = useState(0);

  // 날짜 관련 유틸리티 함수는 @/utils/DateUtils로 이동

  // 사용자 정보 및 학교 정보 가져오기
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        setIsLoading(true);

        // 1. 세션 및 사용자 정보 가져오기
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (user) {
          setUser(user);

          // 2. 사용자의 학교 정보 가져오기
          const { data: schoolInfo, error: schoolError } = await supabase
            .from('school_infos')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (schoolError && schoolError.code !== 'PGRST116') { 
            // PGRST116: 결과 없음 오류는 무시 (학교 정보가 없을 수 있음)
            throw new Error(`학교 정보 조회 에러: ${schoolError.message}`);
          }

          if (schoolInfo) {
            console.log('학교 정보 가져오기 성공:', schoolInfo);
            setUserSchool(schoolInfo); // 학교 정보 상태 저장
          }
          
          // 현재 날짜 설정 (초기 API 호출 없이 날짜만 설정)
          const today = getCurrentDate();
          setSelectedDate(today);
        } else {
          // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
          setError('로그인이 필요합니다');
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        }
      } catch (err) {
        console.error('정보 로딩 오류:', err);
        setError(`정보를 불러오는 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    getUserInfo();
  }, [supabase, router]);

  // 페이지 진입 시 학교 정보와 날짜가 설정되면 급식 정보 자동 로드
  useEffect(() => {
    // 학교 정보와 날짜가 모두 있을 때만 실행
    if (userSchool?.school_code && selectedDate && !isLoading) {
      console.log(`급식 정보 자동 로드 - 학교: ${userSchool.school_code}, 날짜: ${selectedDate}`);
      // 페이지 진입 시 자동 로드에서 발생하는 문제 해결을 위한 디버깅 로그
      console.log(`자동 로드 시 날짜 형식: ${selectedDate}, 타입: ${typeof selectedDate}`);
      fetchMealInfo(userSchool.school_code, selectedDate);
    }
  }, [userSchool?.school_code, selectedDate]);

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

  // 날짜 변경 핸들러 - 날짜 변경 시 자동으로 조회
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    // 날짜 변경 시 기존 오류 메시지 초기화
    setError('');
    
    // 학교 정보가 있으면 자동으로 급식 정보 조회
    if (userSchool?.school_code) {
      fetchMealInfo(userSchool.school_code, newDate);
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
  const showOriginModal = (originInfo: string) => {
    setModalTitle('원산지 정보');
    setModalContent(formatOriginInfo(originInfo));
    setShowModal(true);
  };

  // 영양정보 모달 표시 함수
  const showNutritionModal = (meal: MealInfo) => {
    setModalTitle('영양 정보');
    setModalContent(formatNutritionInfo(meal));
    setShowModal(true);
  };

  // 영양정보 포맷팅 함수
  const formatNutritionInfo = (meal: MealInfo): string => {
    // 칼로리를 맨 위에 출력
    let result = '';
    if (meal.kcal) {
      result += `🔥 열량: ${meal.kcal}kcal\n\n`;
    }
    
    // 영양소 아이콘 매핑
    const nutrientIcons: Record<string, string> = {
      '탄수화물': '💎',
      '단백질': '🍗',
      '지방': '🧈',
      '비타민A': '🍉',
      '비타민C': '🍊',
      '칼싘': '🥛',
      '철분': '💪'
    };
    
    // ntr_info가 있는지 확인
    if (!meal.ntr_info) {
      return result + '상세 영양 정보가 없습니다.';
    }
    
    try {
      // <br> 태그로 구분된 항목들 파싱
      const items = meal.ntr_info.split(/<br\s*\/?>/i);
      
      // 영양소 그룹 분류
      const groups: Record<string, Array<{name: string, value: string}>> = {
        '대표 영양소': [], // 탄수화물, 단백질, 지방
        '기타 영양소': []  // 나머지 영양소
      };
      
      // 파싱 및 분류
      items.forEach(item => {
        // 예: 탄수화물(g) : 73.6
        const match = item.match(/(.+?)\s*[:\uff1a]\s*(.+)/);
        if (match) {
          let name = match[1].trim();
          const value = match[2].trim();
          
          // (g), (mg) 같은 단위 제거
          name = name.replace(/\s*\([^)]*\)\s*/, '');
          
          // 영양소 분류
          if (['탄수화물', '단백질', '지방'].includes(name)) {
            groups['대표 영양소'].push({ name, value });
          } else {
            groups['기타 영양소'].push({ name, value });
          }
        }
      });
      
      // 결과 포맷팅
      let hasAnyNutrients = false;
      
      // 대표 영양소 출력
      if (groups['대표 영양소'].length > 0) {
        hasAnyNutrients = true;
        result += `🍱 대표 영양소\n`;
        groups['대표 영양소'].forEach(({ name, value }) => {
          const emoji = nutrientIcons[name] || '•';
          result += `${emoji} ${name}: ${value}\n`;
        });
        result += '\n';
      }
      
      // 기타 영양소 출력
      if (groups['기타 영양소'].length > 0) {
        hasAnyNutrients = true;
        result += `✨ 기타 영양소\n`;
        groups['기타 영양소'].forEach(({ name, value }) => {
          const emoji = nutrientIcons[name] || '•';
          result += `${emoji} ${name}: ${value}\n`;
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
    
    // skipPatterns에 일치하는 원산지 정보는 건너뛀
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
    
    // 더 중요한 원산지부터 표시 (우선순위 지정)
    // 스크린샷에 맞게 국내산이 제일 먼저, 그 다음 러시아, 베트남, 원양산 순서
    const priorityOrder = ['국내산', '러시아', '베트남', '중국', '원양산', '미국', '호주', '칠레', '페루', '아르헨티나'];
    
    // 우선순위가 있는 원산지부터 출력
    priorityOrder.forEach(origin => {
      if (originGroups[origin] && originGroups[origin].size > 0) {
        result += `${origin} : ${Array.from(originGroups[origin]).join(', ')}\n`;
      }
    });
    
    // 나머지 원산지도 출력
    Object.keys(originGroups).forEach(origin => {
      if (!priorityOrder.includes(origin) && originGroups[origin].size > 0) {
        result += `${origin} : ${Array.from(originGroups[origin]).join(', ')}\n`;
      }
    });
    
    return result || '원산지 정보\n' + lines.join('\n');
  };

  // 급식 정보 가져오기
  const fetchMealInfo = async (schoolCode: string, date: string) => {
    if (!schoolCode || !date) {
      setError('학교 코드와 날짜가 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // 교육청 코드 가져오기 (중요!)
      // 기본값 설정으로 인첩 교육청 코드 'E10' 사용
      let officeCode = 'E10';
      
      if (userSchool) {
        // 학교 정보에 교육청 코드가 있으면 사용
        if (userSchool.office_code) {
          officeCode = userSchool.office_code;
          console.log(`학교 office_code 사용: ${officeCode}`);
        }
        // 없으면 지역 정보에서 추출 시도
        else if (userSchool.region) {
          officeCode = getOfficeCode(userSchool.region);
          console.log(`지역에서 office_code 추출: ${officeCode}, 지역: ${userSchool.region}`);
        }
      }

      console.log(`최종 사용 office_code: ${officeCode}`);
      
      // 학교 정보에 office_code가 없는 경우 DB에 업데이트
      if (userSchool && !userSchool.office_code && officeCode) {
        console.log(`학교 정보에 office_code 업데이트: ${officeCode}`);
        try {
          const { error } = await supabase
            .from('school_infos')
            .update({ office_code: officeCode })
            .eq('school_code', schoolCode);
          
          if (error) {
            console.error('학교 정보 office_code 업데이트 오류:', error);
          } else {
            console.log('학교 정보 office_code 업데이트 성공');
          }
        } catch (err) {
          console.error('학교 정보 업데이트 중 오류:', err);
        }
      }
      
      // API 날짜 형식으로 변환 (YYYY-MM-DD -> YYYYMMDD)
      const apiDate = formatApiDate(date);
      console.log(`날짜 변환: ${date} -> ${apiDate}`);
      
      // API 호출 전 파라미터 로그
      console.log('API 호출 파라미터:', { schoolCode, officeCode, date: apiDate });

      // 로컬(127.0.0.1/localhost/사설IP) 여부에 따라 Netlify Functions 프리픽스 결정
      const isLocalhost = typeof window !== 'undefined' && /^(localhost|127\.|192\.168\.)/.test(window.location.hostname);
      const apiPrefix = isLocalhost ? '/api' : '/.netlify/functions';
      const apiUrl = `${apiPrefix}/meals?school_code=${schoolCode}&office_code=${officeCode}&date=${apiDate}`;

      // 로직의 명확성을 위해 경로를 출력
      console.log(`API 요청 URL: ${apiUrl}`);

      // 첫번째 시도 - 기본 API 경로 (상대경로)
      let response = await fetch(apiUrl);

      // 기본 API 요청이 실패하면 Netlify Functions로 직접 시도
      if (!response.ok) {
        console.log(`첫번째 시도 실패: ${response.status}. Netlify Functions으로 재시도합니다.`);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const netlifyFunctionUrl = `${baseUrl}/.netlify/functions/meals?school_code=${schoolCode}&office_code=${officeCode}&date=${apiDate}`;

        console.log(`Netlify Functions 요청 URL: ${netlifyFunctionUrl}`);
        response = await fetch(netlifyFunctionUrl);

        if (!response.ok) {
          throw new Error(`급식 정보를 가져오는데 실패했습니다. (${response.status})`);
        }
      }

      const data = await response.json();

      // 데이터 소스 표시
      setDataSource(data.source || 'unknown');
      
      // 급식 정보 설정
      if (data.meals && data.meals.length > 0) {
        setMeals(data.meals);
        setError('');
      } else {
        setMeals([]);
        setError(isWeekend(date) 
          ? '주말에는 학교 급식이 제공되지 않습니다.' 
          : '해당 날짜의 급식 정보가 없습니다.');
      }
    } catch (err) {
      console.error('급식 정보 조회 오류:', err);
      setMeals([]);
      setError(`급식 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
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
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-gray-600 whitespace-pre-line">
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
              {userSchool.region} {userSchool.school_type}
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
            {isLoading && (
              <div className="flex items-center text-gray-600 mt-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">급식 정보를 가져오는 중...</span>
              </div>
            )}
          </div>
          
          {/* 에러 메시지 */}
          {error && !meals.length && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* 급식 정보 표시 */}
        {!isLoading && (
          <>
            {meals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {meals.map((meal, index) => (
                  <div key={index} className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-3 border-b">
                      {/* 급식 사진 업로더 - 메뉴 앞으로 이동 */}
                      <MealImageUploader 
                        mealId={meal.id}
                        schoolCode={meal.school_code}
                        mealDate={meal.meal_date}
                        mealType={meal.meal_type}
                        onUploadSuccess={() => setRefreshImageList(prev => prev + 1)}
                        onUploadError={(error) => {
                          setError(error);
                          setTimeout(() => setError(''), 3000);
                        }}
                      />
                      
                      {/* 이미지 목록은 MealImageUploader에서 직접 표시하므로 제거 */}
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center">
                            <span className="mr-2">{getMealTypeIcon(meal.meal_type)}</span>
                            {meal.meal_type}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatDisplayDate(meal.meal_date)}
                          </p>
                        </div>
                        
                        {meal.kcal && (
                          <div className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            {meal.kcal}kcal
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-4">
                        <ul className="space-y-1">
                          {meal.menu_items.map((item, idx) => (
                            <li key={idx} className="text-gray-700">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      

                      <div className="flex flex-wrap gap-2">
                        {meal.origin_info && (
                          <button 
                            onClick={() => {
                              setModalTitle('원산지 정보');
                              setModalContent(formatOriginInfo(meal.origin_info));
                              setShowModal(true);
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            원산지 보기
                          </button>
                        )}
                        {/* 영양정보 버튼 - 칼로리나 ntr_info가 있으면 표시 */}
                        {(meal.kcal || meal.ntr_info) && (
                          <button 
                            onClick={() => {
                              setModalTitle('영양 정보');
                              setModalContent(formatNutritionInfo(meal));
                              setShowModal(true);
                            }}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            영양정보
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 border-t">
                      <div className="mt-2">
                      </div>
                    </div>
                  </div>
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
                    {error || (isWeekend(selectedDate) 
                      ? '주말에는 학교 급식이 제공되지 않습니다.' 
                      : '해당 날짜의 급식 정보가 없습니다.')}
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
