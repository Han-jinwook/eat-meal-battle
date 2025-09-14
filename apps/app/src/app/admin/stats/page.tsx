'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserStats {
  totalUsers: number;
  weeklyNewUsers: number;
  monthlyNewUsers: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
}

interface SchoolStats {
  totalSchools: number;
  schoolsWithUsers: number;
  averageUsersPerSchool: number;
}

interface ActivityStats {
  totalRatings: number;
  dailyRatings: number;
  weeklyRatings: number;
  monthlyRatings: number;
  totalImages: number;
  dailyImages: number;
  weeklyImages: number;
  monthlyImages: number;
}

interface SchoolGradeStats {
  schoolCode: string;
  schoolName: string;
  totalStudents: number;
  gradeBreakdown: Record<string, number>;
}


export default function AdminStatsPage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [schoolStats, setSchoolStats] = useState<SchoolStats | null>(null);
  const [schoolGradeStats, setSchoolGradeStats] = useState<SchoolGradeStats[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/stats');
      
      if (!response.ok) {
        throw new Error('통계 데이터를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      setUserStats(data.userStats);
      setSchoolStats(data.schoolStats);
      setSchoolGradeStats(data.schoolGradeStats || []);
      setActivityStats(data.activityStats);
      
    } catch (err) {
      console.error('통계 데이터 로딩 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const StatCard = ({ title, value, subtitle, color = 'blue' }: {
    title: string;
    value: number | string;
    subtitle?: string;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800',
      red: 'bg-red-50 border-red-200 text-red-800',
    };

    return (
      <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
        <h3 className="text-sm font-medium opacity-75 mb-2">{title}</h3>
        <div className="text-3xl font-bold mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <p className="text-sm opacity-75">{subtitle}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                ← 관리자 페이지로 돌아가기
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">통계 대시보드</h1>
          </div>
          
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">통계 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                ← 관리자 페이지로 돌아가기
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">통계 대시보드</h1>
          </div>
          
          <div className="text-center py-12">
            <div className="text-red-600 text-xl mb-4">⚠️ 오류 발생</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
              ← 관리자 페이지로 돌아가기
            </Link>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
            >
              새로고침
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">통계 대시보드</h1>
          <p className="text-gray-600 mt-2">
            마지막 업데이트: {new Date().toLocaleString()}
          </p>
        </div>

        {/* 사용자 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">👥 사용자 통계</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="총 회원수"
              value={userStats?.totalUsers || 0}
              color="blue"
            />
            <StatCard
              title="주간 신규 가입자"
              value={userStats?.weeklyNewUsers || 0}
              subtitle="최근 7일"
              color="green"
            />
            <StatCard
              title="월간 신규 가입자"
              value={userStats?.monthlyNewUsers || 0}
              subtitle="최근 30일"
              color="green"
            />
            <StatCard
              title="일간 활성 사용자"
              value={userStats?.dailyActiveUsers || 0}
              subtitle="오늘"
              color="purple"
            />
            <StatCard
              title="주간 활성 사용자"
              value={userStats?.weeklyActiveUsers || 0}
              subtitle="최근 7일"
              color="purple"
            />
            <StatCard
              title="월간 활성 사용자"
              value={userStats?.monthlyActiveUsers || 0}
              subtitle="최근 30일"
              color="purple"
            />
          </div>
        </div>

        {/* 학교 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">🏫 학교 통계</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="총 등록 학교수"
              value={schoolStats?.totalSchools || 0}
              color="orange"
            />
            <StatCard
              title="사용자가 있는 학교"
              value={schoolStats?.schoolsWithUsers || 0}
              color="orange"
            />
            <StatCard
              title="학교당 평균 사용자"
              value={schoolStats?.averageUsersPerSchool?.toFixed(1) || '0.0'}
              color="orange"
            />
          </div>
        </div>

        {/* 학교별/학년별 학생수 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📚 학교별/학년별 학생수</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            {schoolGradeStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        학교명
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        총 학생수
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        학년별 분포
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schoolGradeStats.map((school, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {school.schoolName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {school.schoolCode}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {school.totalStudents}명
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(school.gradeBreakdown).map(([grade, count]) => (
                              <span
                                key={grade}
                                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                              >
                                {grade}학년: {count}명
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">
                학교별/학년별 데이터가 없습니다.
              </p>
            )}
          </div>
        </div>

        {/* 활동 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 활동 통계</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="총 평점 수"
              value={activityStats?.totalRatings || 0}
              color="green"
            />
            <StatCard
              title="일간 평점"
              value={activityStats?.dailyRatings || 0}
              subtitle="오늘"
              color="green"
            />
            <StatCard
              title="주간 평점"
              value={activityStats?.weeklyRatings || 0}
              subtitle="최근 7일"
              color="green"
            />
            <StatCard
              title="월간 평점"
              value={activityStats?.monthlyRatings || 0}
              subtitle="최근 30일"
              color="green"
            />
            <StatCard
              title="총 업로드 이미지"
              value={activityStats?.totalImages || 0}
              color="blue"
            />
            <StatCard
              title="일간 이미지"
              value={activityStats?.dailyImages || 0}
              subtitle="오늘"
              color="blue"
            />
            <StatCard
              title="주간 이미지"
              value={activityStats?.weeklyImages || 0}
              subtitle="최근 7일"
              color="blue"
            />
            <StatCard
              title="월간 이미지"
              value={activityStats?.monthlyImages || 0}
              subtitle="최근 30일"
              color="blue"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
