'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useUserSchool from '@/hooks/useUserSchool';
import { useSchoolMode } from '@/hooks/useSchoolMode';
import DateNavigator from '@/components/DateNavigator';
import { getCurrentDate } from '@/utils/DateUtils';
import { createClient } from '@/lib/supabase';
import SchoolSearchModal from '@/components/SchoolSearchModal';
import ShareButton from '@/components/ShareButton';
import AIAnalysisModal from '@/components/AIAnalysisModal';
import { calculateDailyMenuBattle, calculateMonthlyMenuBattle } from '@/utils/battleCalculator';

// 학교 유형별 캐릭터 이미지 경로 반환 함수
const getSchoolCharacterImage = (schoolType: string): string => {
  if (schoolType?.includes('초등학교') || schoolType?.includes('초')) {
    return '/images/characters/elementary.png';
  }
  if (schoolType?.includes('중학교') || schoolType?.includes('중')) {
    return '/images/characters/middle.png';
  }
  if (schoolType?.includes('고등학교') || schoolType?.includes('고')) {
    return '/images/characters/high.png';
  }
  // 기본값: 초등학교 캐릭터
  return '/images/characters/elementary.png';
};

export default function BattlePage() {
  const supabase = createClient();
  const router = useRouter();
  
  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError, refresh: refreshUser } = useUserSchool();
  
  // 학교 모드 관리 훅
  const schoolMode = useSchoolMode(userSchool);
  
  // 관심학교 드롭다운 상태 관리
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [interestSchools, setInterestSchools] = useState<any[]>([]);
  const [interestSchoolsLoading, setInterestSchoolsLoading] = useState<boolean>(false);
  
  // 학교검색 모달 상태 관리
  const [isSchoolSearchOpen, setIsSchoolSearchOpen] = useState<boolean>(false);
  
  // AI 분석 모달 상태 관리
  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState<boolean>(false);
  
  // 배틀 페이지는 읽기 전용이므로 권한 체크 불필요
  
  // 상태 관리
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [lastSelectedDate, setLastSelectedDate] = useState<string>(getCurrentDate());
  const [activeTab, setActiveTab] = useState<'menu' | 'meal'>('menu');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily'); // 일별/월별 선택 모드
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>(''); // 초/중/고 선택
  const [selectedRegion, setSelectedRegion] = useState<string>(''); // 지역 선택 (기본값: 사용자 지역, '전국' 옵션 포함)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 순위 정렬 순서 (asc: 1위부터, desc: 마지막부터)

  // 사용자 인증 상태 체크 - 배틀 페이지 접근 제어
  useEffect(() => {
    // SSR 환경에서는 아무것도 하지 않음
    if (typeof window === 'undefined') {
      return;
    }
    
    // 초기 로딩 상태에서는 대기
    if (userLoading) {
      return;
    }
    
    // 에러가 있는 경우에도 대기 (일시적 네트워크 오류 등)
    if (userError) {
      return;
    }
    
    // 로딩이 완료되고 에러가 없는데 사용자가 없으면 로그인 필요
    if (!user) {
      const currentUrl = window.location.href;
      const loginUrl = `/login?returnUrl=${encodeURIComponent(currentUrl)}`;
      router.replace(loginUrl);
      return;
    }
    
    // 사용자가 있으면 배틀 페이지 접근 허용
  }, [user, userLoading, userError, router]);

  // 사용자 학교 정보가 로드되면 기본 지역 설정
  useEffect(() => {
    if (userSchool?.region && !selectedRegion) {
      setSelectedRegion(userSchool.region);
    }
  }, [userSchool, selectedRegion]);

  // URL의 date와 school_code 파라미터를 상태에 반영 (초기 1회)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      const schoolCodeParam = params.get('school_code');
      
      if (dateParam) {
        setSelectedDate(dateParam);
      }
      
      // school_code 파라미터가 있으면 해당 학교를 관심학교로 설정
      if (schoolCodeParam && user) {
        console.log('🔗 URL에서 school_code 파라미터 감지:', schoolCodeParam);
        handleUrlSchoolCode(schoolCodeParam);
      }
    } catch (err) {
      console.error('URL 파라미터 파싱 오류:', err);
    }
  }, [user]); // user 의존성 추가
  
  // 배틀 데이터 상태
  const [battleData, setBattleData] = useState<any[]>([]);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState<string | null>(null);

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

    // 최대 10개 제한 확인
    if (interestSchools.length >= 10) {
      alert('최대 10개의 관심학교만 등록할 수 있습니다.');
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
          office_code: schoolData.ATPT_OFCDC_SC_CODE
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

  // 관심학교 삭제 함수
  const removeInterestSchool = async (schoolId: number) => {
    if (!user) {
      console.error('사용자 인증이 필요합니다');
      return;
    }

    try {
      const { error } = await supabase
        .from('interest_schools')
        .delete()
        .eq('id', schoolId)
        .eq('user_id', user.id);

      if (error) {
        console.error('관심학교 삭제 오류:', error);
        alert('관심학교 삭제에 실패했습니다.');
        return;
      }

      // 로컬 상태 업데이트
      setInterestSchools(prev => prev.filter(school => school.id !== schoolId));
      
      // 삭제된 학교가 현재 선택된 학교라면 내 학교로 돌아가기
      if (schoolMode.selectedInterestSchool?.id === schoolId) {
        schoolMode.selectMySchool();
      }
      
      alert('관심학교가 삭제되었습니다.');
      
    } catch (error) {
      console.error('관심학교 삭제 중 예외 발생:', error);
      alert('관심학교 삭제 중 오류가 발생했습니다.');
    }
  };

  // 학교등록 버튼 클릭 핸들러
  const handleSchoolRegister = () => {
    if (interestSchools.length >= 10) {
      alert('최대 10개의 관심학교만 등록할 수 있습니다.');
      return;
    }
    setIsSchoolSearchOpen(true);
  };

  // URL school_code 파라미터 처리 함수
  const handleUrlSchoolCode = async (schoolCode: string) => {
    try {
      console.log('🔍 URL school_code로 학교 정보 조회 시작:', schoolCode);
      
      // 학교 정보 조회 API 호출
      const response = await fetch(`/api/school-info?school_code=${schoolCode}`);
      if (!response.ok) {
        console.error('❌ 학교 정보 조회 실패:', response.status);
        return;
      }
      
      const schoolData = await response.json();
      console.log('✅ 학교 정보 조회 성공:', schoolData);
      
      if (schoolData.success && schoolData.data) {
        // 임시 관심학교 객체 생성 (실제 DB 저장 없이)
        const tempInterestSchool = {
          id: `temp_${schoolCode}`,
          school_name: schoolData.data.school_name,
          school_code: schoolCode,
          office_code: schoolData.data.office_code || '',
          user_id: user?.id || '',
          created_at: new Date().toISOString()
        };
        
        console.log('🏫 임시 관심학교 설정:', tempInterestSchool);
        
        // 학교 모드에서 해당 학교 선택
        schoolMode.selectInterestSchool(tempInterestSchool);
      }
    } catch (error) {
      console.error('❌ URL school_code 처리 오류:', error);
    }
  };

  // 배틀 계산 트리거 함수 (Plan A)
  const triggerBattleCalculation = async (schoolCode: string, viewMode: 'daily' | 'monthly', selectedDate: string, selectedMonth: string) => {
    try {
      console.log('🔄 배틀 계산 트리거 시작:', { schoolCode, viewMode, selectedDate, selectedMonth });
      
      // ...
      if (viewMode === 'daily') {
        // 일별 메뉴 배틀 계산
        console.log('📅 일별 메뉴 배틀 계산 시작...');
        await calculateDailyMenuBattle(selectedDate, schoolCode);
        console.log('✅ 일별 메뉴 배틀 계산 완료');
      } else {
        // 월별 메뉴 배틀 계산
        const [year, month] = selectedMonth.split('-');
        console.log('📅 월별 메뉴 배틀 계산 시작...');
        await calculateMonthlyMenuBattle(parseInt(year), parseInt(month), schoolCode);
        console.log('✅ 월별 메뉴 배틀 계산 완료');
      }
    } catch (error) {
      console.error('❌ 배틀 계산 트리거 오류:', error);
      throw error;
    }
  };

  // AI 앱 선택 핸들러
  const handleAIAppSelection = async (selectedApp: any) => {
    console.log('🎯 AI 앱 선택됨:', selectedApp);
    setIsAIAnalysisOpen(false);
    
    try {
      // 현재 학교 정보 확인
      const currentSchool = schoolMode.selectedInterestSchool || userSchool;
      console.log('🏫 현재 학교 정보:', currentSchool);
      
      if (!currentSchool?.school_code) {
        console.error('❌ 학교 정보 없음');
        alert('학교 정보가 없어 AI 분석을 진행할 수 없습니다.');
        return;
      }

      // 현재 날짜 정보 추출
      const targetDate = viewMode === 'daily' ? new Date(selectedDate) : new Date(selectedMonth);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      console.log(`🚀 AI 분석 시작: ${currentSchool.school_code}, ${year}-${month}`);
      console.log(`📅 분석 대상: viewMode=${viewMode}, selectedDate=${selectedDate}, selectedMonth=${selectedMonth}`);
      
      // 로딩 상태 표시 (선택적)
      const loadingToast = document.createElement('div');
      loadingToast.innerHTML = '📊 급식 데이터 분석 중...';
      loadingToast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; padding: 12px 20px; border-radius: 8px;
        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(loadingToast);

      // 1단계: 월간 급식 데이터 집계
      console.log('📡 1단계: 급식 데이터 집계 API 호출 시작...');
      const apiUrl = `/.netlify/functions/ai-analysis-data?school_code=${currentSchool.school_code}&year=${year}&month=${month}`;
      console.log('🔗 API URL:', apiUrl);
      
      const analysisResponse = await fetch(apiUrl);
      console.log('📊 API 응답 상태:', analysisResponse.status, analysisResponse.statusText);
      
      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('❌ API 응답 오류:', errorText);
        throw new Error(`데이터 집계 실패: ${analysisResponse.status} - ${errorText}`);
      }
      
      const analysisData = await analysisResponse.json();
      console.log('✅ 급식 데이터 집계 완료:', analysisData);
      
      // API 응답 구조 확인 (에러가 있으면 error 필드가 있음)
      if (analysisData.error) {
        throw new Error(analysisData.error || '데이터 집계 중 오류 발생');
      }

      console.log('✅ 급식 데이터 집계 완료:', analysisData);

      // 2단계: AI 프롬프트 생성
      console.log('📝 2단계: AI 프롬프트 생성 API 호출 시작...');
      const promptPayload = {
        analysis_data: analysisData,
        school_code: currentSchool.school_code
      };
      console.log('📤 프롬프트 생성 요청 데이터:', promptPayload);
      
      const promptResponse = await fetch('/.netlify/functions/generate-ai-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptPayload)
      });

      console.log('📝 프롬프트 API 응답 상태:', promptResponse.status, promptResponse.statusText);

      if (!promptResponse.ok) {
        const errorText = await promptResponse.text();
        console.error('❌ 프롬프트 API 응답 오류:', errorText);
        throw new Error(`프롬프트 생성 실패: ${promptResponse.status} - ${errorText}`);
      }

      const promptData = await promptResponse.json();
      console.log('📋 프롬프트 API 응답 데이터:', promptData);
      
      if (!promptData.success) {
        console.error('❌ 프롬프트 생성 실패:', promptData.error);
        throw new Error(promptData.error || '프롬프트 생성 중 오류 발생');
      }

      console.log('✅ AI 프롬프트 생성 완료:', promptData.data.prompt_length, '자');

      // 로딩 토스트 제거
      document.body.removeChild(loadingToast);

      // 3단계: AI 앱으로 프롬프트 전달 및 자동 전송
      console.log('🚀 3단계: AI 앱으로 프롬프트 전달 시작...');
      const aiPrompt = promptData.data.prompt;
      console.log('📝 생성된 프롬프트 길이:', aiPrompt.length, '자');
      console.log('📱 선택된 AI 앱:', selectedApp.id, selectedApp.name);
      
      // 클립보드 권한 확인 및 복사 (개선된 버전)
      let clipboardSuccess = false;
      let permissionDenied = false;
      
      try {
        // 1단계: 클립보드 권한 상태 확인
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({name: 'clipboard-write' as PermissionName});
            console.log('📋 클립보드 권한 상태:', permission.state);
            
            if (permission.state === 'denied') {
              permissionDenied = true;
              console.warn('⚠️ 클립보드 권한이 거부되어 있습니다');
            }
          } catch (permError) {
            console.warn('⚠️ 클립보드 권한 확인 실패:', permError);
            // 권한 확인 실패 시에도 클립보드 시도는 계속 진행
          }
        }
        
        // 2단계: 클립보드 API 시도
        if (navigator.clipboard && window.isSecureContext && !permissionDenied) {
          await navigator.clipboard.writeText(aiPrompt);
          clipboardSuccess = true;
          console.log('✅ 프롬프트가 클립보드에 복사되었습니다');
        } else {
          // 폴백: textarea 사용
          const textArea = document.createElement('textarea');
          textArea.value = aiPrompt;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          clipboardSuccess = document.execCommand('copy');
          document.body.removeChild(textArea);
          console.log(clipboardSuccess ? '✅ 폴백 방식으로 클립보드 복사 성공' : '❌ 클립보드 복사 실패');
        }
      } catch (error) {
        console.warn('⚠️ 클립보드 복사 실패:', error);
        clipboardSuccess = false;
        
        // 권한 거부 에러인지 확인
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
          permissionDenied = true;
          console.warn('🚫 클립보드 권한이 거부되었습니다');
        }
      }
      
      // 3단계: 권한 거부 시 간단한 설정 안내
      if (permissionDenied && !clipboardSuccess) {
        const permissionModal = document.createElement('div');
        permissionModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        permissionModal.innerHTML = `
          <div class="bg-white rounded-lg max-w-md w-full p-6">
            <div class="flex items-start gap-3 mb-4">
              <span class="text-3xl">🔒</span>
              <div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">클립보드 권한이 필요합니다</h3>
                <p class="text-sm text-gray-600">
                  AI 분석을 위해 프롬프트를 클립보드에 복사해야 합니다.
                </p>
              </div>
            </div>
            
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div class="text-sm text-blue-800">
                <div class="font-medium mb-2">📋 권한 허용 방법:</div>
                <ol class="list-decimal list-inside space-y-1">
                  <li>브라우저 주소창 옆의 <strong>🔒 자물쇠 아이콘</strong> 클릭</li>
                  <li><strong>"클립보드"</strong> 또는 <strong>"Clipboard"</strong> 찾기</li>
                  <li><strong>"허용"</strong> 또는 <strong>"Allow"</strong> 선택</li>
                  <li>아래 버튼으로 새로고침 후 다시 시도</li>
                </ol>
              </div>
            </div>
            
            <div class="flex gap-2">
              <button 
                onclick="window.location.reload()"
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium"
              >
                권한 설정 후 새로고침
              </button>
              <button 
                onclick="this.closest('.fixed').remove()"
                class="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(permissionModal);
      }
      
      // 스마트 자동 전송: GET 파라미터 시도 후 클립보드 폴백
      const sendPromptSmart = (appUrl: string, appName: string, prompt: string) => {
        console.log(`🎯 ${appName} 프롬프트 전송 시도 시작...`);
        console.log(`📏 프롬프트 길이: ${prompt.length}자 (임계값: 1000자)`);
        
        try {
          // 1단계: 짧은 프롬프트면 GET 파라미터로 시도
          if (prompt.length < 1000) {
            console.log(`✅ 짧은 프롬프트 - GET 파라미터 방식 사용`);
            const encodedPrompt = encodeURIComponent(prompt);
            const urlWithPrompt = `${appUrl}?q=${encodedPrompt}`;
            console.log(`🔗 생성된 URL: ${urlWithPrompt.substring(0, 100)}...`);
            
            window.open(urlWithPrompt, '_blank');
            console.log(`🚀 ${appName} 창 열기 완료`);
            
            // 성공 토스트
            showToast(`🚀 ${appName} 자동 전송!`, 'GET 파라미터로 프롬프트 전송됨', 'green');
            return true;
          } else {
            // 2단계: 긴 프롬프트면 바로 클립보드 폴백
            console.log(`⚠️ 긴 프롬프트 - 클립보드 폴백 사용`);
            throw new Error('프롬프트가 너무 길어서 클립보드 사용');
          }
        } catch (error) {
          console.warn(`❌ ${appName} 자동 전송 실패, 클립보드 폴백:`, error);
          
          // 폴백: 기본 페이지 열고 클립보드 사용
          console.log(`🔄 ${appName} 기본 페이지로 폴백...`);
          window.open(appUrl, '_blank');
          const clipboardMsg = clipboardSuccess 
            ? `프롬프트가 클립보드에 복사됨! ${appName}에서 Ctrl+V로 붙여넣기 하세요`
            : `클립보드 복사에 실패했습니다. AI 분석을 다시 시도해 주세요`;
          showToast(`📋 ${appName} 열림!`, clipboardMsg, clipboardSuccess ? 'blue' : 'orange');
          return false;
        }
      };

      // 토스트 메시지 표시 함수
      const showToast = (title: string, message: string, color: string) => {
        const toast = document.createElement('div');
        const bgColor = color === 'green' ? 'bg-green-500' : color === 'orange' ? 'bg-orange-500' : 'bg-blue-500';
        toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm`;
        toast.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xl">${color === 'green' ? '🚀' : '📋'}</span>
            <div>
              <div class="font-semibold">${title}</div>
              <div class="text-sm opacity-90">${message}</div>
            </div>
          </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 4000);
      };

      console.log('🔀 AI 앱별 처리 로직 시작...');
      
      if (selectedApp.id === 'chatgpt') {
        console.log('🤖 ChatGPT 선택됨');
        console.log(`📏 프롬프트 길이: ${aiPrompt.length}자`);
        sendPromptSmart('https://chat.openai.com', 'ChatGPT', aiPrompt);
        
      } else if (selectedApp.id === 'gemini') {
        console.log('💎 Gemini 선택됨');
        sendPromptSmart('https://gemini.google.com/app', 'Gemini', aiPrompt);
        
      } else if (selectedApp.id === 'claude') {
        console.log('🧠 Claude 선택됨');
        sendPromptSmart('https://claude.ai/chat', 'Claude', aiPrompt);
        
      } else if (selectedApp.id === 'grok') {
        console.log('🚀 Grok 선택됨');
        sendPromptSmart('https://x.com/i/grok', 'Grok', aiPrompt);
      } else {
        console.log('📱 기타 AI 앱 선택됨:', selectedApp);
        // 기본 처리: 딥링크 시도 후 웹 폴백
        const encodedPrompt = encodeURIComponent(aiPrompt);
        try {
          console.log('🔗 딥링크 시도...');
          const deepLinkUrl = `${selectedApp.deepLink}?text=${encodedPrompt}`;
          console.log('🔗 딥링크 URL:', deepLinkUrl);
          window.location.href = deepLinkUrl;
          
          // 2초 후 앱이 열리지 않으면 웹 버전으로 폴백
          setTimeout(() => {
            console.log('⏰ 딥링크 타임아웃, 웹 폴백 시도...');
            window.open(`${selectedApp.webUrl}?q=${encodedPrompt}`, '_blank');
          }, 2000);
        } catch (deepLinkError) {
          console.error('❌ 딥링크 실패:', deepLinkError);
          console.log('🔄 웹 버전으로 직접 폴백...');
          window.open(selectedApp.webUrl, '_blank');
        }
      }

      // 클립보드 복사 완료 안내 메시지
      const fallbackToast = document.createElement('div');
      fallbackToast.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px; margin-top: 2px;">📋</span>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px;">
              🎯 급식 분석 리포트 준비 완료!
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">📝 다음 단계:</div>
              <div style="font-size: 12px; line-height: 1.4;">
                1️⃣ ${selectedApp.name} 창에서 채팅창 클릭<br>
                2️⃣ <strong style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">
                  ${/Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? '길게 눌러서 붙여넣기' : 'Ctrl + V'}
                </strong> 키로 붙여넣기<br>
                3️⃣ Enter 키로 분석 시작!
              </div>
            </div>
            <div style="font-size: 11px; opacity: 0.8; text-align: center;">
              💡 ${Math.ceil(aiPrompt.length / 100) * 100}자의 상세한 분석 리포트가 클립보드에 복사되었습니다
            </div>
          </div>
        </div>
      `;
      fallbackToast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white; padding: 20px; border-radius: 16px;
        font-size: 14px; font-weight: 500; box-shadow: 0 12px 35px rgba(0,0,0,0.2);
        max-width: 380px; border: 1px solid rgba(255,255,255,0.25);
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(fallbackToast);
      
      setTimeout(() => {
        if (document.body.contains(fallbackToast)) {
          document.body.removeChild(fallbackToast);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ AI 분석 처리 오류:', error);
      
      // 로딩 토스트 제거 (있다면)
      const loadingToast = document.querySelector('div[style*="급식 데이터 분석 중"]');
      if (loadingToast) {
        document.body.removeChild(loadingToast);
      }
      
      // 에러 메시지 표시
      const errorToast = document.createElement('div');
      errorToast.innerHTML = `❌ 분석 중 오류 발생: ${error.message}`;
      errorToast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white; padding: 12px 20px; border-radius: 8px;
        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(errorToast);
      
      setTimeout(() => {
        if (document.body.contains(errorToast)) {
          document.body.removeChild(errorToast);
        }
      }, 5000);
      
      // 에러 발생 시에도 기본 웹 버전으로 폴백
      window.open(selectedApp.webUrl, '_blank');
    }
  };

  // 배틀 데이터 로딩 함수
  const loadBattleData = async () => {
    // 현재 선택된 학교 정보 결정 (관심학교 또는 내 학교)
    const currentSchool = schoolMode.selectedInterestSchool || userSchool;
    
    if (!currentSchool?.school_code) {
      console.log('⚠️ 학교 코드가 없어 배틀 데이터 로딩 중단');
      return;
    }
    
    console.log('🔍 배틀 데이터 로딩 시작:', {
      currentSchool: currentSchool.school_name,
      schoolCode: currentSchool.school_code,
      isInterestSchool: !!schoolMode.selectedInterestSchool,
      viewMode: viewMode,
      selectedDate: selectedDate,
      selectedMonth: selectedMonth
    });
    
    setBattleLoading(true);
    setBattleError(null);
    
    try {
      // 학교 유형 결정: 선택된 유형 또는 현재 학교 유형
      // 관심학교 모드일 때는 유저 학교의 school_type을 기준으로 함
      const schoolForType = schoolMode.selectedInterestSchool ? userSchool : currentSchool;
      const schoolTypeForApi = selectedSchoolType || 
        (schoolForType?.school_type?.includes('초') ? '초등학교' :
         schoolForType?.school_type?.includes('중') ? '중학교' :
         schoolForType?.school_type?.includes('고') ? '고등학교' : '');
      
      const params = new URLSearchParams({
        schoolCode: currentSchool.school_code,
        type: viewMode,
        ...(viewMode === 'daily' ? { date: selectedDate } : { month: selectedMonth }),
        ...(schoolTypeForApi && { schoolType: schoolTypeForApi }),
        ...(selectedRegion && selectedRegion !== '우리학교' && { region: selectedRegion }) // 우리학교가 아닐 때만 지역 필터링
      });
      
      // 우리학교 선택 시 학교별 필터링 추가
      if (selectedRegion === '우리학교') {
        params.append('schoolOnly', 'true');
      }
      
      // 탭에 따라 다른 API 호출
      const apiEndpoint = activeTab === 'menu' ? '/api/battle/menu' : '/api/battle/meal';
      const apiUrl = `${apiEndpoint}?${params}`;
      console.log('📡 API 호출 URL:', apiUrl);
      console.log('📋 API 파라미터:', Object.fromEntries(params));
      console.log('🏷️ 활성 탭:', activeTab);
      
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      console.log('📨 API 응답:', {
        status: response.status,
        ok: response.ok,
        result: result
      });
      
      if (!response.ok) {
        throw new Error(result.error || '배틀 데이터를 불러오는데 실패했습니다.');
      }
      
      // Plan A: 데이터가 없으면 자동 집계 계산
      if (!result.data || result.data.length === 0) {
        console.log('🔄 배틀 데이터가 없어 자동 집계 계산 시작...');
        await triggerBattleCalculation(currentSchool.school_code, viewMode, selectedDate, selectedMonth);
        
        // 집계 후 다시 조회
        console.log('🔄 집계 후 데이터 재조회...');
        const retryResponse = await fetch(apiUrl);
        const retryResult = await retryResponse.json();
        
        if (retryResponse.ok && retryResult.data) {
          setBattleData(retryResult.data);
          console.log('✅ 자동 집계 후 데이터 조회 성공:', retryResult.data.length);
        } else {
          setBattleData([]);
          console.log('⚠️ 자동 집계 후에도 데이터 없음');
        }
      } else {
        setBattleData(result.data);
      }
    } catch (error) {
      console.error('배틀 데이터 로딩 오류:', error);
      setBattleError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setBattleLoading(false);
    }
  };

  // 데이터 로딩 useEffect
  useEffect(() => {
    const currentSchool = schoolMode.selectedInterestSchool || userSchool;
    if (currentSchool?.school_code) {
      console.log('📣 배틀 데이터 로딩 트리거됨', { 
        currentSchool: currentSchool.school_name,
        isInterestSchool: !!schoolMode.selectedInterestSchool,
        activeTab, 
        viewMode, 
        selectedDate, 
        selectedMonth 
      });
      loadBattleData();
    }
  }, [activeTab, userSchool?.school_code, schoolMode.selectedInterestSchool, viewMode, selectedDate, selectedMonth, selectedSchoolType, selectedRegion]);

  // 로딩 상태 표시
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">배틀 페이지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
      {/* 학교 정보 헤더 및 관심학교 드롭다운 */}
      <div className={`shadow-sm rounded p-2 mb-3 border-l-2 flex items-center justify-between ${
        schoolMode.isStudentMode 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500' 
          : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-500'
      }`}>
        {/* 왼쪽: 학교 정보 (isStudentMode일 때만 표시) */}
        <div className="flex items-center">
          {schoolMode.isStudentMode ? (
            <>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
                {userSchool?.school_name || '학교 정보 없음'}
              </span>
              {(userSchool?.grade || userSchool?.class) && (
                <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                  {userSchool.grade ? `${userSchool.grade}학년` : ''}
                  {userSchool.class ? ` ${userSchool.class}반` : ''}
                </span>
              )}
              
              {/* 초중고 캐릭터 - 반 끝에서 1cm 떨어진 곳에 */}
              {userSchool?.school_type && (
                <img 
                  src={getSchoolCharacterImage(userSchool.school_type)}
                  alt="학교 캐릭터"
                  className="ml-3 w-8 h-8 md:w-10 md:h-10 drop-shadow-sm"
                />
              )}
            </>
          ) : (
            /* 관심학교 모드일 때 안내 메시지 */
            <span className="text-orange-600 text-sm font-medium">
              학생은 '프로필'에서 학교등록부터 하세요^^
            </span>
          )}
        </div>
        
        {/* 오른쪽: 관심학교 드롭다운 */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300 rounded-md hover:bg-white transition-colors text-sm font-medium shadow-sm"
              onClick={handleDropdownToggle}
            >
              <span className="text-blue-600">🏠</span>
              <span>
                {schoolMode.isStudentMode 
                  ? '관심학교' 
                  : `관심학교 - ${schoolMode.getDisplaySchoolName()}`
                }
              </span>
              <svg className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* 드롭다운 메뉴 */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">관심학교 선택</h3>
                    <button
                      onClick={handleSchoolRegister}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                    >
                      + 학교등록
                    </button>
                  </div>
                  
                  {/* 내 학교 옵션 */}
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
                          <div 
                            key={school.id}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                              isSelected 
                                ? 'text-gray-700 bg-blue-50' 
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <button
                              className="flex items-center gap-3 flex-1"
                              onClick={() => {
                                // 관심학교 선택
                                schoolMode.selectInterestSchool({
                                  id: school.id,
                                  school_name: school.school_name,
                                  school_code: school.school_code,
                                  office_code: school.office_code,
                                  created_at: school.created_at
                                });
                                setIsDropdownOpen(false);
                              }}
                            >
                              <span className="text-blue-600">🏠</span>
                              <div className="flex-1 text-left">
                                <div className="font-medium">{school.school_name}</div>
                                <div className="text-xs text-gray-500">
                                  {isSelected ? '현재 선택됨' : '선택하기'}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">선택됨</span>
                              )}
                            </button>
                            <button
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`${school.school_name}을(를) 관심학교에서 삭제하시겠습니까?`)) {
                                  removeInterestSchool(school.id);
                                }
                              }}
                              title="관심학교 삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <div className="text-sm mb-2">등록된 관심학교가 없습니다</div>
                      <button
                        onClick={handleSchoolRegister}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        관심학교 등록하기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      


      {/* 2개 섹션 탭 UI */}
      <div className="mb-6">
        <div className="flex gap-6 mb-6">
          <div
            onClick={() => setActiveTab('menu')}
            className={`flex-1 cursor-pointer transition-all duration-200 ${
              activeTab === 'menu'
                ? 'border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-white pl-4 py-3 rounded-r-lg'
                : 'border-l-4 border-gray-200 bg-gradient-to-r from-gray-50 to-white pl-4 py-3 rounded-r-lg hover:border-red-300 hover:from-red-25'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍽️</span>
              <div>
                <h3 className={`font-bold text-lg ${activeTab === 'menu' ? 'text-red-700' : 'text-gray-700'}`}>
                  메뉴 배틀
                </h3>
                <p className={`text-sm ${activeTab === 'menu' ? 'text-red-600' : 'text-gray-500'}`}>
                  오늘의 인기 메뉴 순위
                </p>
              </div>
            </div>
          </div>
          <div
            onClick={() => setActiveTab('meal')}
            className={`flex-1 cursor-pointer transition-all duration-200 ${
              activeTab === 'meal'
                ? 'border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white pl-4 py-3 rounded-r-lg'
                : 'border-l-4 border-gray-200 bg-gradient-to-r from-gray-50 to-white pl-4 py-3 rounded-r-lg hover:border-blue-300 hover:from-blue-25'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <h3 className={`font-bold text-lg ${activeTab === 'meal' ? 'text-blue-700' : 'text-gray-700'}`}>
                  급식 배틀
                </h3>
                <p className={`text-sm ${activeTab === 'meal' ? 'text-blue-600' : 'text-gray-500'}`}>
                  학교간 급식 순위 경쟁
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 네비게이션 컨트롤들 - 한 줄 배치 (모바일에서도) */}
        <div className="mb-6">
          <div className="flex gap-4 md:gap-6">
            {/* 일별 집계 섹션 */}
            <div className={`flex-1 transition-all duration-300 ${
              viewMode === 'daily' ? 'opacity-100' : 'opacity-60'
            }`}>
              <button
                onClick={() => {
                  // 일별 뷰 모드로 전환
                  if (viewMode !== 'daily') {
                    // 월별에서 일별로 전환 시 이전에 저장해둔 날짜로 돌아가기
                    if (viewMode === 'monthly') {
                      // 이전에 보던 날짜(lastSelectedDate)가 현재 선택된 월에 속하는지 확인
                      const lastMonth = lastSelectedDate.substring(0, 7);
                      if (lastMonth === selectedMonth) {
                        // 동일한 월이면 이전 날짜 사용
                        console.log(`🔄 일별 버튼→일별 전환: 이전 날짜 ${lastSelectedDate} 복원`);
                        setSelectedDate(lastSelectedDate);
                      } else {
                        // 다른 월이면 현재 선택된 월의 1일로 설정
                        const newDate = `${selectedMonth}-01`;
                        console.log(`🔄 일별 버튼→일별 전환: selectedDate를 ${newDate}로 설정 (월 변경됨)`);
                        setSelectedDate(newDate);
                      }
                    }
                    setViewMode('daily');
                  }
                }}
                className={`text-sm font-medium mb-2 block transition-colors duration-200 ${
                  viewMode === 'daily' 
                    ? (activeTab === 'menu' ? 'text-red-600' : 'text-blue-600')
                    : (activeTab === 'menu' ? 'text-gray-500 hover:text-red-500' : 'text-gray-500 hover:text-blue-500')
                }`}
              >
                일별 집계
              </button>
              <div 
                className={`transition-all duration-300 cursor-pointer ${
                  viewMode === 'daily' ? 'transform-none' : 'transform scale-95'
                }`}
                onClick={() => {
                  // 🎯 UX 개선: 날짜 선택기 클릭 시 일별 모드로 자동 전환
                  if (viewMode !== 'daily') {
                    if (viewMode === 'monthly') {
                      // 월별에서 일별로 전환 시 이전에 저장해둔 날짜로 돌아가기
                      const lastMonth = lastSelectedDate.substring(0, 7);
                      if (lastMonth === selectedMonth) {
                        // 동일한 월이면 이전 날짜 사용
                        console.log(`🔄 날짜 선택기 클릭→일별 전환: 이전 날짜 ${lastSelectedDate} 복원`);
                        setSelectedDate(lastSelectedDate);
                      } else {
                        // 다른 월이면 현재 선택된 월의 1일로 설정
                        const newDate = `${selectedMonth}-01`;
                        console.log(`🔄 날짜 선택기 클릭→일별 전환: selectedDate를 ${newDate}로 설정 (월 변경됨)`);
                        setSelectedDate(newDate);
                      }
                    }
                    setViewMode('daily');
                  }
                }}
              >
                <DateNavigator 
                  selectedDate={selectedDate}
                  onDateChange={(date) => {
                    // 🎯 UX 개선: 날짜 변경 시 일별 모드로 자동 전환
                    if (viewMode !== 'daily') {
                      setViewMode('daily');
                    }
                    setSelectedDate(date);
                    if (typeof window !== 'undefined') {
                      try {
                        const params = new URLSearchParams(window.location.search);
                        params.set('date', date);
                        const url = `${window.location.pathname}?${params.toString()}`;
                        window.history.replaceState({}, '', url);
                      } catch (err) {
                        console.error('URL 날짜 파라미터 업데이트 오류:', err);
                      }
                    }
                  }}
                  theme={activeTab === 'menu' ? 'red' : 'blue'}
                  size="sm"
                />
              </div>
            </div>

            {/* 월별 집계 섹션 */}
            <div className={`flex-1 transition-all duration-300 ${
              viewMode === 'monthly' ? 'opacity-100' : 'opacity-60'
            }`}>
              <button
                onClick={() => {
                  // 월별 뷰 모드로 전환
                  if (viewMode !== 'monthly') {
                    // 일별에서 월별로 전환 시 해당 날짜의 연월을 selectedMonth로 설정
                    if (viewMode === 'daily') {
                      // 현재 선택된 날짜를 기억해두기
                      setLastSelectedDate(selectedDate);
                      
                      const month = selectedDate.substring(0, 7);
                      console.log(`🔄 월별 버튼→월별 전환: selectedMonth를 ${month}로 설정, 이전 날짜 ${selectedDate} 저장`);
                      setSelectedMonth(month);
                    }
                    setViewMode('monthly');
                  }
                }}
                className={`text-sm font-medium mb-2 block transition-colors duration-200 ${
                  viewMode === 'monthly' 
                    ? (activeTab === 'menu' ? 'text-red-600' : 'text-blue-600')
                    : (activeTab === 'menu' ? 'text-gray-500 hover:text-red-500' : 'text-gray-500 hover:text-blue-500')
                }`}
              >
                월별 집계
              </button>
              <div className={`flex items-center gap-1 w-fit transition-all duration-300 cursor-pointer ${
                viewMode === 'monthly' ? 'transform-none' : 'transform scale-95'
              }`}>
                <button
                  onClick={() => {
                    // 🎯 UX 개선: 월별 선택기 클릭 시 월별 모드로 자동 전환
                    if (viewMode !== 'monthly') {
                      setViewMode('monthly');
                    }
                    const current = new Date(selectedMonth + '-01');
                    current.setMonth(current.getMonth() - 1);
                    setSelectedMonth(current.toISOString().slice(0, 7));
                  }}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    viewMode === 'monthly'
                      ? (activeTab === 'menu' 
                           ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
                           : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600')
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div 
                  className={`rounded-lg px-2 py-1.5 min-w-20 text-center border transition-all duration-200 text-xs cursor-pointer hover:opacity-80 ${
                    viewMode === 'monthly'
                      ? (activeTab === 'menu' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')
                      : 'bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => {
                    // 🎯 UX 개선: 월별 날짜 표시 영역 클릭 시 월별 모드로 자동 전환
                    if (viewMode !== 'monthly') {
                      if (viewMode === 'daily') {
                        // 일별에서 월별로 전환 시 selectedMonth를 해당 월로 설정
                        const newMonth = selectedDate.substring(0, 7);
                        console.log(`🔄 월별 표시 클릭→월별 전환: selectedMonth를 ${newMonth}로 설정`);
                        setSelectedMonth(newMonth);
                      }
                      setViewMode('monthly');
                    }
                  }}
                >
                  <span className={`font-medium transition-colors duration-200 ${
                    viewMode === 'monthly' 
                      ? (activeTab === 'menu' ? 'text-red-700' : 'text-blue-700') 
                      : 'text-gray-500'
                  }`}>
                    {new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { 
                      year: '2-digit', 
                      month: 'short' 
                    })}
                  </span>
                </div>
                
                <button
                  onClick={() => {
                    // 🎯 UX 개선: 월별 선택기 클릭 시 월별 모드로 자동 전환
                    if (viewMode !== 'monthly') {
                      setViewMode('monthly');
                    }
                    const current = new Date(selectedMonth + '-01');
                    current.setMonth(current.getMonth() + 1);
                    setSelectedMonth(current.toISOString().slice(0, 7));
                  }}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    viewMode === 'monthly'
                      ? (activeTab === 'menu' 
                           ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
                           : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600')
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 탭별 콘텐츠 영역 */}
        <div className={`min-h-96 rounded-lg p-6 transition-colors duration-300 ${
          activeTab === 'menu' ? 'bg-red-50' : 'bg-blue-50'
        }`}>
          {activeTab === 'menu' ? (
            <div>
              {/* 지역 및 학교 유형 선택 */}
              <div className="bg-white rounded-lg p-4 mb-6 border border-red-200">
                {/* 지역 선택 버튼 - 왼쪽 정렬 */}
                <div className="text-left mb-4 ml-3">
                  <div className="flex gap-2">
                    {/* 우리학교 버튼 */}
                    {userSchool?.school_code && (
                      <button
                        onClick={() => setSelectedRegion('우리학교')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedRegion === '우리학교'
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        }`}
                      >
                        우리학교
                      </button>
                    )}
                    {/* 사용자 지역 버튼 */}
                    {userSchool?.region && (
                      <button
                        onClick={() => setSelectedRegion(userSchool.region)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedRegion === userSchool.region
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        }`}
                      >
                        {userSchool.region}
                      </button>
                    )}
                    {/* 전국 버튼 */}
                    <button
                      onClick={() => setSelectedRegion('전국')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedRegion === '전국'
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      전국
                    </button>
                  </div>
                </div>

                {/* 학교 유형 선택 - 한 줄 배치 */}
                <div className="flex gap-2 justify-center">
                  {['초등학교', '중학교', '고등학교'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedSchoolType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedSchoolType === type || (!selectedSchoolType && userSchool?.school_type?.includes(type.slice(0, 1)))
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 일간 베스트 메뉴 도표 */}
              <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                {/* 도표 제목 */}
                <div className="bg-red-500 text-white px-4 py-3">
                  <div className="flex items-center justify-center gap-3">
                    <h3 className="font-bold">
                      {viewMode === 'daily' ? '일간' : '월간'} 베스트 메뉴
                    </h3>
                    {/* 순위 정렬 버튼 - 개선된 디자인 */}
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="flex flex-col items-center justify-center w-8 h-8 hover:bg-red-400 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                      title={sortOrder === 'asc' ? '내림차순으로 변경 (높은 순위부터)' : '오름차순으로 변경 (낮은 순위부터)'}
                    >
                      {/* 위쪽 화살표 (오름차순) */}
                      <svg 
                        className={`w-5 h-5 transition-all duration-200 ${
                          sortOrder === 'asc' 
                            ? 'opacity-100 text-white drop-shadow-sm transform scale-110' 
                            : 'opacity-50 text-red-100'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      {/* 아래쪽 화살표 (내림차순) */}
                      <svg 
                        className={`w-5 h-5 -mt-2 transition-all duration-200 ${
                          sortOrder === 'desc' 
                            ? 'opacity-100 text-white drop-shadow-sm transform scale-110' 
                            : 'opacity-50 text-red-100'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* 테이블 헤더 */}
                <div className="bg-red-50 border-b border-red-200">
                  <div className={`grid gap-4 px-4 py-3 text-sm font-medium text-red-700 ${
                    viewMode === 'monthly' ? 'grid-cols-5' : 'grid-cols-4'
                  }`}>
                    <div className="text-center">순위</div>
                    {viewMode === 'monthly' && <div className="text-center">급식날짜</div>}
                    <div className="text-center">메뉴명</div>
                    <div className="text-center">점수</div>
                    <div className="text-center">평가수</div>
                  </div>
                </div>
                
                {/* 테이블 내용 - 실제 데이터 */}
                <div className={`divide-y divide-red-100 ${viewMode === 'monthly' ? 'max-h-96 overflow-y-auto' : ''}`}>
                  {userLoading || (!userLoading && !user) ? (
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">
                          {userLoading ? '사용자 정보를 불러오는 중...' : '로그인 페이지로 이동 중...'}
                        </p>
                      </div>
                    </div>
                  ) : battleLoading ? (
                    <div className="p-8 text-center text-red-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
                      <p>데이터를 불러오는 중...</p>
                    </div>
                  ) : battleError ? (
                    <div className="p-8 text-center text-red-500">
                      <p className="mb-2">오류가 발생했습니다</p>
                      <p className="text-sm text-red-400">{battleError}</p>
                      <button 
                        onClick={loadBattleData}
                        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : battleData.length === 0 ? (
                    <div className="p-8 text-center text-red-400">
                      <p>해당 {viewMode === 'daily' ? '날짜' : '월'}에 배틀 데이터가 없습니다.</p>
                      <p className="text-sm mt-2">메뉴에 별점을 매겨주세요!</p>
                    </div>
                  ) : (
                    (sortOrder === 'asc' ? battleData : [...battleData].reverse())
                      .slice(0, viewMode === 'monthly' ? 20 : battleData.length)
                      .map((item, index) => (
                      <div key={item.menu_item_id} className={`grid gap-4 px-4 py-4 hover:bg-red-25 transition-colors ${
                        viewMode === 'monthly' ? 'grid-cols-5' : 'grid-cols-4'
                      }`}>
                        <div className="text-center font-medium text-red-600">
                          {sortOrder === 'asc' ? (viewMode === 'daily' ? item.daily_rank : item.monthly_rank) : battleData.length - index}
                        </div>
                        {viewMode === 'monthly' && (
                          <div className="text-center text-gray-600 text-sm">
                            {item.meal_date ? new Date(item.meal_date).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric'
                            }) : '-'}
                          </div>
                        )}
                        <div className="text-center font-medium text-gray-800">
                          {item.item_name}
                        </div>
                        <div className="text-center text-red-600 font-bold">
                          {item.final_avg_rating?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-center text-gray-600">
                          {item.final_rating_count || 0}
                        </div>
                      </div>
                    ))
                  )}
                  {/* 월별 집계에서 20개 이상일 때 더보기 안내 */}
                  {viewMode === 'monthly' && battleData.length > 20 && (
                    <div className="p-4 text-center text-red-400 bg-red-25 border-t border-red-100">
                      <p className="text-sm">
                        상위 20개 메뉴만 표시됩니다 (전체 {battleData.length}개)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* 지역 및 학교 유형 선택 */}
              <div className="bg-white rounded-lg p-4 mb-6 border border-blue-200">
                {/* 지역 선택 버튼 - 왼쪽 정렬 */}
                <div className="text-left mb-4 ml-3">
                  <div className="flex gap-2">
                    {/* 사용자 지역 버튼 */}
                    {userSchool?.region && (
                      <button
                        onClick={() => setSelectedRegion(userSchool.region)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedRegion === userSchool.region
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        {userSchool.region}
                      </button>
                    )}
                    {/* 전국 버튼 */}
                    <button
                      onClick={() => setSelectedRegion('전국')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedRegion === '전국'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      전국
                    </button>
                  </div>
                </div>

                {/* 학교 유형 선택 - 한 줄 배치 */}
                <div className="flex gap-2 justify-center">
                  {['초등학교', '중학교', '고등학교'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedSchoolType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedSchoolType === type || (!selectedSchoolType && userSchool?.school_type?.includes(type.slice(0, 1)))
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 우리동네 급식배틀 테이블 */}
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                {/* 테이블 제목 */}
                <div className="bg-blue-500 text-white px-4 py-3">
                  <div className="flex items-center justify-center gap-3">
                    <h3 className="font-bold">
                      우리동네 급식배틀
                    </h3>
                    {/* 순위 정렬 버튼 - 개선된 디자인 */}
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="flex flex-col items-center justify-center w-8 h-8 hover:bg-blue-400 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                      title={sortOrder === 'asc' ? '내림차순으로 변경 (높은 순위부터)' : '오름차순으로 변경 (낮은 순위부터)'}
                    >
                      {/* 위쪽 화살표 (오름차순) */}
                      <svg 
                        className={`w-5 h-5 transition-all duration-200 ${
                          sortOrder === 'asc' 
                            ? 'opacity-100 text-white drop-shadow-sm transform scale-110' 
                            : 'opacity-50 text-blue-100'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      {/* 아래쪽 화살표 (내림차순) */}
                      <svg 
                        className={`w-5 h-5 -mt-2 transition-all duration-200 ${
                          sortOrder === 'desc' 
                            ? 'opacity-100 text-white drop-shadow-sm transform scale-110' 
                            : 'opacity-50 text-blue-100'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* 테이블 헤더 */}
                <div className="bg-blue-50 border-b border-blue-200">
                  <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm font-medium text-blue-700">
                    <div className="text-center">순위</div>
                    <div className="text-center">학교명</div>
                    <div className="text-center">점수</div>
                    <div className="text-center">평가수</div>
                  </div>
                </div>
                
                {/* 테이블 내용 - 데이터 표시 */}
                {battleLoading ? (
                  <div className="p-8 text-center text-blue-400">
                    <div className="animate-pulse flex justify-center mb-4">
                      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent border-opacity-50 animate-spin"></div>
                    </div>
                    <p>데이터를 불러오는 중...</p>
                  </div>
                ) : battleError ? (
                  <div className="p-8 text-center text-red-400">
                    <p>오류가 발생했습니다</p>
                    <p className="text-sm mt-1">{battleError}</p>
                  </div>
                ) : battleData.length === 0 ? (
                  <div className="p-8 text-center text-blue-400">
                    <p>표시할 배틀 데이터가 없습니다</p>
                    <p className="text-sm mt-2">다른 날짜나 학교 유형을 선택해보세요</p>
                  </div>
                ) : (
                  <div>
                    {/* 정렬된 배틀 데이터 표시 - API에서 이미 schoolType으로 필터링됨 */}
                    {battleData
                      .sort((a, b) => {
                        // 정렬 로직 (asc는 1위부터, desc는 마지막부터)
                        // menu와 meal 모두 동일한 필드명 사용
                        const rankField = viewMode === 'daily' ? 'daily_rank' : 'monthly_rank';
                        
                        return sortOrder === 'asc' ? 
                          a[rankField] - b[rankField] : 
                          b[rankField] - a[rankField];
                      })
                      .map((item, index) => {
                        // 순위 필드 결정 - menu와 meal 모두 동일한 필드명 사용
                        const rankField = viewMode === 'daily' ? 'daily_rank' : 'monthly_rank';
                        
                        // 점수와 평가 수 필드 결정
                        let ratingField = 'avg_rating';
                        let countField = 'rating_count';
                        
                        if (activeTab === 'meal') {
                          if (viewMode === 'monthly') {
                            ratingField = 'final_avg_rating';
                            countField = 'final_rating_count';
                          } else {
                            // 일별 급식배틀도 동일한 필드명 사용
                            ratingField = 'avg_rating';
                            countField = 'rating_count';
                          }
                        }
                          
                        return (
                          <div 
                            key={`${item.school_code}-${index}`}
                            className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                          >
                            <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm">
                              <div className="text-center">
                                <span className={`inline-block w-8 h-8 rounded-full font-bold flex items-center justify-center ${item[rankField] <= 3 ? 'bg-yellow-400 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                  {item[rankField]}
                                </span>
                              </div>
                              <div className="text-center font-medium text-gray-800">
                                {item.school_name || '-'}
                              </div>
                              <div className="text-center font-medium text-blue-700">
                                {item[ratingField] ? item[ratingField].toFixed(1) : '-'}
                              </div>
                              <div className="text-center text-gray-500">
                                {item[countField] || '0'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* AI 분석 및 공유 버튼 */}
          <div className="flex gap-3 mt-8">
            {/* AI 분석 버튼 */}
            <button
              onClick={() => setIsAIAnalysisOpen(true)}
              className="flex-1 p-0 relative overflow-hidden hover:opacity-90"
            >
              <svg width="100%" height="60" viewBox="0 0 400 60" role="img" aria-label="AI 분석 버튼">
                <defs>
                  <linearGradient id="battleAiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6A00FF"/>
                    <stop offset="50%" stopColor="#3F55FF"/>
                    <stop offset="100%" stopColor="#00D1FF"/>
                  </linearGradient>
                  <filter id="battleAiShadow" x="-20%" y="-20%" width="140%" height="160%">
                    <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0A1B2B" floodOpacity="0.18"/>
                  </filter>
                </defs>
                
                {/* Button shape */}
                <rect x="3" y="3" rx="12" ry="12" width="394" height="54" fill="url(#battleAiGrad)" filter="url(#battleAiShadow)"/>
                
                {/* Robot icon */}
                <g id="robot" transform="translate(35,30) scale(0.3)">
                  {/* Antenna */}
                  <circle cx="-10" cy="-58" r="8" fill="#1EE6D6"/>
                  <rect x="-12" y="-48" rx="4" ry="4" width="4" height="16" fill="#1EE6D6"/>
                  
                  {/* Head outer */}
                  <rect x="-80" y="-40" width="140" height="100" rx="28" ry="28" fill="#1EE6D6"/>
                  
                  {/* Side ears */}
                  <rect x="-98" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
                  <rect x="60" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
                  
                  {/* Face window */}
                  <rect x="-60" y="-20" width="100" height="60" rx="18" ry="18" fill="#0A1B2B"/>
                  
                  {/* Eyes */}
                  <circle cx="-32" cy="4" r="7" fill="#1EE6D6"/>
                  <circle cx="8" cy="4" r="7" fill="#1EE6D6"/>
                  
                  {/* Smile */}
                  <path d="M -36 20 Q -26 32 -16 20" fill="none" stroke="#1EE6D6" strokeWidth="4" strokeLinecap="round"/>
                  
                  {/* Neck */}
                  <rect x="-40" y="60" width="60" height="10" rx="5" ry="5" fill="#11BDB0"/>
                  
                  {/* Base */}
                  <path d="M -70 70 h 120 a 20 20 0 0 1 0 40 h -120 a 20 20 0 0 1 0 -40 z" fill="#1EE6D6"/>
                </g>
                
                {/* Text - centered */}
                <text x="200" y="28" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
                  fontWeight="700" fontSize="16" fill="#FFFFFF" textAnchor="middle">AI 분석</text>
                <text x="200" y="44" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
                  fontWeight="400" fontSize="12" fill="#FFFFFF" opacity="0.9" textAnchor="middle">
                  {viewMode === 'daily' 
                    ? `${new Date(selectedDate).getFullYear()}년 ${new Date(selectedDate).getMonth() + 1}월`
                    : `${new Date(selectedMonth).getFullYear()}년 ${new Date(selectedMonth).getMonth() + 1}월`
                  } 리포트
                </text>
              </svg>
            </button>
            
            {/* 공유 버튼 */}
            <ShareButton
              mealDate={viewMode === 'daily' ? selectedDate : selectedMonth}
              schoolName={schoolMode.selectedSchool?.school_name || userSchool?.school_name || '학교정보 없음'}
              schoolCode={schoolMode.selectedSchool?.school_code || userSchool?.school_code}
              isBattlePage={true}
              activeTab={activeTab}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      
      {/* 학교검색 모달 */}
      <SchoolSearchModal 
        isOpen={isSchoolSearchOpen}
        onClose={() => setIsSchoolSearchOpen(false)}
        onSelectSchool={addInterestSchool}
      />
      
      {/* AI 분석 모달 */}
      <AIAnalysisModal
        isOpen={isAIAnalysisOpen}
        onClose={() => setIsAIAnalysisOpen(false)}
        schoolName={schoolMode.selectedSchool?.school_name || userSchool?.school_name || '학교정보 없음'}
        monthYear={viewMode === 'daily' 
          ? `${new Date(selectedDate).getFullYear()}년 ${new Date(selectedDate).getMonth() + 1}월`
          : `${new Date(selectedMonth).getFullYear()}년 ${new Date(selectedMonth).getMonth() + 1}월`
        }
        isViewingMode={schoolMode.isViewingMode}
        onSelectApp={handleAIAppSelection}
      />
      </div>
    </div>
  );
}
