import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'total_referrals';

  try {
    const supabase = createClient();

    // 기본 쿼리
    let query = supabase
      .from('users')
      .select(`
        id,
        nickname,
        email,
        referral_code,
        created_at,
        referral_stats (
          total_referrals,
          active_referrals
        )
      `);

    // 검색 조건
    if (search) {
      query = query.or(`nickname.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // 정렬
    if (sort === 'total_referrals') {
      query = query.order('referral_stats.total_referrals', { ascending: false, nullsFirst: false });
    } else if (sort === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('nickname', { ascending: true });
    }

    const { data: users, error } = await query.limit(100);

    if (error) {
      console.error('사용자 조회 오류:', error);
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }

    // 추천한 사람 수 계산
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const { data: referredCount } = await supabase
          .from('referrals')
          .select('id', { count: 'exact' })
          .eq('referrer_id', user.id);

        return {
          ...user,
          total_referrals: user.referral_stats?.[0]?.total_referrals || 0,
          active_referrals: user.referral_stats?.[0]?.active_referrals || 0,
          referred_count: referredCount || 0
        };
      })
    );

    // 전체 통계
    const { data: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { data: totalReferrals } = await supabase
      .from('referrals')
      .select('id', { count: 'exact' });

    return NextResponse.json({
      users: usersWithStats,
      stats: {
        totalUsers: totalUsers || 0,
        totalReferrals: totalReferrals || 0
      }
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
