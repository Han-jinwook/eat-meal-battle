'use client';

import { useState, useEffect } from 'react';
import useUserSchool from '@/hooks/useUserSchool';
import DateNavigator from '@/components/DateNavigator';
import { getCurrentDate } from '@/utils/DateUtils';

export default function BattlePage() {
  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError } = useUserSchool();
  
  // 상태 관리
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [activeTab, setActiveTab] = useState<'menu' | 'meal'>('menu');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily'); // 일별/월별 선택 모드
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>(''); // 초/중/고 선택
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 순위 정렬 순서 (asc: 1위부터, desc: 마지막부터)
  
  // 배틀 데이터 상태
  const [battleData, setBattleData] = useState<any[]>([]);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState<string | null>(null);

  // 배틀 데이터 로딩 함수
  const loadBattleData = async () => {
    if (!userSchool?.school_code) return;
    
    setBattleLoading(true);
    setBattleError(null);
    
    try {
      const params = new URLSearchParams({
        schoolCode: userSchool.school_code,
        type: viewMode,
        ...(viewMode === 'daily' ? { date: selectedDate } : { month: selectedMonth })
      });
      
      const response = await fetch(`/api/battle/menu?${params}`);
      const result = await response.json();
      
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
    if (activeTab === 'menu' && userSchool?.school_code) {
      loadBattleData();
    }
  }, [activeTab, userSchool?.school_code, viewMode, selectedDate, selectedMonth]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* 학교 정보 헤더 */}
      {userSchool ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
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
                onClick={() => setViewMode('daily')}
                className={`text-sm font-medium mb-2 block transition-colors duration-200 ${
                  viewMode === 'daily' 
                    ? (activeTab === 'menu' ? 'text-red-600' : 'text-blue-600')
                    : (activeTab === 'menu' ? 'text-gray-500 hover:text-red-500' : 'text-gray-500 hover:text-blue-500')
                }`}
              >
                일별 집계
              </button>
              <div className={`transition-all duration-300 ${
                viewMode === 'daily' ? 'transform-none' : 'transform scale-95'
              }`}>
                <DateNavigator 
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
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
                onClick={() => setViewMode('monthly')}
                className={`text-sm font-medium mb-2 block transition-colors duration-200 ${
                  viewMode === 'monthly' 
                    ? (activeTab === 'menu' ? 'text-red-600' : 'text-blue-600')
                    : (activeTab === 'menu' ? 'text-gray-500 hover:text-red-500' : 'text-gray-500 hover:text-blue-500')
                }`}
              >
                월별 집계
              </button>
              <div className={`flex items-center gap-1 w-fit transition-all duration-300 ${
                viewMode === 'monthly' ? 'transform-none' : 'transform scale-95'
              }`}>
                <button
                  onClick={() => {
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
                
                <div className={`rounded-lg px-2 py-1.5 min-w-20 text-center border transition-all duration-200 text-xs ${
                  viewMode === 'monthly'
                    ? (activeTab === 'menu' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')
                    : 'bg-gray-50 border-gray-200'
                }`}>
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
              {/* 메뉴 배틀 헤더 */}
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-red-600 mb-2">메뉴 배틀</h2>
                <p className="text-red-500">선택한 {viewMode === 'daily' ? '날짜' : '월'}의 메뉴별 배틀 결과를 보여줍니다.</p>
                <p className="text-sm text-red-400 mt-2">
                  {viewMode === 'daily' 
                    ? `선택 날짜: ${new Date(selectedDate).toLocaleDateString('ko-KR')}`
                    : `선택 월: ${new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}`
                  }
                </p>
              </div>

              {/* 일간 베스트 메뉴 도표 */}
              <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                {/* 도표 제목 */}
                <div className="bg-red-500 text-white px-4 py-3">
                  <div className="flex items-center justify-center gap-3">
                    <h3 className="font-bold">
                      {viewMode === 'daily' ? '일간' : '월간'} 베스트 메뉴
                    </h3>
                    {/* 순위 정렬 버튼 */}
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="flex flex-col items-center justify-center w-6 h-6 hover:bg-red-400 rounded transition-colors duration-200"
                      title={sortOrder === 'asc' ? '내림차순으로 변경' : '오름차순으로 변경'}
                    >
                      <svg 
                        className={`w-3 h-3 transition-opacity duration-200 ${
                          sortOrder === 'asc' ? 'opacity-100' : 'opacity-40'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      <svg 
                        className={`w-3 h-3 -mt-1 transition-opacity duration-200 ${
                          sortOrder === 'desc' ? 'opacity-100' : 'opacity-40'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* 테이블 헤더 */}
                <div className="bg-red-50 border-b border-red-200">
                  <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm font-medium text-red-700">
                    <div className="text-center">순위</div>
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
                      <div key={item.menu_item_id} className="grid grid-cols-4 gap-4 px-4 py-4 hover:bg-red-25 transition-colors">
                        <div className="text-center font-medium text-red-600">
                          {sortOrder === 'asc' ? item.daily_rank || item.monthly_rank : battleData.length - index}
                        </div>
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
              {/* 급식 배틀 헤더 */}
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-blue-600 mb-2">급식 배틀</h2>
                <p className="text-blue-500">선택한 {viewMode === 'daily' ? '날짜' : '월'}의 급식별 배틀 결과를 보여줍니다.</p>
                <p className="text-sm text-blue-400 mt-2">
                  {viewMode === 'daily' 
                    ? `선택 날짜: ${new Date(selectedDate).toLocaleDateString('ko-KR')}`
                    : `선택 월: ${new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}`
                  }
                </p>
              </div>

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
                    {/* 순위 정렬 버튼 */}
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="flex flex-col items-center justify-center w-6 h-6 hover:bg-blue-400 rounded transition-colors duration-200"
                      title={sortOrder === 'asc' ? '내림차순으로 변경' : '오름차순으로 변경'}
                    >
                      <svg 
                        className={`w-3 h-3 transition-opacity duration-200 ${
                          sortOrder === 'asc' ? 'opacity-100' : 'opacity-40'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      <svg 
                        className={`w-3 h-3 -mt-1 transition-opacity duration-200 ${
                          sortOrder === 'desc' ? 'opacity-100' : 'opacity-40'
                        }`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
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
                
                {/* 테이블 내용 - 데이터 대기 */}
                <div className="p-8 text-center text-blue-400">
                  <p>데이터를 불러오는 중...</p>
                  <p className="text-sm mt-2">
                    선택된 지역: <span className="font-medium">{userSchool?.region || '로딩 중...'}</span>
                  </p>
                  <p className="text-sm mt-1">
                    선택된 유형: <span className="font-medium">{selectedSchoolType || userSchool?.school_type || '선택 안됨'}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
