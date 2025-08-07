'use client';

import { useState, useCallback, useMemo } from 'react';

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

/**
 * 학교 모드 관리 훅
 * - student 모드: 사용자의 본인 학교, 모든 권한 허용
 * - visitor 모드: 관심학교 선택 또는 학교 미설정, 읽기 전용
 */
export function useSchoolMode(userSchool: any): UseSchoolModeReturn {
  // 선택된 관심학교 상태 (메모리 기반)
  const [selectedInterestSchool, setSelectedInterestSchool] = useState<InterestSchoolInfo | null>(null);
  
  // 사용자 학교 존재 여부
  const hasMySchool = useMemo(() => {
    return !!(userSchool?.school_code && userSchool?.school_name);
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
  
  // 권한 계산 (student 모드에서만 모든 권한 허용)
  const permissions: Permissions = useMemo(() => {
    // 명확한 권한 계산: 관심학교가 선택되지 않고, 내 학교가 있을 때만 권한 허용
    const hasFullPermissions = !selectedInterestSchool && hasMySchool;
    
    console.log('🔐 권한 계산:', {
      currentMode,
      isStudentMode,
      isVisitorMode,
      hasMySchool,
      selectedInterestSchool: selectedInterestSchool?.school_name,
      hasFullPermissions,
      '계산근거': `!selectedInterestSchool(${!selectedInterestSchool}) && hasMySchool(${hasMySchool})`
    });
    
    const calculatedPermissions = {
      canComment: hasFullPermissions,
      canRate: hasFullPermissions,
      canLike: hasFullPermissions,
      canUploadPhoto: hasFullPermissions,
      canUseAI: hasFullPermissions,
      canParticipateInBattle: hasFullPermissions,
    };
    
    console.log('📋 최종 권한 결과:', calculatedPermissions);
    
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
    console.log('관심학교 선택:', school.school_name);
    setSelectedInterestSchool(school);
  }, []);
  
  // 내 학교로 돌아가기 함수
  const returnToMySchool = useCallback(() => {
    console.log('내 학교로 복귀');
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
