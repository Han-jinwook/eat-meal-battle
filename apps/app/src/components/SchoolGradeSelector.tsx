'use client';

import React from 'react';

interface SchoolGradeSelectorProps {
  schoolName: string;
  grade: number;
  schoolType: '초등학교' | '중학교' | '고등학교';
  onGradeChange: (grade: number) => void;
  onSchoolChange: (direction: 'prev' | 'next') => void;
}

const SchoolGradeSelector: React.FC<SchoolGradeSelectorProps> = ({
  schoolName,
  grade,
  schoolType,
  onGradeChange,
  onSchoolChange
}) => {
  // 학교명에서 '등학교' 제거하여 모바일 최적화
  const getShortSchoolName = (name: string) => {
    return name.replace(/등학교$/, '');
  };
  const getMaxGrade = () => {
    switch (schoolType) {
      case '초등학교': return 6;
      case '중학교': return 3;
      case '고등학교': return 3;
      default: return 6;
    }
  };

  const handleGradeUp = () => {
    const maxGrade = getMaxGrade();
    if (grade < maxGrade) {
      onGradeChange(grade + 1);
    }
  };

  const handleGradeDown = () => {
    if (grade > 1) {
      onGradeChange(grade - 1);
    }
  };

  const maxGrade = getMaxGrade();

  return (
    <div className="flex items-center justify-between sm:justify-center bg-white border border-blue-200 rounded-lg px-2 py-2 shadow-sm sm:px-4">
      {/* 왼쪽 화살표 - 이전 학교 */}
      <button
        onClick={() => onSchoolChange('prev')}
        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors"
        title="이전 학교"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 중앙 학교명/학년 영역 */}
      <div className="flex items-center mx-1 sm:mx-2 min-w-[120px] sm:min-w-[200px] flex-1 sm:flex-none">
        {/* 학년 감소 버튼 */}
        <button
          onClick={handleGradeDown}
          disabled={grade <= 1}
          className={`text-xs transition-colors mr-2 ${
            grade <= 1 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
          } rounded px-1`}
          title="학년 내리기"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 학교명과 학년을 한 줄로 */}
        <div className="flex items-center justify-center flex-1 text-center">
          <div className="text-sm font-medium text-gray-800 truncate max-w-[80px] sm:max-w-[120px]" title={schoolName}>
            {getShortSchoolName(schoolName)}
          </div>
          <div className="text-lg font-bold text-blue-600 ml-2">
            {grade}학년
          </div>
        </div>

        {/* 학년 증가 버튼 */}
        <button
          onClick={handleGradeUp}
          disabled={grade >= maxGrade}
          className={`text-xs transition-colors ml-2 ${
            grade >= maxGrade 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
          } rounded px-1`}
          title="학년 올리기"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 오른쪽 화살표 - 다음 학교 */}
      <button
        onClick={() => onSchoolChange('next')}
        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors"
        title="다음 학교"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

export default SchoolGradeSelector;
