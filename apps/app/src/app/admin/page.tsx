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
}

export default function AdminPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'>('all');

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

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">관리자 페이지</h1>
          
          {/* 네비게이션 메뉴 */}
          <div className="flex space-x-4 mb-6">
            <Link 
              href="/admin/ai-performance"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              AI 성능 분석
            </Link>
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md">
              급식 이미지 신고 관리
            </button>
          </div>
        </div>

        {/* 급식 이미지 신고 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">급식 이미지 신고 관리</h2>
            
            {/* 필터 버튼 */}
            <div className="flex space-x-2">
              {['all', 'pending', 'reviewed', 'resolved', 'dismissed'].map((status) => (
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
                      급식 정보
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
                          className="h-16 w-16 object-cover rounded-md"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">업로더: {report.uploader_nickname}</p>
                          <p className="text-gray-500">신고 사유: {report.report_reason}</p>
                          <p className="text-gray-500">신고일: {new Date(report.created_at).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{report.school_code}</p>
                          <p className="text-gray-500">{report.meal_date} {report.meal_type}</p>
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
                                onClick={() => updateReportStatus(report.id, 'reviewed')}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                검토중
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'resolved', '문제 해결됨')}
                                className="text-green-600 hover:text-green-800"
                              >
                                해결
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'dismissed', '신고 내용이 부적절함')}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                기각
                              </button>
                            </>
                          )}
                          {report.status === 'reviewed' && (
                            <>
                              <button
                                onClick={() => updateReportStatus(report.id, 'resolved', '문제 해결됨')}
                                className="text-green-600 hover:text-green-800"
                              >
                                해결
                              </button>
                              <button
                                onClick={() => updateReportStatus(report.id, 'dismissed', '신고 내용이 부적절함')}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                기각
                              </button>
                            </>
                          )}
                          <a
                            href={report.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            이미지 보기
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
