'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { extractBattleRegion } from '@/utils/addressParser';
// import PushNotificationSetup from '@/components/PushNotificationSetup'; // 푸시 알림 비활성화

// 학교 검색 결과 타입 정의
interface School {
  SD_SCHUL_CODE: string; // 학교 코드
  SCHUL_NM: string; // 학교 이름
  LCTN_SC_NM: string; // 지역명
  SCHUL_KND_SC_NM: string; // 학교 종류
  ORG_RDNMA: string; // 주소
  ATPT_OFCDC_SC_CODE: string; // 교육청 코드
  ORG_RDNDA?: string; // 상세 주소(선택적)
}

// 학년/반 데이터 타입
interface ClassInfo {
  grade: string;
  classNumber: string;
}

export default function SchoolSearchPage() {
  const router = useRouter();
  const supabase = createClient();
  const [keyword, setKeyword] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo>({ grade: '', classNumber: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shareSchoolCode, setShareSchoolCode] = useState<string | null>(null);
  const [shareType, setShareType] = useState<string | null>(null);
  
  // URL 파라미터에서 공유 학교 코드 및 공유 타입 확인
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shareCode = params.get('share_school_code');
      const shareTypeParam = params.get('share_type');
            if (shareCode) {
        setShareSchoolCode(shareCode);
        setShareType(shareTypeParam);
        console.log('🔗 공유 정보 감지:', { shareCode, shareType: shareTypeParam });
      }
    }
  }, []);

  // 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (!user) {
        // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
        setError('로그인이 필요합니다');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    };
    
    getUser();
  }, [router, supabase.auth]);

  // 학교 검색 함수
  const searchSchools = async () => {
    if (!keyword.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 실제 API 호출 - 프로덕션과 개발 환경 구분
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      let apiUrl;
      
      // 프로덕션 환경에서는 Netlify Functions를 사용
      if (baseUrl.includes('lunbat.com') || baseUrl.includes('netlify')) {
        // Netlify Functions 경로로 호출
        apiUrl = `${baseUrl}/.netlify/functions/schools?keyword=${encodeURIComponent(keyword)}`;
      } else {
        // 개발 환경에서는 기존 API 경로 유지
        apiUrl = `${baseUrl}/api/schools?keyword=${encodeURIComponent(keyword)}`;
      }
      
      console.log('학교 검색 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        console.error('학교 검색 API 응답 오류:', response.status, response.statusText);
        throw new Error('학교 검색에 실패했습니다');
      }
      const data = await response.json();
      setSchools(data.schools || []);
      setIsLoading(false);
    } catch (err) {
      setError('학교 검색 중 오류가 발생했습니다');
      setSchools([]);
      setIsLoading(false);
    }
  };

  // 학교 선택 함수
  const selectSchool = (school: School) => {
    setSelectedSchool(school);
    // 학교 선택 후 검색 결과 리스트 초기화
    setSchools([]);
    setKeyword('');
  };

  // 학교 유형에 따른 학년 옵션 제공
  const getGradeOptions = () => {
    if (!selectedSchool) return [1, 2, 3]; // 기본값
    
    const schoolType = selectedSchool.SCHUL_KND_SC_NM;
    
    if (schoolType === '초등학교') {
      return [1, 2, 3, 4, 5, 6]; // 초등학교: 1-6학년
    } else if (schoolType === '중학교') {
      return [1, 2, 3]; // 중학교: 1-3학년
    } else if (schoolType.includes('고등학교') || schoolType === '특성화고등학교' || schoolType === '외국인학교') {
      return [1, 2, 3]; // 고등학교: 1-3학년
    }
    
    return [1, 2, 3]; // 기본값
  };

  // 학년 반 정보 변경 함수
  const handleClassInfoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClassInfo((prev) => ({ ...prev, [name]: value }));
  };

  // 관심학교 자동 등록 함수
  const attemptInterestSchoolRegistration = async (schoolCode: string) => {
    try {
      console.log('🔗 관심학교 자동 등록 시도:', schoolCode);
      
      // 학교 정보 조회 (외부 API 사용)
      const schoolResponse = await fetch(`/.netlify/functions/schools?keyword=${schoolCode}&exact=true`);
      if (!schoolResponse.ok) {
        console.warn('학교 정보 조회 실패:', schoolResponse.status);
        return;
      }
      
      const schoolData = await schoolResponse.json();
      const targetSchool = schoolData.schools?.find((s: any) => s.SD_SCHUL_CODE === schoolCode);
      
      if (!targetSchool) {
        console.warn('대상 학교를 찾을 수 없음:', schoolCode);
        return;
      }
      
      
      // 관심학교 등록 API 호출
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('인증 토큰이 없어 관심학교 등록 불가');
        return;
      }
      
      const registerResponse = await fetch('/api/interest-schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          school_code: schoolCode,
          school_name: targetSchool.SCHUL_NM
        })
      });
      
      if (registerResponse.ok) {
        console.log('✅ 관심학교 자동 등록 성공:', targetSchool.SCHUL_NM);
      } else {
        const errorText = await registerResponse.text();
        console.warn('관심학교 자동 등록 실패:', errorText);
      }
    } catch (error) {
      console.warn('관심학교 자동 등록 중 오류:', error);
    }
  };

  // 정보 저장 및 다음 단계 이동
  const saveAndContinue = async () => {
    if (!user) {
      setError('로그인이 필요합니다');
      return;
    }

    if (!selectedSchool) {
      setError('학교를 선택해주세요');
      return;
    }

    // 학년/반 정보가 필요한 경우 검증
    if (!classInfo.grade) {
      setError('학년을 선택해주세요');
      return;
    }

    if (!classInfo.classNumber) {
      setError('반을 선택해주세요');
      return;
    }

    setSaveLoading(true);
    setError('');

    try {
      // 사용자 학교 정보 존재 여부 확인
      const { data: schoolInfo, error: schoolInfoError } = await supabase
        .from('school_infos')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (schoolInfoError && schoolInfoError.code !== 'PGRST116') {
        throw schoolInfoError;
      }

      // 학교 정보 저장
      const schoolData = {
        user_id: user.id,
        school_code: selectedSchool.SD_SCHUL_CODE,
        school_name: selectedSchool.SCHUL_NM,
        school_type: selectedSchool.SCHUL_KND_SC_NM,
        region: extractBattleRegion(selectedSchool.ORG_RDNMA || selectedSchool.LCTN_SC_NM),
        address: selectedSchool.ORG_RDNMA,
        office_code: selectedSchool.ATPT_OFCDC_SC_CODE,
        grade: classInfo.grade,
        class_number: classInfo.classNumber,
        updated_at: new Date().toISOString(),
      };

      let saveError;
      if (schoolInfo) {
        // 기존 레코드가 있으면 업데이트
        const updateResult = await supabase
          .from('school_infos')
          .update(schoolData)
          .eq('user_id', user.id);
        saveError = updateResult.error;
      } else {
        // 없으면 새로 추가 (같은 school_code여도 문제없음)
        const insertResult = await supabase
          .from('school_infos')
          .insert([schoolData]);
        saveError = insertResult.error;
      }

      if (saveError) throw saveError;

      // 장원 조건 설정 (신규 등록 및 학교 변경 시)
      try {
        console.log('장원 조건 설정 시작...');
        const setupResponse = await fetch('/.netlify/functions/initialize-school-champion-criteria', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            school_code: selectedSchool.SD_SCHUL_CODE,
            office_code: selectedSchool.ATPT_OFCDC_SC_CODE
          })
        });
        
        if (setupResponse.ok) {
          console.log('장원 조건 설정 완료');
        } else {
          console.warn('장원 조건 설정 실패 (계속 진행):', await setupResponse.text());
        }
      } catch (setupError) {
        console.warn('장원 조건 설정 오류 (계속 진행):', setupError);
      }

      // 성공 처리
      setSaveSuccess(true);
      setSaveLoading(false);

      // 내 학교 등록 완료 시 관심학교 선택 상태 초기화
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          localStorage.removeItem(`last_selected_school_${session.user.id}`);
          console.log('✅ 내 학교 등록 완료 - 관심학교 선택 상태 초기화');
        }
      } catch (error) {
        console.warn('관심학교 상태 초기화 실패:', error);
      }

      // 공유 URL에서 온 학교 코드 처리
      console.log('🔍 공유 URL 학교 코드 처리 시작:', {
        shareSchoolCode,
        selectedSchoolCode: selectedSchool.SD_SCHUL_CODE,
        shareType
      });
      
      if (shareSchoolCode) {
        if (shareSchoolCode === selectedSchool.SD_SCHUL_CODE) {
          // 공유 URL 학교 = 등록한 학교 (같은 학교)
          console.log('✅ 공유 URL 학교를 내 학교로 등록 완료 - 관심학교 등록 불필요');
        } else {
          // 공유 URL 학교 ≠ 등록한 학교 (다른 학교)
          console.log('🔗 공유 학교 코드로 관심학교 자동 등록 시도:', shareSchoolCode);
          await attemptInterestSchoolRegistration(shareSchoolCode);
        }
      } else {
        console.log('ℹ️ 공유 URL 학교 코드가 없음 - 관심학교 자동 등록 생략');
      }

                  // 공유 타입에 따라 리다이렉트 결정
      setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect_url');

        if (redirectUrl) {
          console.log('🚀 redirect_url 감지! 해당 URL로 이동:', redirectUrl);
          // URL 디코딩을 통해 안전하게 리다이렉트
          router.push(decodeURIComponent(redirectUrl));
          return;
        }

        if (shareType === 'battle') {
          // 배틀공유인 경우 배틀페이지로 이동 (school_code 파라미터 포함)
          const battleUrl = shareSchoolCode === selectedSchool.SD_SCHUL_CODE 
            ? '/battle' // 같은 학교면 내 학교 모드로
            : `/battle?school_code=${shareSchoolCode}`; // 다른 학교면 관심학교 모드로
          console.log('🏆 배틀공유 완료 → 배틀페이지로 이동:', battleUrl);
          router.push(battleUrl);
        } else {
          // 급식공유 또는 일반 등록인 경우
          if (shareSchoolCode && shareSchoolCode !== selectedSchool.SD_SCHUL_CODE) {
            // 급식공유에서 타학교 등록한 경우 → 관심학교 모드로 급식페이지 이동
            console.log('🍽️ 급식공유 타학교 등록 완료 → 관심학교 모드로 급식페이지 이동');
            router.push(`/?school_code=${shareSchoolCode}`);
          } else {
            // 일반 등록 또는 같은 학교 등록인 경우 홈페이지로 이동
            console.log('🏠 학교 등록 완료 → 홈페이지로 이동');
            router.push('/');
          }
        }
      }, 1500);
    } catch (err: any) {
      console.error('학교 정보 저장 오류:', err);
      setError(err.message || '학교 정보 저장 중 오류가 발생했습니다');
      setSaveLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">학교 정보 설정</h1>

      {/* 학교 검색 폼 */}
      <div className="mb-6">
        <form onSubmit={(e) => { e.preventDefault(); searchSchools(); }}>
          <div className="flex">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="flex-grow p-2 border rounded-l"
              placeholder="학교 이름 입력 (2글자 이상)"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-r disabled:bg-gray-400"
            >
              검색
            </button>
          </div>
        </form>
      </div>

      {/* 검색 결과 */}
      {schools.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">검색 결과</h2>
          <ul className="border rounded divide-y">
            {schools.map((school) => (
              <li
                key={school.SD_SCHUL_CODE}
                className={`p-3 cursor-pointer hover:bg-gray-100 ${
                  selectedSchool?.SD_SCHUL_CODE === school.SD_SCHUL_CODE ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectSchool(school)}
              >
                <div className="font-medium text-gray-900 dark:text-white">{school.SCHUL_NM}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{school.LCTN_SC_NM} | {school.SCHUL_KND_SC_NM}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{school.ORG_RDNMA}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 학교 선택 결과 */}
      {selectedSchool && (
        <div className="mb-6 p-4 border rounded bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">선택한 학교</h2>
          <div className="font-medium text-gray-900 dark:text-white">{selectedSchool.SCHUL_NM}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {selectedSchool.LCTN_SC_NM} | {selectedSchool.SCHUL_KND_SC_NM}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">{selectedSchool.ORG_RDNMA}</div>
          
          {/* 학년/반 선택 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1">
                학년
              </label>
              <select
                id="grade"
                name="grade"
                value={classInfo.grade}
                onChange={handleClassInfoChange}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">선택하세요</option>
                {getGradeOptions().map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}학년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="classNumber" className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1">
                반
              </label>
              <select
                id="classNumber"
                name="classNumber"
                value={classInfo.classNumber}
                onChange={handleClassInfoChange}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">선택하세요</option>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}반
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 다음 단계 버튼 */}
      {selectedSchool && (
        <div className="mt-6">
          {saveSuccess ? (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded mb-4">
              <p className="font-medium">학교 정보가 성공적으로 저장되었습니다!</p>
              <p className="text-sm mt-1">잠시 후 메인 페이지로 이동합니다...</p>
            </div>
          ) : (
            <button
              onClick={saveAndContinue}
              disabled={saveLoading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saveLoading ? '저장 중...' : '정보 저장하기'}
            </button>
          )}
          
          {error && (
            <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
