'use client';

import { useState, useMemo, useCallback, createContext, useContext } from 'react';

// 사용자 모드 타입 정의
export type UserMode = 'student' | 'visitor';

// 권한 타입 정의
export interface Permissions {
  canComment: boolean;
  canRate: boolean;
  canLike: boolean;
  canUploadPhoto: boolean;
  canUseAI: boolean;
  canParticipateInBattle: boolean;
  canViewMeals: boolean;
}

// 관심학교 정보 타입
export interface InterestSchoolInfo {
  id: string;
  school_name: string;
  school_code: string;
  office_code?: string; // 교육청 코드만 추가
  created_at: string;
}

// 훅 반환 타입
export interface UseSchoolModeReturn {
  // 현재 모드 상태
  currentMode: UserMode;
  selectedInterestSchool: InterestSchoolInfo | null;
  selectedSchool: InterestSchoolInfo | null; // 배틀 페이지 호환성을 위한 별칭
  
  // 사용자 학교 정보
  hasMySchool: boolean;
  isStudentMode: boolean;
  isVisitorMode: boolean;
  
  // 권한 정보
  permissions: Permissions;
  
  // 현재 표시할 학교 정보
  currentSchoolInfo: {
    school_name: string;
    school_code: string;
    isMySchool: boolean;
  } | null;
  
  // 모드 변경 함수들
  selectInterestSchool: (school: InterestSchoolInfo) => void;
  returnToMySchool: () => void;
  
  // 유틸리티 함수들
  getDisplaySchoolName: () => string;
  canPerformAction: (action: keyof Permissions) => boolean;
}

// 전역 상태 관리를 위한 Context
interface SchoolModeContextType {
  selectedInterestSchool: InterestSchoolInfo | null;
  setSelectedInterestSchool: (school: InterestSchoolInfo | null) => void;
}

const SchoolModeContext = createContext<SchoolModeContextType | null>(null);

// Context Provider 컴포넌트
export function SchoolModeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [selectedInterestSchool, setSelectedInterestSchool] = useState<InterestSchoolInfo | null>(null);
  
  return (
    <SchoolModeContext.Provider value={{ selectedInterestSchool, setSelectedInterestSchool }}>
      {children}
    </SchoolModeContext.Provider>
  );
}

/**
 * 학교 모드 관리 훅
 * - student 모드: 사용자의 본인 학교, 모든 권한 허용
 * - visitor 모드: 관심학교 선택 또는 학교 미설정, 읽기 전용
 */
export function useSchoolMode(userSchool: any): UseSchoolModeReturn {
  // Context에서 전역 상태 가져오기
  const context = useContext(SchoolModeContext);
  if (!context) {
    throw new Error('useSchoolMode must be used within SchoolModeProvider');
  }
  const { selectedInterestSchool, setSelectedInterestSchool } = context;
  
  // 사용자 학교 존재 여부
  const hasMySchool = useMemo(() => {
    // school_code가 있으면 학교 정보가 있다고 판단 (school_name은 optional)
    const hasSchool = !!(userSchool?.school_code);
    return hasSchool;
  }, [userSchool]);
  
  // 현재 모드 계산
  const currentMode: UserMode = useMemo(() => {
    // 관심학교가 선택된 경우 visitor 모드
    if (selectedInterestSchool) {
      return 'visitor';
    }
    
    // 사용자 학교가 있으면 student 모드, 없으면 visitor 모드
    return hasMySchool ? 'student' : 'visitor';
  }, [selectedInterestSchool, hasMySchool]);
  
  // 모드별 상태
  const isStudentMode = currentMode === 'student';
  const isVisitorMode = currentMode === 'visitor';
  
  // 권한 계산
  const permissions: Permissions = useMemo(() => {
    // 학생 모드: 내 학교에서 모든 권한 허용
    const hasFullPermissions = !selectedInterestSchool && hasMySchool;
    
    // 비학생 또는 관심학교 모드: 관심학교가 설정되어 있으면 읽기 권한 허용
    const hasReadPermissions = !!(selectedInterestSchool || hasMySchool);
    
    const calculatedPermissions = {
      canComment: hasFullPermissions,
      canRate: hasFullPermissions,
      canLike: hasFullPermissions,
      canUploadPhoto: hasFullPermissions,
      canUseAI: hasFullPermissions,
      canParticipateInBattle: hasFullPermissions,
      canViewMeals: hasReadPermissions, // 급식 조회 권한 추가
    };

    return calculatedPermissions;
  }, [selectedInterestSchool, hasMySchool, currentMode]);
  
  // 현재 표시할 학교 정보
  const currentSchoolInfo = useMemo(() => {
    if (selectedInterestSchool) {
      return {
        school_name: selectedInterestSchool.school_name,
        school_code: selectedInterestSchool.school_code,
        isMySchool: false,
      };
    }
    
    if (hasMySchool) {
      return {
        school_name: userSchool.school_name,
        school_code: userSchool.school_code,
        isMySchool: true,
      };
    }
    
    return null;
  }, [selectedInterestSchool, hasMySchool, userSchool]);
  
  // 관심학교 선택 함수
  const selectInterestSchool = useCallback((school: InterestSchoolInfo) => {
    setSelectedInterestSchool(school);
  }, []);
  
  // 내 학교로 돌아가기 함수
  const returnToMySchool = useCallback(() => {
    setSelectedInterestSchool(null);
  }, []);
  
  // 표시할 학교명 반환
  const getDisplaySchoolName = useCallback(() => {
    if (selectedInterestSchool) {
      return selectedInterestSchool.school_name;
    }
    
    if (hasMySchool) {
      return userSchool.school_name;
    }
    
    return '학교 정보 없음';
  }, [selectedInterestSchool, hasMySchool, userSchool]);
  
  // 특정 액션 수행 가능 여부 확인
  const canPerformAction = useCallback((action: keyof Permissions) => {
    return permissions[action];
  }, [permissions]);
  
  return {
    // 현재 모드 상태
    currentMode,
    selectedInterestSchool,
    selectedSchool: selectedInterestSchool, // 배틀 페이지 호환성을 위한 별칭
    
    // 사용자 학교 정보
    hasMySchool,
    isStudentMode,
    isVisitorMode,
    
    // 권한 정보
    permissions,
    
    // 현재 학교 정보
    currentSchoolInfo,
    
    // 모드 변경 함수들
    selectInterestSchool,
    returnToMySchool,
    
    // 유틸리티 함수들
    getDisplaySchoolName,
    canPerformAction,
  };
}
