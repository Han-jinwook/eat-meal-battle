'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import useUserSchool from '@/hooks/useUserSchool';

interface InterestSchool {
  id: string;
  school_name: string;
  school_code: string;
  office_code: string;
  user_id: string;
  created_at: string;
}

function InterestSchoolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user, userSchool, loading: userLoading } = useUserSchool();
  
  const [interestSchools, setInterestSchools] = useState<InterestSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // URL 파라미터에서 공유 정보 추출
  const shareSchoolCode = searchParams.get('share_school_code');
  const shareType = searchParams.get('share_type');
  const isBattleShare = shareType === 'battle';
  
  // 사용자 인증 확인
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
      return;
    }
  }, [user, userLoading, router]);

  // 관심학교 목록 조회
  const fetchInterestSchools = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('interest_schools')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('관심학교 조회 오류:', error);
        setError('관심학교 목록을 불러오는데 실패했습니다.');
        return;
      }

      setInterestSchools(data || []);
    } catch (err) {
      console.error('관심학교 조회 예외:', err);
      setError('관심학교 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 관심학교 삭제
  const removeInterestSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`${schoolName}을(를) 관심학교에서 제거하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/interest-schools?id=${schoolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert(`${schoolName}이(가) 관심학교에서 제거되었습니다.`);
        await fetchInterestSchools(); // 목록 새로고침
      } else {
        throw new Error('관심학교 제거에 실패했습니다.');
      }
    } catch (err) {
      console.error('관심학교 제거 오류:', err);
      alert('관심학교 제거에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (user) {
      fetchInterestSchools();
    }
  }, [user]);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 리다이렉트 처리됨
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">관심학교 관리</h1>
                <p className="text-gray-600">
                  관심있는 학교들을 등록하고 관리해보세요!
                </p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                홈으로
              </button>
            </div>
          </div>

          {/* 관심학교 목록 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                내 관심학교 목록 ({interestSchools.length}개)
              </h2>
              <button
                onClick={() => router.push('/school-search')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                + 관심학교 추가
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {interestSchools.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">관심학교가 없습니다</h3>
                <p className="text-gray-600 mb-4">
                  {shareSchoolCode 
                    ? `공유받은 학교를 관심학교로 추가해보세요!`
                    : '관심있는 학교를 추가해보세요!'
                  }
                </p>
                <button
                  onClick={() => router.push('/school-search')}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {shareSchoolCode ? '공유받은 학교 등록하기' : '첫 번째 관심학교 추가하기'}
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {interestSchools.map((school) => (
                  <div key={school.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{school.school_name}</h3>
                        <p className="text-sm text-gray-600">학교코드: {school.school_code}</p>
                        <p className="text-sm text-gray-500">
                          등록일: {new Date(school.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/?school_code=${school.school_code}`)}
                          className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm"
                        >
                          급식보기
                        </button>
                        <button
                          onClick={() => router.push(`/battle?school_code=${school.school_code}`)}
                          className="px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-sm"
                        >
                          배틀보기
                        </button>
                        <button
                          onClick={() => removeInterestSchool(school.id, school.school_name)}
                          className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
                        >
                          제거
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterestSchoolsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <InterestSchoolsContent />
    </Suspense>
  );
}
