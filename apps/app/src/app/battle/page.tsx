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
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-all duration-200 ${
              activeTab === 'menu'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-red-50'
            }`}
          >
            메뉴 배틀
          </button>
          <button
            onClick={() => setActiveTab('meal')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-all duration-200 ${
              activeTab === 'meal'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-red-50'
            }`}
          >
            급식 배틀
          </button>
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
              onClick={() => setViewMode('daily')}
              className={`text-sm font-medium mb-2 block transition-colors duration-200 ${
                viewMode === 'daily' ? 'text-red-600' : 'text-gray-500 hover:text-red-500'
              }`}
            >
              📅 일별 집계
            </button>
            <div className={`transition-all duration-300 ${
              viewMode === 'daily' ? 'transform-none' : 'transform scale-95'
            }`}>
              <DateNavigator 
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                theme="red"
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
                viewMode === 'monthly' ? 'text-red-600' : 'text-gray-500 hover:text-red-500'
              }`}
            >
              📊 월별 집계
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
                    ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className={`rounded-lg px-2 py-1.5 min-w-20 text-center border transition-all duration-200 text-xs ${
                viewMode === 'monthly'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <span className={`font-medium transition-colors duration-200 ${
                  viewMode === 'monthly' ? 'text-red-700' : 'text-gray-500'
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
                    ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
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
      <div className={`rounded-lg p-6 min-h-96 ${
        activeTab === 'menu' 
          ? 'bg-gradient-to-br from-red-50 to-pink-50 border border-red-200' 
          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200'
      }`}>
        {activeTab === 'menu' ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold text-red-600 mb-2">메뉴 배틀</h2>
            <p className="text-red-500">선택한 {viewMode === 'daily' ? '날짜' : '월'}의 메뉴별 배틀 결과를 보여줍니다.</p>
            <p className="text-sm text-red-400 mt-2">
              {viewMode === 'daily' 
                ? `선택 날짜: ${new Date(selectedDate).toLocaleDateString('ko-KR')}`
                : `선택 월: ${new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}`
              }
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold text-blue-600 mb-2">급식 배틀</h2>
            <p className="text-blue-500">선택한 {viewMode === 'daily' ? '날짜' : '월'}의 급식별 배틀 결과를 보여줍니다.</p>
            <p className="text-sm text-blue-400 mt-2">
              {viewMode === 'daily' 
                ? `선택 날짜: ${new Date(selectedDate).toLocaleDateString('ko-KR')}`
                : `선택 월: ${new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
