import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 현재 시간 기준 계산
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. 사용자 통계
    const { data: totalUsersData } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { data: weeklyNewUsersData } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', weekAgo.toISOString());

    const { data: monthlyNewUsersData } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', monthAgo.toISOString());

    // 활성 사용자 (평점을 남긴 사용자 기준)
    const { data: dailyActiveUsersData } = await supabase
      .from('meal_ratings')
      .select('user_id', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .not('user_id', 'is', null);

    const { data: weeklyActiveUsersData } = await supabase
      .from('meal_ratings')
      .select('user_id')
      .gte('created_at', weekAgo.toISOString())
      .not('user_id', 'is', null);

    const { data: monthlyActiveUsersData } = await supabase
      .from('meal_ratings')
      .select('user_id')
      .gte('created_at', monthAgo.toISOString())
      .not('user_id', 'is', null);

    // 중복 제거를 위해 Set 사용
    const weeklyActiveUsers = weeklyActiveUsersData ? new Set(weeklyActiveUsersData.map(r => r.user_id)).size : 0;
    const monthlyActiveUsers = monthlyActiveUsersData ? new Set(monthlyActiveUsersData.map(r => r.user_id)).size : 0;

    // 2. 학교 통계
    const { data: totalSchoolsData } = await supabase
      .from('school_infos')
      .select('school_code', { count: 'exact' });

    const { data: schoolsWithUsersData } = await supabase
      .from('school_infos')
      .select('school_code', { count: 'exact' })
      .not('user_id', 'is', null);

    const averageUsersPerSchool = totalSchoolsData && schoolsWithUsersData 
      ? (totalUsersData?.length || 0) / (totalSchoolsData.length || 1)
      : 0;

    // 3. 활동 통계
    const { data: totalRatingsData } = await supabase
      .from('meal_ratings')
      .select('id', { count: 'exact' });

    const { data: dailyRatingsData } = await supabase
      .from('meal_ratings')
      .select('id', { count: 'exact' })
      .gte('created_at', today.toISOString());

    const { data: weeklyRatingsData } = await supabase
      .from('meal_ratings')
      .select('id', { count: 'exact' })
      .gte('created_at', weekAgo.toISOString());

    const { data: monthlyRatingsData } = await supabase
      .from('meal_ratings')
      .select('id', { count: 'exact' })
      .gte('created_at', monthAgo.toISOString());

    // 이미지 통계
    const { data: totalImagesData } = await supabase
      .from('meal_images')
      .select('id', { count: 'exact' });

    const { data: dailyImagesData } = await supabase
      .from('meal_images')
      .select('id', { count: 'exact' })
      .gte('created_at', today.toISOString());

    const { data: weeklyImagesData } = await supabase
      .from('meal_images')
      .select('id', { count: 'exact' })
      .gte('created_at', weekAgo.toISOString());

    const { data: monthlyImagesData } = await supabase
      .from('meal_images')
      .select('id', { count: 'exact' })
      .gte('created_at', monthAgo.toISOString());

    // 4. 학교별/학년별 학생수 통계
    const { data: schoolGradeStatsData } = await supabase
      .from('school_infos')
      .select('school_code, school_name, grade')
      .not('user_id', 'is', null);

    // 학교별/학년별 통계 처리
    const schoolGradeStats = schoolGradeStatsData?.reduce((acc, record) => {
      const schoolKey = `${record.school_code}-${record.school_name}`;
      if (!acc[schoolKey]) {
        acc[schoolKey] = {
          schoolCode: record.school_code,
          schoolName: record.school_name,
          totalStudents: 0,
          gradeBreakdown: {}
        };
      }
      acc[schoolKey].totalStudents++;
      
      const grade = record.grade || '미설정';
      acc[schoolKey].gradeBreakdown[grade] = (acc[schoolKey].gradeBreakdown[grade] || 0) + 1;
      
      return acc;
    }, {} as Record<string, any>) || {};

    // 응답 데이터 구성
    const stats = {
      userStats: {
        totalUsers: totalUsersData?.length || 0,
        weeklyNewUsers: weeklyNewUsersData?.length || 0,
        monthlyNewUsers: monthlyNewUsersData?.length || 0,
        dailyActiveUsers: dailyActiveUsersData?.length || 0,
        weeklyActiveUsers,
        monthlyActiveUsers,
      },
      schoolStats: {
        totalSchools: totalSchoolsData?.length || 0,
        schoolsWithUsers: schoolsWithUsersData?.length || 0,
        averageUsersPerSchool,
      },
      schoolGradeStats: Object.values(schoolGradeStats),
      activityStats: {
        totalRatings: totalRatingsData?.length || 0,
        dailyRatings: dailyRatingsData?.length || 0,
        weeklyRatings: weeklyRatingsData?.length || 0,
        monthlyRatings: monthlyRatingsData?.length || 0,
        totalImages: totalImagesData?.length || 0,
        dailyImages: dailyImagesData?.length || 0,
        weeklyImages: weeklyImagesData?.length || 0,
        monthlyImages: monthlyImagesData?.length || 0,
      },
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json(
      { error: '통계 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
