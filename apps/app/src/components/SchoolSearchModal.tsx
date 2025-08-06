'use client';

import { useState } from 'react';

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

interface SchoolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSchool: (school: School) => void;
}

export default function SchoolSearchModal({ isOpen, onClose, onSelectSchool }: SchoolSearchModalProps) {
  const [keyword, setKeyword] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    onSelectSchool(school);
    // 모달 닫기 및 상태 초기화
    setKeyword('');
    setSchools([]);
    setError('');
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchSchools();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">학교 검색</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="학교명을 입력하세요"
              className="flex-1 p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              onClick={searchSchools}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
          
          {error && (
            <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        {schools.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              검색 결과 ({schools.length}개)
            </h3>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {schools.map((school) => (
                <li
                  key={school.SD_SCHUL_CODE}
                  className="p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
                  onClick={() => selectSchool(school)}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{school.SCHUL_NM}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {school.LCTN_SC_NM} | {school.SCHUL_KND_SC_NM}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{school.ORG_RDNMA}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>• 학교명을 입력하고 검색 버튼을 클릭하세요</p>
          <p>• 검색 결과에서 원하는 학교를 클릭하면 관심학교로 등록됩니다</p>
          <p>• 최대 3개의 관심학교를 등록할 수 있습니다</p>
        </div>
      </div>
    </div>
  );
}
