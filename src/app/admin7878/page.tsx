'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReportData {
  id: string;
  image_id: string;
  reporter_id: string;
  school_code: string;
  meal_date: string;
  meal_type: string;
  image_url: string;
  uploader_nickname: string;
  report_reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  admin_notes: string;
  created_at: string;
  reviewed_at: string;
  reviewed_by: string;
  school_name: string;
  menu_items: string;
}

interface SeedSchool {
  id: number;
  school_name: string;
  school_code: string;
  region: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false); // 데이터 생성 로딩 상태
  const [seedSchools, setSeedSchools] = useState<SeedSchool[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'resolved' | 'dismissed'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [studentUsers, setStudentUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [impersonating, setImpersonating] = useState(false);
  const [dailyLimits, setDailyLimits] = useState({
    'seed-lunch-activity': false,
    'seed-quiz-activity': false
  });

  const fetchStudentUsers = async () => {
    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();

      // 이메일에 'student'가 포함된 사용자 직접 조회
      const { data: users, error } = await supabase
        .from('users')
        .select('id, nickname, email')
        .ilike('email', '%student%')
        .order('email', { ascending: true });

      if (error) {
        throw new Error(error.message || '학생 목록을 가져오는데 실패했습니다.');
      }
      
      setStudentUsers(users || []);
    } catch (error) {
      console.error('학생 계정 목록 로딩 오류:', error);
      showToast(error instanceof Error ? error.message : '학생 계정 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  const handleImpersonate = async () => {
    if (!selectedUser) {
      showToast('로그인할 학생 계정을 선택해주세요.', 'error');
      return;
    }
    setImpersonating(true);
    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();

      // staff-login.js에 userId만 전달 (인증 없이)
      const response = await fetch('/.netlify/functions/staff-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '로그인에 실패했습니다.');
      }

      // 서버에서 받은 토큰으로 세션 설정
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });

      if (sessionError) throw sessionError;

      showToast(`${studentUsers.find(u => u.id === selectedUser)?.nickname} 계정으로 로그인되었습니다.`, 'success');
      
      // 1초 후 메인 페이지로 리디렉션
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (error) {
      console.error('계정 전환 오류:', error);
      showToast(error instanceof Error ? error.message : '계정 전환 중 오류가 발생했습니다.', 'error');
    } finally {
      setImpersonating(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // 3초 후 자동 사라짐
  };

  // 하루 1회 제한 체크
  const checkDailyLimit = (endpoint: string) => {
    const today = new Date().toDateString();
    const lastExecuted = localStorage.getItem(`${endpoint}-last-executed`);
    return lastExecuted === today;
  };

  // 하루 1회 제한 설정
  const setDailyLimit = (endpoint: string) => {
    const today = new Date().toDateString();
    localStorage.setItem(`${endpoint}-last-executed`, today);
    setDailyLimits(prev => ({ ...prev, [endpoint]: true }));
  };

  const handleSeed = async (endpoint: string) => {
    if (seeding) return;
    setSeeding(true);

    try {
      const response = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || '작업을 성공적으로 완료했습니다.', 'success');
        
        // 성공 시 하루 1회 제한 설정
        setDailyLimit(endpoint);
      } else {
        showToast(data.error || '작업 중 오류가 발생했습니다.', 'error');
      }
    } catch (error) {
      console.error(`${endpoint} 작업 오류:`, error);
      showToast('서버와 통신 중 오류가 발생했습니다.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const fetchSeedSchools = async () => {
    setSchoolsLoading(true);
    try {
      const response = await fetch('/api/admin/seed-schools');
      const data = await response.json();
      
      if (data.schools) {
        setSeedSchools(data.schools);
      }
    } catch (error) {
      console.error('거점 학교 데이터 로딩 오류:', error);
      showToast('거점 학교 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setSchoolsLoading(false);
    }
  };

  const toggleSchoolActive = async (schoolId: number, isActive: boolean) => {
    try {
      const response = await fetch('/api/admin/seed-schools', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: schoolId,
          is_active: !isActive
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message, 'success');
        fetchSeedSchools(); // 목록 새로고침
      } else {
        showToast(data.error || '상태 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('학교 상태 변경 오류:', error);
      showToast('서버와 통신 중 오류가 발생했습니다.', 'error');
    }
  };

  const cleanupOldReports = async () => {
    try {
      const response = await fetch('/api/admin/cleanup-old-reports', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`${data.deletedCount}개의 처리완료 신고가 정리되었습니다.`, 'success');
        fetchReports(); // 데이터 새로고침
      } else {
        showToast('신고 정리에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('신고 정리 오류:', error);
      showToast('신고 정리 중 오류가 발생했습니다.', 'error');
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/meal-image-reports?status=${filter}`);
      const data = await response.json();
      
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('신고 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string, adminNotes?: string) => {
    try {
      const response = await fetch('/api/admin/update-report-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          status,
          adminNotes
        })
      });

      if (response.ok) {
        fetchReports(); // 데이터 새로고침
      }
    } catch (error) {
      console.error('신고 상태 업데이트 오류:', error);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      // 해당 신고의 이미지 ID를 찾아서 meal_images에서 삭제
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      console.log('삭제 요청 데이터:', { 
        imageId: report.image_id,
        reportId: reportId,
        report: report
      });

      // image_id가 null인 경우 처리
      if (!report.image_id) {
        console.log('image_id가 null입니다. 이미 삭제된 이미지일 수 있습니다.');
        showToast('이미 삭제된 이미지입니다.', 'error');
        // 신고 상태만 해결됨으로 변경
        await updateReportStatus(reportId, 'resolved', '이미 삭제된 이미지');
        return;
      }

      const response = await fetch('/api/admin/delete-meal-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imageId: report.image_id,
          reportId: reportId
        })
      });

      if (response.ok) {
        // 토스트 메시지 표시
        showToast('급식 이미지가 성공적으로 삭제되었습니다.', 'success');
        
        // 신고 상태를 "해결됨"으로 변경
        await updateReportStatus(reportId, 'resolved', '부적절한 이미지로 판단되어 삭제 처리됨');
      } else {
        const errorData = await response.json();
        console.error('삭제 API 응답 오류:', errorData);
        showToast('이미지 삭제에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('이미지 삭제 오류:', error);
      showToast('이미지 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  useEffect(() => {
    fetchReports();
    fetchSeedSchools();
    fetchStudentUsers();
    
    // 페이지 로드 시 하루 1회 제한 상태 확인
    setDailyLimits({
      'seed-lunch-activity': checkDailyLimit('seed-lunch-activity'),
      'seed-quiz-activity': checkDailyLimit('seed-quiz-activity')
    });
  }, [filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'reviewed': return '검토중';
      case 'resolved': return '해결됨';
      case 'dismissed': return '기각됨';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">관리자 페이지</h1>
            
            {/* 상단 통계 버튼 */}
            <Link 
              href="/admin7878/stats"
              className="px-6 py-3 bg-blue-500 text-white text-lg font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-md"
            >
              📊 통계
            </Link>
          </div>
          
        </div>

        {/* 시뮬레이션 활동 생성 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">시뮬레이션 활동 생성</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleSeed('seed-lunch-activity')}
              disabled={seeding || dailyLimits['seed-lunch-activity']}
              className="px-6 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {seeding ? '처리 중...' : 
               dailyLimits['seed-lunch-activity'] ? '오늘 실행 완료' : 
               '1. 점심시간 활동 생성'}
            </button>
            <button
              onClick={() => handleSeed('seed-quiz-activity')}
              disabled={seeding || dailyLimits['seed-quiz-activity']}
              className="px-6 py-3 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {seeding ? '처리 중...' : 
               dailyLimits['seed-quiz-activity'] ? '오늘 실행 완료' : 
               '2. 하교 후 퀴즈 풀이'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">* 가계정은 SQL로 직접 생성됩니다. 각 버튼은 하루 1회만 실행 가능합니다.</p>
        </div>

        {/* 계정 전환 섹션 (테스트용) */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">계정 전환 (테스트용)</h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">로그인할 학생 계정을 선택하세요</option>
              {studentUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nickname} ({user.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleImpersonate}
              disabled={impersonating || !selectedUser}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {impersonating ? '로그인 중...' : '선택한 계정으로 로그인'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">* 관리자만 사용할 수 있는 기능입니다. 선택한 학생 계정으로 즉시 로그인하여 앱을 테스트할 수 있습니다.</p>
        </div>

        {/* 관리자 메뉴 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">🎛️ 관리자 메뉴</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/admin7878/db-cleanup"
              className="block p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🗂️</div>
                <h3 className="text-lg font-semibold mb-2">DB 정리 관리</h3>
                <p className="text-sm opacity-90">사용되지 않는 급식정보 정리</p>
              </div>
            </Link>
            
            <Link
              href="/admin7878/stats"
              className="block p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="text-lg font-semibold mb-2">통계 관리</h3>
                <p className="text-sm opacity-90">시스템 통계 및 분석</p>
              </div>
            </Link>
            
            <div className="p-6 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg opacity-60">
              <div className="text-center">
                <div className="text-3xl mb-2">🔧</div>
                <h3 className="text-lg font-semibold mb-2">시스템 관리</h3>
                <p className="text-sm opacity-90">개발 예정</p>
              </div>
            </div>
          </div>
        </div>

        {/* 거점 학교 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">거점 학교 관리</h2>
            <button
              onClick={fetchSeedSchools}
              disabled={schoolsLoading}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
            >
              {schoolsLoading ? '로딩 중...' : '새로고침'}
            </button>
          </div>

          {schoolsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">거점 학교 목록 로딩 중...</p>
            </div>
          ) : seedSchools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              등록된 거점 학교가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      지역
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      학교명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      학교 코드
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {seedSchools.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {school.region}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{school.school_name}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{school.school_code}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          school.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {school.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleSchoolActive(school.id, school.is_active)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            school.is_active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {school.is_active ? '비활성화' : '활성화'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-sm text-gray-500">
                총 {seedSchools.length}개 거점 학교 | 활성: {seedSchools.filter(s => s.is_active).length}개 | 비활성: {seedSchools.filter(s => !s.is_active).length}개
              </div>
            </div>
          )}
        </div>

        {/* 급식 이미지 신고 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">급식 이미지 신고 관리</h2>
            
            <div className="flex items-center space-x-4">
              {/* 정리 버튼 */}
              <button
                onClick={cleanupOldReports}
                className="px-4 py-2 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 transition-colors"
              >
                7일 이후 처리완료 정리
              </button>
              
              {/* 필터 버튼 */}
              <div className="flex space-x-2">
                {['all', 'reviewed', 'resolved', 'dismissed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status as any)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      filter === status
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status === 'all' ? '전체' : getStatusText(status)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">로딩 중...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              신고된 이미지가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이미지
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고 정보
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      학교명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      급식 정보
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      메뉴명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <img
                          src={report.image_url}
                          alt="신고된 이미지"
                          className="h-16 w-16 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(report.image_url)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">업로더: {report.uploader_nickname}</p>
                          <p className="text-gray-500">신고일: {new Date(report.created_at).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{report.school_name}</p>
                          <p className="text-gray-500">코드: {report.school_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{report.meal_date}</p>
                          <p className="text-gray-500">{report.meal_type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm max-w-xs">
                          <p className="text-gray-900 break-words">{report.menu_items}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                          {getStatusText(report.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          {report.status === 'pending' && (
                            <>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                사진삭제
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'dismissed', '부적절한 신고로 판단됨')}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                기각
                              </button>
                            </>
                          )}
                          {report.status === 'reviewed' && (
                            <>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                사진삭제
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'dismissed', '부적절한 신고로 판단됨')}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                기각
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 이미지 팝업 모달 - 기존 화면 위에 오버레이 */}
        {selectedImage && (
          <div 
            className="fixed top-20 left-20 bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-3 z-50"
            style={{ width: '400px', height: '400px' }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">이미지 확대</span>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <img
              src={selectedImage}
              alt="확대된 이미지"
              className="w-full h-full object-cover rounded-lg"
              style={{ width: '360px', height: '360px' }}
            />
          </div>
        )}

        {/* 토스트 메시지 */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
