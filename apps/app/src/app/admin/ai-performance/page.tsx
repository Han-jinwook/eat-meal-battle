'use client';

import { useState, useEffect } from 'react';

interface PerformanceMetrics {
  date: string;
  total_requests: number;
  avg_response_time: number;
  cache_hit_rate: number;
  error_rate: number;
  unique_schools: number;
}

interface DailyStats {
  today_requests: number;
  today_avg_time: number;
  today_cache_rate: number;
  today_error_rate: number;
  total_requests_week: number;
  optimization_needed: boolean;
}

export default function AdminAIPerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [stats, setStats] = useState<DailyStats>({
    today_requests: 0,
    today_avg_time: 0,
    today_cache_rate: 0,
    today_error_rate: 0,
    total_requests_week: 0,
    optimization_needed: false
  });
  const [dateRange, setDateRange] = useState('7'); // 최근 7일
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-performance?days=${dateRange}`);
      const data = await response.json();
      
      if (data.metrics) {
        setMetrics(data.metrics);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('AI 성능 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'text-red-600' : 'text-green-600';
  };

  const getStatusBg = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'bg-red-50' : 'bg-green-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">🤖 AI 분석 리포트 성능 모니터링</h1>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7">최근 7일</option>
              <option value="30">최근 30일</option>
              <option value="90">최근 90일</option>
            </select>
          </div>
          
          {/* 오늘 핵심 지표 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${getStatusBg(stats.today_requests, 1000)}`}>
              <div className="text-sm text-gray-600">오늘 요청수</div>
              <div className={`text-2xl font-bold ${getStatusColor(stats.today_requests, 1000)}`}>
                {stats.today_requests.toLocaleString()}회
              </div>
              <div className="text-xs text-gray-500 mt-1">
                임계: 1,000회/일
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${getStatusBg(stats.today_avg_time, 3000, true)}`}>
              <div className="text-sm text-gray-600">평균 응답시간</div>
              <div className={`text-2xl font-bold ${getStatusColor(stats.today_avg_time, 3000, true)}`}>
                {stats.today_avg_time.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-500 mt-1">
                임계: 3,000ms
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${getStatusBg(stats.today_cache_rate, 70)}`}>
              <div className="text-sm text-gray-600">캐시 적중률</div>
              <div className={`text-2xl font-bold ${getStatusColor(stats.today_cache_rate, 70)}`}>
                {stats.today_cache_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                목표: 70% 이상
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${getStatusBg(stats.today_error_rate, 5, true)}`}>
              <div className="text-sm text-gray-600">에러율</div>
              <div className={`text-2xl font-bold ${getStatusColor(stats.today_error_rate, 5, true)}`}>
                {stats.today_error_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                목표: 5% 미만
              </div>
            </div>
          </div>

          {/* 최적화 권장사항 */}
          {stats.optimization_needed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-yellow-600 mr-3">⚠️</div>
                <div>
                  <h3 className="font-semibold text-yellow-800 mb-2">최적화 권장사항</h3>
                  <div className="text-sm text-yellow-700 space-y-1">
                    {stats.today_requests > 1000 && (
                      <div>• 일일 요청 {stats.today_requests}회 초과 → Redis 캐싱 도입 검토</div>
                    )}
                    {stats.today_avg_time > 3000 && (
                      <div>• 평균 응답시간 {stats.today_avg_time}ms 초과 → 쿼리 최적화 필요</div>
                    )}
                    {stats.today_cache_rate < 70 && (
                      <div>• 캐시 적중률 {stats.today_cache_rate}% → 캐시 전략 개선 필요</div>
                    )}
                    {stats.today_error_rate > 5 && (
                      <div>• 에러율 {stats.today_error_rate}% → 에러 원인 분석 필요</div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-yellow-600">
                    💡 Phase 2 최적화 단계: 사전 집계 테이블 생성, 배치 처리 도입
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 일별 성능 트렌드 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">일별 성능 트렌드</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">로딩 중...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      총 요청
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      평균 응답시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      캐시 적중률
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      에러율
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      학교수
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metrics.map((metric) => (
                    <tr key={metric.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(metric.date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${getStatusColor(metric.total_requests, 1000)}`}>
                          {metric.total_requests.toLocaleString()}회
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${getStatusColor(metric.avg_response_time, 3000, true)}`}>
                          {metric.avg_response_time.toFixed(0)}ms
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${getStatusColor(metric.cache_hit_rate, 70)}`}>
                          {metric.cache_hit_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${getStatusColor(metric.error_rate, 5, true)}`}>
                          {metric.error_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {metric.unique_schools}개교
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {metrics.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  성능 데이터가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
