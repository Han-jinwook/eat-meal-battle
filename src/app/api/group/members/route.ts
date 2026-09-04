import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';

/**
 * 사용자 ID 식별 헬퍼 (x-hub-token 우선 → Supabase 세션 Fallback)
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabaseAdmin = createAdminClient();
  let userId: string | null = null;

  const authHeader = req.headers.get('authorization') || '';
  const hubToken = req.headers.get('x-hub-token') || (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '');
  if (hubToken) {
    try {
      const meRes = await fetch(`${HUB_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${hubToken}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        const hubUser = meData?.user;
        const hubEmail = hubUser?.email;
        const hubUserId = hubUser?.id || hubUser?.userId;

        if (hubUserId) {
          const { data: byId } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', hubUserId)
            .maybeSingle();
          if (byId?.id) userId = byId.id;
        }

        if (!userId && hubEmail) {
          const { data: byEmail } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', hubEmail)
            .maybeSingle();
          if (byEmail?.id) userId = byEmail.id;
        }
      }
    } catch (e) {
      console.warn('[group/members] hub token lookup error:', e);
    }
  }

  if (!userId) {
    const headerUserId = req.headers.get('x-user-id');
    if (headerUserId) userId = headerUserId;
  }

  if (!userId) {
    const qUserId = req.nextUrl.searchParams.get('userId');
    if (qUserId) userId = qUserId;
  }

  if (!userId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  }

  return userId;
}

/**
 * GET /api/group/members
 * 로그인한 유저가 속해 있는 전체 모임(Group) 목록 및 멤버 조회
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 내가 속한 whateat_group_members 조회
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('whateat_group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memErr) throw memErr;

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const groupIds = memberships.map((m: any) => m.group_id);

    // 2. 모임 정보들 조회
    const { data: groups, error: grpErr } = await supabaseAdmin
      .from('whateat_group_groups')
      .select('id, name, owner_id, created_at')
      .in('id', groupIds)
      .order('created_at', { ascending: true });

    if (grpErr) throw grpErr;

    // 3. 각 모임별 멤버 정보 일괄 조회를 위해 전체 멤버십 조회
    const { data: allMembers, error: allMemErr } = await supabaseAdmin
      .from('whateat_group_members')
      .select('group_id, user_id, joined_at')
      .in('group_id', groupIds);

    if (allMemErr) throw allMemErr;

    // 4. 모임에 가입된 모든 유저 정보 조회
    const allUserIds = Array.from(new Set(allMembers.map((m: any) => m.user_id)));
    let usersData: any[] = [];
    if (allUserIds.length > 0) {
      const { data: users, error: usrErr } = await supabaseAdmin
        .from('users')
        .select('id, nickname, profile_image')
        .in('id', allUserIds);
      if (usrErr) throw usrErr;
      usersData = users || [];
    }

    const userMap = new Map(usersData.map((u: any) => [u.id, u]));

    // 5. 모임 목록 가공
    const groupsWithMembers = groups.map((g: any) => {
      const groupMems = allMembers.filter((m: any) => m.group_id === g.id);
      const hostUser = userMap.get(g.owner_id) || null;
      const isOwner = g.owner_id === userId;

      const membersList = groupMems.map((m: any) => {
        const u = userMap.get(m.user_id);
        return {
          userId: m.user_id,
          name: u?.nickname || '멤버',
          avatar: u?.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
          joinedAt: m.joined_at,
          role: m.user_id === g.owner_id ? 'owner' : 'member'
        };
      });

      return {
        id: g.id,
        name: g.name,
        ownerId: g.owner_id,
        isOwner,
        hostUser,
        members: membersList,
        created_at: g.created_at
      };
    });

    return NextResponse.json({ groups: groupsWithMembers });
  } catch (err) {
    console.error('/api/group/members GET error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/group/members
 * 신규 모임 생성 또는 모임 참가
 * body: { action: 'create', name: '골드리치' } 또는 { action: 'join', groupId: '...' }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { action, name, groupId } = body;

    const supabaseAdmin = createAdminClient();

    if (action === 'create') {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: '모임 이름을 기입해주세요.' }, { status: 400 });
      }

      // 1. 모임 그룹 레코드 생성
      const { data: newGroup, error: grpErr } = await supabaseAdmin
        .from('whateat_group_groups')
        .insert({
          name: name.trim(),
          owner_id: userId
        })
        .select()
        .single();

      if (grpErr || !newGroup) {
        console.error('Group creation failed:', grpErr);
        return NextResponse.json({ error: '모임방 생성에 실패했습니다.' }, { status: 500 });
      }

      // 2. 방장을 멤버로 자동 등록
      const { error: memErr } = await supabaseAdmin
        .from('whateat_group_members')
        .insert({
          group_id: newGroup.id,
          user_id: userId
        });

      if (memErr) {
        console.error('Host member insertion failed:', memErr);
        // 생성된 모임 롤백
        await supabaseAdmin.from('whateat_group_groups').delete().eq('id', newGroup.id);
        return NextResponse.json({ error: '방장 멤버 등록에 실패했습니다.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, group: newGroup });
    }

    if (action === 'join') {
      if (!groupId) {
        return NextResponse.json({ error: '참가할 모임 ID가 누락되었습니다.' }, { status: 400 });
      }

      // 1. 모임이 존재하는지 검증
      const { data: group, error: selectErr } = await supabaseAdmin
        .from('whateat_group_groups')
        .select('id, name')
        .eq('id', groupId)
        .maybeSingle();

      if (selectErr || !group) {
        return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });
      }

      // 2. 이미 멤버인지 확인
      const { data: existingMember } = await supabaseAdmin
        .from('whateat_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ success: true, alreadyJoined: true, groupName: group.name });
      }

      // 3. 멤버십 추가
      const { error: joinErr } = await supabaseAdmin
        .from('whateat_group_members')
        .insert({
          group_id: groupId,
          user_id: userId
        });

      if (joinErr) {
        console.error('Join group failed:', joinErr);
        return NextResponse.json({ error: '모임 합류에 실패했습니다.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, groupName: group.name });
    }

    return NextResponse.json({ error: '잘못된 액션 요청입니다.' }, { status: 400 });
  } catch (err) {
    console.error('/api/group/members POST error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/group/members
 * 모임 탈퇴, 멤버 추방, 또는 방장의 모임 전체 삭제
 * body: { groupId: '...', targetUserId: '...' (선택) }
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { groupId, targetUserId } = body;

    if (!groupId) {
      return NextResponse.json({ error: '모임 ID가 누락되었습니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 모임 및 방장 권한 조회
    const { data: group, error: selectErr } = await supabaseAdmin
      .from('whateat_group_groups')
      .select('owner_id, name')
      .eq('id', groupId)
      .maybeSingle();

    if (selectErr || !group) {
      return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = group.owner_id === userId;

    if (targetUserId) {
      // 2. 멤버 추방 (방장만 가능)
      if (!isOwner) {
        return NextResponse.json({ error: '멤버를 추방할 권한이 없습니다.' }, { status: 403 });
      }
      if (targetUserId === userId) {
        return NextResponse.json({ error: '방장 자신은 추방할 수 없으며, 모임 삭제를 수행해야 합니다.' }, { status: 400 });
      }

      const { error: kickErr } = await supabaseAdmin
        .from('whateat_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (kickErr) throw kickErr;

      return NextResponse.json({ success: true, message: '멤버가 추방되었습니다.' });
    } else {
      // 3. 모임 탈퇴 또는 방장의 모임 폭파
      if (isOwner) {
        // 방장이 나가면 모임방 삭제 (Cascade 정책으로 멤버십도 자동 삭제됨)
        const { error: delErr } = await supabaseAdmin
          .from('whateat_group_groups')
          .delete()
          .eq('id', groupId);

        if (delErr) throw delErr;

        return NextResponse.json({ success: true, deleted: true, message: `'${group.name}' 모임이 삭제되었습니다.` });
      } else {
        // 일반 멤버 탈퇴
        const { error: leaveErr } = await supabaseAdmin
          .from('whateat_group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);

        if (leaveErr) throw leaveErr;

        return NextResponse.json({ success: true, message: `'${group.name}' 모임에서 탈퇴했습니다.` });
      }
    }
  } catch (err) {
    console.error('/api/group/members DELETE error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
