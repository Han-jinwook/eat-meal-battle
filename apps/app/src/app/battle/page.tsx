'use client';

import { useState, useEffect, useRef } from 'react';
import useUserSchool from '@/hooks/useUserSchool';
import { useSchoolMode } from '@/hooks/useSchoolMode';
import DateNavigator from '@/components/DateNavigator';
import { getCurrentDate } from '@/utils/DateUtils';
import { createClient } from '@/lib/supabase';
import SchoolSearchModal from '@/components/SchoolSearchModal';

export default function BattlePage() {
  const supabase = createClient();
  
  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError } = useUserSchool();
  
  // 학교 모드 관리 훅
  const schoolMode = useSchoolMode(userSchool);
  
  // 관심학교 드롭다운 상태 관리
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [interestSchools, setInterestSchools] = useState<any[]>([]);
  const [interestSchoolsLoading, setInterestSchoolsLoading] = useState<boolean>(false);
  
  // 학교검색 모달 상태 관리
  const [isSchoolSearchOpen, setIsSchoolSearchOpen] = useState<boolean>(false);
  
  // 배틀 페이지는 읽기 전용이므로 권한 체크 불필요
  
  // 상태 관리
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [lastSelectedDate, setLastSelectedDate] = useState<string>(getCurrentDate());
  const [activeTab, setActiveTab] = useState<'menu' | 'meal'>('menu');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily'); // 일별/월별 선택 모드
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>(''); // 초/중/고 선택
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 순위 정렬 순서 (asc: 1위부터, desc: 마지막부터)

  // URL의 date 파라미터를 상태에 반영 (초기 1회)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam) {
        setSelectedDate(dateParam);
      }
    } catch (err) {
      console.error('날짜 파라미터 파싱 오류:', err);
    }
  }, []);
  
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

  // 학교등록 버튼 클릭 핸들러
  const handleSchoolRegister = () => {
    if (interestSchools.length >= 3) {
      alert('최대 3개의 관심학교만 등록할 수 있습니다.');
      return;
    }
    setIsSchoolSearchOpen(true);
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
      const schoolTypeForApi = selectedSchoolType || 
        (currentSchool?.school_type?.includes('초') ? '초등학교' :
         currentSchool?.school_type?.includes('중') ? '중학교' :
         currentSchool?.school_type?.includes('고') ? '고등학교' : '');
      
      const params = new URLSearchParams({
        schoolCode: currentSchool.school_code,
        type: viewMode,
        ...(viewMode === 'daily' ? { date: selectedDate } : { month: selectedMonth }),
        ...(schoolTypeForApi && { schoolType: schoolTypeForApi }),
        ...(currentSchool.region && { region: currentSchool.region }) // 지역 기반 필터링
      });
      
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
      
      setBattleData(result.data || []);
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
  }, [activeTab, userSchool?.school_code, schoolMode.selectedInterestSchool, viewMode, selectedDate, selectedMonth, selectedSchoolType]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* 학교 정보 헤더 및 관심학교 드롭다운 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center justify-between">
        {/* 왼쪽: 학교 정보 (isStudentMode일 때만 표시) */}
        <div className="flex items-center">
          {schoolMode.isStudentMode && (
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
            </>
          )}
        </div>
        
        {/* 오른쪽: 관심학교 드롭다운 */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleDropdownToggle}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 flex items-center gap-2"
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
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              activeTab === 'menu'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            메뉴 배틀
          </button>
          <button
            onClick={() => setActiveTab('meal')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              activeTab === 'meal'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            급식 배틀
          </button>
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
                <div className="divide-y divide-red-100">
                  {battleLoading ? (
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
                    (sortOrder === 'asc' ? battleData : [...battleData].reverse()).map((item, index) => (
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
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* 지역 및 학교 유형 선택 */}
              <div className="bg-white rounded-lg p-4 mb-6 border border-blue-200">
                {/* 지역 정보 - 왼쪽 정렬 */}
                <div className="text-left mb-4 ml-3">
                  <span className="text-blue-700 font-medium">
                    {userSchool?.region || '로딩 중...'}
                  </span>
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
                        if (activeTab === 'meal' && viewMode === 'monthly') {
                          ratingField = 'final_avg_rating';
                        }
                          
                        let countField = 'rating_count';
                        if (activeTab === 'meal' && viewMode === 'monthly') {
                          countField = 'final_rating_count';
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
        </div>
      </div>
      
      {/* 학교검색 모달 */}
      <SchoolSearchModal 
        isOpen={isSchoolSearchOpen}
        onClose={() => setIsSchoolSearchOpen(false)}
        onSelectSchool={addInterestSchool}
      />
    </div>
  );
}
