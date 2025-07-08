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

      {/* 네비게이션 컨트롤들 */}
      <div className="mb-6 space-y-4">
        {/* 날짜 선택 - DateNavigator (붉은 계통) */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">일별 집계</h3>
          <DateNavigator 
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            theme="red"
            size="md"
          />
        </div>

        {/* 월 이동 네비게이터 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">월별 집계</h3>
          <div className="flex items-center gap-2 w-fit">
            <button
              onClick={() => {
                const current = new Date(selectedMonth + '-01');
                current.setMonth(current.getMonth() - 1);
                setSelectedMonth(current.toISOString().slice(0, 7));
              }}
              className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 min-w-32 text-center">
              <span className="text-red-700 font-medium">
                {new Date(selectedMonth + '-01').toLocaleDateString('ko-KR', { 
                  year: 'numeric', 
                  month: 'long' 
                })}
              </span>
            </div>
            
            <button
              onClick={() => {
                const current = new Date(selectedMonth + '-01');
                current.setMonth(current.getMonth() + 1);
                setSelectedMonth(current.toISOString().slice(0, 7));
              }}
              className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
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
            <p className="text-red-500">선택한 날짜의 메뉴별 배틀 결과를 보여줍니다.</p>
            <p className="text-sm text-red-400 mt-2">
              선택 날짜: {new Date(selectedDate).toLocaleDateString('ko-KR')}
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold text-blue-600 mb-2">급식 배틀</h2>
            <p className="text-blue-500">선택한 날짜의 급식별 배틀 결과를 보여줍니다.</p>
            <p className="text-sm text-blue-400 mt-2">
              선택 날짜: {new Date(selectedDate).toLocaleDateString('ko-KR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
