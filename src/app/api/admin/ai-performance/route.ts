import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const supabase = createClient();
    
    // 관리자 권한 체크 (추후 구현)
    // const { data: { user } } = await supabase.auth.getUser();
    // if (!user || !isAdmin(user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 성능 로그 테이블이 없다면 임시 데이터 반환
    // 실제로는 ai_analysis_performance_logs 테이블에서 조회
    
    // 임시 데이터 생성 (실제 구현 시 DB에서 조회)
    const mockMetrics = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // AI 분석 리포트용 데이터 수집 (월간 급식 데이터 집계)
      const baseRequests = Math.floor(Math.random() * 500) + 100;
      const responseTime = Math.floor(Math.random() * 2000) + 1000; // 1-3초 (DB 집계 작업)
      const cacheRate = Math.random() * 30 + 60; // 60-90%
      const errorRate = Math.random() * 3; // 0-3%
      
      return {
        date: date.toISOString().split('T')[0],
        total_requests: baseRequests,
        avg_response_time: responseTime,
        cache_hit_rate: cacheRate,
        error_rate: errorRate,
        unique_schools: Math.floor(baseRequests / 10) + 20
      };
    }).reverse();

    // 오늘 통계 계산
    const today = mockMetrics[mockMetrics.length - 1] || {
      total_requests: 0,
      avg_response_time: 0,
      cache_hit_rate: 0,
      error_rate: 0
    };

    const weekTotal = mockMetrics.slice(-7).reduce((sum, day) => sum + day.total_requests, 0);
    
    const stats = {
      today_requests: today.total_requests,
      today_avg_time: today.avg_response_time,
      today_cache_rate: today.cache_hit_rate,
      today_error_rate: today.error_rate,
      total_requests_week: weekTotal,
      optimization_needed: (
        today.total_requests > 1000 ||
        today.avg_response_time > 3000 ||
        today.cache_hit_rate < 70 ||
        today.error_rate > 5
      )
    };

    return NextResponse.json({
      metrics: mockMetrics,
      stats
    });

  } catch (error) {
    console.error('AI 성능 데이터 조회 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 실제 DB 구현 시 사용할 쿼리 예시
/*
const getActualMetrics = async (supabase: any, days: number) => {
  const { data: metrics, error } = await supabase
    .from('daily_ai_performance')
    .select('*')
    .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw error;
  return metrics;
};

const getTodayStats = async (supabase: any) => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: todayData, error } = await supabase
    .from('ai_analysis_performance_logs')
    .select('response_time_ms, cache_hit, error_occurred')
    .gte('timestamp', `${today}T00:00:00`)
    .lt('timestamp', `${today}T23:59:59`);

  if (error) throw error;

  const totalRequests = todayData.length;
  const avgResponseTime = todayData.reduce((sum, log) => sum + log.response_time_ms, 0) / totalRequests;
  const cacheHitRate = (todayData.filter(log => log.cache_hit).length / totalRequests) * 100;
  const errorRate = (todayData.filter(log => log.error_occurred).length / totalRequests) * 100;

  return {
    today_requests: totalRequests,
    today_avg_time: avgResponseTime,
    today_cache_rate: cacheHitRate,
    today_error_rate: errorRate
  };
};
*/
