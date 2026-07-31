import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/family/members?userId=xxx
 * Service role로 referrals 테이블을 조회하여 가족 연결 정보를 반환
 * RLS 우회를 위해 admin client 사용
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const userId = user.id;

    // 1. 내가 초대받은 멤버인지 확인 (hostId 조회)
    const { data: myInvite } = await supabaseAdmin
      .from('referrals')
      .select('referrer_id')
      .eq('referee_id', userId)
      .maybeSingle();

    const hostId = myInvite?.referrer_id || null;
    const isOwner = !hostId || hostId === userId;
    const targetHostId = hostId || userId;

    // 2. 방장이 초대한 멤버 목록 조회
    const { data: memberReferrals } = await supabaseAdmin
      .from('referrals')
      .select('referee_id')
      .eq('referrer_id', targetHostId);

    const refereeIds = (memberReferrals || [])
      .map((r: any) => r.referee_id)
      .filter(Boolean)
      .filter((id: string) => id !== targetHostId);

    // 3. 방장 정보 조회
    const { data: hostUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname, profile_image')
      .eq('id', targetHostId)
      .maybeSingle();

    // 4. 멤버 상세 정보 조회
    let membersData: any[] = [];
    if (refereeIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nickname, profile_image')
        .in('id', refereeIds);
      if (usersData) membersData = usersData;
    }

    // 5. 가족 그룹 사진 조회
    const { data: familyGroup } = await supabaseAdmin
      .from('family_groups')
      .select('id, family_photo')
      .eq('owner_id', targetHostId)
      .maybeSingle();

    return NextResponse.json({
      isOwner,
      hostId: targetHostId,
      hostUser: hostUser || null,
      refereeIds,
      membersData,
      familyGroup: familyGroup || null,
    });
  } catch (err) {
    console.error('/api/family/members error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
