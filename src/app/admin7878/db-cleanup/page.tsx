'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CleanupStats {
  oldMealsCount: number;
  unusedMealsCount: number;
  estimatedSizeMB: number;
  lastUpdated: string;
}

interface CleanupPreview {
  id: string;
  school_code: string;
  school_name: string;
  meal_date: string;
  meal_type: string;
  menu_items: string[];
  created_at: string;
  has_ratings: boolean;
  has_quizzes: boolean;
}

export default function DBCleanupPage() {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [preview, setPreview] = useState<CleanupPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/db-cleanup-stats');
      const data = await response.json();
      
      if (response.ok) {
        setStats(data.stats);
      } else {
        showToast(data.error || '통계 조회에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('통계 조회 오류:', error);
      showToast('통계 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/admin/db-cleanup-preview');
      const data = await response.json();
      
      if (response.ok) {
        setPreview(data.preview);
        setShowPreview(true);
      } else {
        showToast(data.error || '미리보기 조회에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('미리보기 조회 오류:', error);
      showToast('미리보기 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const executeCleanup = async () => {
    if (!confirm('정말로 DB 정리를 실행하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    if (!confirm('⚠️ 최종 확인\n\n30일 이전의 사용되지 않는 급식정보가 영구 삭제됩니다.\n계속하시겠습니까?')) {
      return;
    }

    setCleanupLoading(true);
    try {
      const response = await fetch('/api/admin/db-cleanup-execute', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        showToast(`정리 완료: ${data.deletedCount}개 항목이 삭제되었습니다.`, 'success');
        // 통계 새로고침
        fetchStats();
        setShowPreview(false);
      } else {
        showToast(data.error || 'DB 정리에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('DB 정리 오류:', error);
      showToast('DB 정리 중 오류가 발생했습니다.', 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin7878"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                ← 관리자 메인
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">🗂️ DB 정리 관리</h1>
            </div>
            
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
            >
              {loading ? '로딩 중...' : '📈 통계 새로고침'}
            </button>
          </div>
        </div>

        {/* 안전 정책 안내 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-yellow-800 mb-4">⚠️ 안전 정책</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• <strong>2개월 이전 데이터만</strong> 정리 대상</li>
              <li>• <strong>퀴즈 기간 보호</strong> (지난달 1일~오늘)</li>
              <li>• <strong>별점이 있는 데이터</strong>는 보호됨</li>
            </ul>
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• <strong>미리보기 필수</strong> - 삭제 전 확인</li>
              <li>• <strong>2단계 확인</strong> - 실수 방지</li>
              <li>• <strong>되돌릴 수 없음</strong> - 신중한 실행</li>
            </ul>
          </div>
        </div>

        {/* 통계 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">📊 정리 대상 통계</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">통계 조회 중...</p>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{stats.oldMealsCount.toLocaleString()}</div>
                  <div className="text-sm text-blue-800 mt-2">2개월 이전 급식정보</div>
                </div>
              </div>
              
              <div className="bg-red-50 p-6 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{stats.unusedMealsCount.toLocaleString()}</div>
                  <div className="text-sm text-red-800 mt-2">사용되지 않는 데이터</div>
                </div>
              </div>
              
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{stats.estimatedSizeMB.toFixed(1)} MB</div>
                  <div className="text-sm text-green-800 mt-2">예상 절약 용량</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              통계를 불러올 수 없습니다.
            </div>
          )}
          
          {stats && (
            <div className="mt-6 text-sm text-gray-500 text-center">
              마지막 업데이트: {new Date(stats.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">🔧 정리 작업</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={fetchPreview}
              disabled={previewLoading || !stats || stats.unusedMealsCount === 0}
              className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {previewLoading ? '조회 중...' : '🔍 정리 대상 미리보기'}
            </button>
            
            <button
              onClick={executeCleanup}
              disabled={cleanupLoading || !showPreview || preview.length === 0}
              className="px-6 py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {cleanupLoading ? '정리 중...' : '🧹 안전 정리 실행'}
            </button>
            
            <button
              disabled={true}
              className="px-6 py-3 bg-gray-400 text-white font-medium rounded-lg cursor-not-allowed"
            >
              📋 정리 로그 (개발 예정)
            </button>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            * 미리보기를 먼저 확인한 후 정리를 실행할 수 있습니다.
          </div>
        </div>

        {/* 미리보기 섹션 */}
        {showPreview && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">🔍 삭제 대상 미리보기</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            
            {preview.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                정리할 데이터가 없습니다.
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  총 {preview.length}개 항목이 삭제됩니다.
                </div>
                
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="min-w-full table-auto">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학교명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">메뉴</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm">
                            <div className="font-medium text-gray-900">{item.school_name}</div>
                            <div className="text-gray-500">{item.school_code}</div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="text-gray-900">{item.meal_date}</div>
                            <div className="text-gray-500">{item.meal_type}</div>
                          </td>
                          <td className="px-4 py-4 text-sm max-w-xs">
                            <div className="text-gray-900 truncate">
                              {item.menu_items.join(', ')}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
