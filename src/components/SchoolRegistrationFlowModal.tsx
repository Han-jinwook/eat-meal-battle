'use client';

import { useMemo, useState } from 'react';

interface School {
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  LCTN_SC_NM: string;
  SCHUL_KND_SC_NM: string;
  ORG_RDNMA: string;
  ATPT_OFCDC_SC_CODE: string;
  ORG_RDNDA?: string;
}

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar: string;
}

interface RegistrationPayload {
  school: School;
  grade: string;
  classNumber: string;
  ownerType: 'self' | 'family';
  ownerUserId: string;
  ownerName: string;
}

interface SchoolRegistrationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyMembers: FamilyMember[];
  currentUserId: string;
  onComplete: (payload: RegistrationPayload) => Promise<void> | void;
  allowFamilyRegistration?: boolean;
}

export default function SchoolRegistrationFlowModal({
  isOpen,
  onClose,
  familyMembers,
  currentUserId,
  onComplete,
  allowFamilyRegistration = true,
}: SchoolRegistrationFlowModalProps) {
  const [keyword, setKeyword] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [grade, setGrade] = useState('');
  const [classNumber, setClassNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [step, setStep] = useState<'search' | 'owner'>('search');
  const [ownerType, setOwnerType] = useState<'self' | 'family' | null>(null);
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState('');

  const me = useMemo(
    () => familyMembers.find((member) => member.id === currentUserId),
    [familyMembers, currentUserId],
  );

  const familyOnlyMembers = useMemo(
    () => familyMembers.filter((member) => member.id !== currentUserId),
    [familyMembers, currentUserId],
  );

  const resetState = () => {
    setKeyword('');
    setSchools([]);
    setSelectedSchool(null);
    setGrade('');
    setClassNumber('');
    setError('');
    setIsLoading(false);
    setIsSaving(false);
    setStep('search');
    setOwnerType(null);
    setSelectedFamilyMemberId('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const getGradeOptions = () => {
    if (!selectedSchool) return [1, 2, 3];

    const schoolType = selectedSchool.SCHUL_KND_SC_NM;
    if (schoolType === '초등학교') {
      return [1, 2, 3, 4, 5, 6];
    }
    if (schoolType === '중학교') {
      return [1, 2, 3];
    }
    if (schoolType.includes('고등학교') || schoolType === '특성화고등학교' || schoolType === '외국인학교') {
      return [1, 2, 3];
    }

    return [1, 2, 3];
  };

  const searchSchools = async () => {
    if (!keyword.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      let apiUrl = `${baseUrl}/api/schools?keyword=${encodeURIComponent(keyword)}`;

      if (baseUrl.includes('lunbat.com') || baseUrl.includes('whateat.sundreamer.app') || baseUrl.includes('netlify')) {
        apiUrl = `${baseUrl}/.netlify/functions/schools?keyword=${encodeURIComponent(keyword)}`;
      }

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('학교 검색에 실패했습니다');
      }

      const data = await response.json();
      setSchools(data.schools || []);
    } catch (_error) {
      setError('학교 검색 중 오류가 발생했습니다');
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSchool = (school: School) => {
    setSelectedSchool(school);
    setSchools([]);
    setKeyword('');
    setError('');
  };

  const goToOwnerStep = () => {
    if (!selectedSchool) {
      setError('학교를 선택해주세요');
      return;
    }
    if (!grade) {
      setError('학년을 선택해주세요');
      return;
    }
    if (!classNumber) {
      setError('반을 선택해주세요');
      return;
    }

    setError('');
    if (!allowFamilyRegistration) {
      setOwnerType('self');
      void submitRegistration('self');
      return;
    }
    setStep('owner');
  };

  const submitRegistration = async (forcedOwnerType?: 'self' | 'family') => {
    if (!selectedSchool) {
      setError('학교를 선택해주세요');
      return;
    }
    const registrationOwnerType = forcedOwnerType || ownerType;

    if (!registrationOwnerType) {
      setError('저장 대상을 선택해주세요');
      return;
    }

    let ownerUserId = currentUserId;
    let ownerName = me?.name || '내 프로필';

    if (registrationOwnerType === 'family') {
      const target = familyOnlyMembers.find((member) => member.id === selectedFamilyMemberId);
      if (!target) {
        setError('가족 멤버를 선택해주세요');
        return;
      }
      ownerUserId = target.id;
      ownerName = target.name;
    }

    setError('');
    setIsSaving(true);

    try {
      await onComplete({
        school: selectedSchool,
        grade,
        classNumber,
        ownerType: registrationOwnerType,
        ownerUserId,
        ownerName,
      });
      handleClose();
    } catch (_error) {
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'search' ? '학교 검색 및 학년/반 선택' : '이 학교를 누구의 프로필에 저장할까요?'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {step === 'search' && (
          <>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchSchools();
                  }
                }}
                placeholder="학교명을 입력하세요"
                className="flex-1 rounded border border-gray-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={searchSchools}
                disabled={isLoading}
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isLoading ? '검색 중...' : '검색'}
              </button>
            </div>

            {schools.length > 0 && (
              <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded border border-gray-200 p-2">
                {schools.map((school) => (
                  <button
                    type="button"
                    key={school.SD_SCHUL_CODE}
                    onClick={() => selectSchool(school)}
                    className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                      selectedSchool?.SD_SCHUL_CODE === school.SD_SCHUL_CODE
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{school.SCHUL_NM}</div>
                    <div className="text-sm text-gray-600">
                      {school.LCTN_SC_NM} | {school.SCHUL_KND_SC_NM}
                    </div>
                    <div className="text-xs text-gray-500">{school.ORG_RDNMA}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedSchool && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-3 text-sm font-semibold text-gray-900">선택한 학교: {selectedSchool.SCHUL_NM}</div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">학년 선택</option>
                    {getGradeOptions().map((gradeNumber) => (
                      <option key={gradeNumber} value={gradeNumber}>
                        {gradeNumber}학년
                      </option>
                    ))}
                  </select>
                  <select
                    value={classNumber}
                    onChange={(e) => setClassNumber(e.target.value)}
                    className="rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">반 선택</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((number) => (
                      <option key={number} value={number}>
                        {number}반
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={goToOwnerStep}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                다음
              </button>
            </div>
          </>
        )}

        {step === 'owner' && allowFamilyRegistration && (
          <>
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {selectedSchool?.SCHUL_NM} · {grade}학년 {classNumber}반
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOwnerType('self')}
                className={`rounded-lg border px-3 py-3 text-left ${
                  ownerType === 'self' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-gray-900">내 학교로 등록</div>
                <div className="text-xs text-gray-600">현재 로그인한 내 프로필에 저장</div>
              </button>

              <button
                type="button"
                onClick={() => setOwnerType('family')}
                className={`rounded-lg border px-3 py-3 text-left ${
                  ownerType === 'family' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-gray-900">가족 연결 (대리 등록)</div>
                <div className="text-xs text-gray-600">가족 멤버를 선택해서 해당 프로필에 저장</div>
              </button>
            </div>

            {ownerType === 'family' && (
              <div className="mb-4 space-y-2 rounded-lg border border-gray-200 p-3">
                {familyOnlyMembers.length === 0 ? (
                  <div className="text-sm text-gray-600">연결된 가족 멤버가 없습니다.</div>
                ) : (
                  familyOnlyMembers.map((member) => {
                    const isSelected = selectedFamilyMemberId === member.id;
                    return (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => setSelectedFamilyMemberId(member.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                          isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700">
                          {member.avatar}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.relation}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('search')}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitRegistration();
                }}
                disabled={isSaving}
                className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSaving ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
