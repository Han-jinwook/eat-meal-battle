import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 관심학교 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 사용자의 관심학교 목록 조회
    const { data: interestSchools, error } = await supabase
      .from('interest_schools')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('관심학교 조회 오류:', error);
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ interestSchools: interestSchools || [] });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// 관심학교 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { school_code, school_name } = await request.json();

    if (!school_code || !school_name) {
      return NextResponse.json({ error: '학교 코드와 이름이 필요합니다' }, { status: 400 });
    }

    // 중복 등록 확인
    const { data: existingSchool, error: duplicateError } = await supabase
      .from('interest_schools')
      .select('id')
      .eq('user_id', user.id)
      .eq('school_code', school_code)
      .maybeSingle();

    if (duplicateError) {
      console.error('중복 확인 오류:', duplicateError);
      return NextResponse.json({ error: '데이터 확인 실패' }, { status: 500 });
    }

    if (existingSchool) {
      return NextResponse.json({ error: '이미 등록된 학교입니다' }, { status: 400 });
    }

    // 관심학교 추가
    const { data: newSchool, error } = await supabase
      .from('interest_schools')
      .insert({
        user_id: user.id,
        school_code,
        school_name
      })
      .select()
      .single();

    if (error) {
      console.error('관심학교 추가 오류:', error);
      return NextResponse.json({ error: '등록 실패' }, { status: 500 });
    }

    return NextResponse.json({ interestSchool: newSchool });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// 관심학교 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { school_code } = await request.json();

    if (!school_code) {
      return NextResponse.json({ error: '학교 코드가 필요합니다' }, { status: 400 });
    }

    // 관심학교 삭제
    const { error } = await supabase
      .from('interest_schools')
      .delete()
      .eq('user_id', user.id)
      .eq('school_code', school_code);

    if (error) {
      console.error('관심학교 삭제 오류:', error);
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ message: '관심학교가 삭제되었습니다' });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
