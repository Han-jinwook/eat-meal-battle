import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';
const CLIENT_ID = process.env.MERLIN_HUB_CLIENT_ID || process.env.NEXT_PUBLIC_MERLIN_CLIENT_ID || 'APP-01';
const CLIENT_SECRET = process.env.MERLIN_HUB_CLIENT_SECRET || process.env.NEXT_PUBLIC_MERLIN_CLIENT_SECRET || 'merlin-family-secret-key-2026';

/**
 * GET /api/family/members
 * 멀린 허브의 referrals API로 가족 연결 정보를 조회하고,
 * WhatEat Supabase에서 멤버 상세 정보 및 가족 사진을 합쳐서 반환
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 현재 로그인 사용자 확인 (Supabase)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 2. 클라이언트에서 전달된 멀린 허브 세션 토큰 추출
    const hubToken = req.headers.get('x-hub-token') || '';

    // 3. 멀린 허브 /api/auth/referrals 호출 (내 초대 내역 조회)
    let referrals: any[] = [];
    let myReferrer: string | null = null; // 나를 초대한 사람(방장)의 허브 userId

    if (hubToken) {
      try {
        const hubRes = await fetch(`${HUB_URL}/api/auth/referrals`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': CLIENT_ID,
            'X-Client-Secret': CLIENT_SECRET,
            'Authorization': `Bearer ${hubToken}`,
          },
        });
        if (hubRes.ok) {
          const hubData = await hubRes.json();
          if (hubData.success) referrals = hubData.referrals || [];
        }
      } catch (e) {
        console.warn('[family/members] 멀린 허브 referrals 조회 실패:', e);
      }
    }

    // 4. Supabase admin으로 연결 관계 확인
    const supabaseAdmin = createAdminClient();
    const userId = user.id;

    // Supabase users 테이블에서 내 허브 referral 코드 기반으로 방장 찾기
    // referrals 배열 구조: [{ referee_id, referrer_id, ... }] 또는 허브 고유 구조일 수 있음
    // 허브 referrals에서 나를 초대한 referrer 찾기
    const myInviteRecord = referrals.find(
      (r: any) => r.referee_id === userId || r.referee_user_id === userId || r.invitee_id === userId
    );
    if (myInviteRecord) {
      myReferrer = myInviteRecord.referrer_id || myInviteRecord.referrer_user_id || myInviteRecord.inviter_id || null;
    }

    const isOwner = !myReferrer || myReferrer === userId;
    const targetHostId = myReferrer || userId;

    // 5. 방장이 초대한 멤버들 (referrals에서 referrer_id === targetHostId인 것들)
    const memberIds = referrals
      .filter((r: any) => {
        const referrerId = r.referrer_id || r.referrer_user_id || r.inviter_id;
        return referrerId === targetHostId;
      })
      .map((r: any) => r.referee_id || r.referee_user_id || r.invitee_id)
      .filter((id: string) => id && id !== targetHostId);

    // 6. Supabase에서 방장 정보 조회
    const { data: hostUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname, profile_image')
      .eq('id', targetHostId)
      .maybeSingle();

    // 7. 멤버 상세 정보 조회
    let membersData: any[] = [];
    if (memberIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nickname, profile_image')
        .in('id', memberIds);
      if (usersData) membersData = usersData;
    }

    // 8. 가족 그룹 사진 조회
    const { data: familyGroup } = await supabaseAdmin
      .from('family_groups')
      .select('id, family_photo')
      .eq('owner_id', targetHostId)
      .maybeSingle();

    // 디버그 로그
    console.log('[family/members] userId:', userId, '| isOwner:', isOwner, '| hostId:', targetHostId, '| members:', memberIds, '| referrals count:', referrals.length);
    if (referrals.length > 0) {
      console.log('[family/members] first referral sample:', JSON.stringify(referrals[0]));
    }

    return NextResponse.json({
      isOwner,
      hostId: targetHostId,
      hostUser: hostUser || null,
      refereeIds: memberIds,
      membersData,
      familyGroup: familyGroup || null,
      // 디버그용
      _debug: { referralsCount: referrals.length, hubTokenPresent: !!hubToken },
    });
  } catch (err) {
    console.error('/api/family/members error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
