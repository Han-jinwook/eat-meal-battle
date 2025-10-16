import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: schools, error } = await supabaseAdmin
      .from('seed_schools')
      .select('*')
      .order('region', { ascending: true })
      .order('school_name', { ascending: true });

    if (error) {
      console.error('거점 학교 조회 오류:', error);
      return NextResponse.json({ error: '거점 학교 목록을 불러오는데 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ schools });
  } catch (error) {
    console.error('거점 학교 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { school_name, school_code, region } = await request.json();

    if (!school_name || !school_code || !region) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const { data: newSchool, error } = await supabaseAdmin
      .from('seed_schools')
      .insert([{
        school_name,
        school_code,
        region,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('거점 학교 생성 오류:', error);
      return NextResponse.json({ error: '거점 학교 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ school: newSchool, message: '거점 학교가 성공적으로 추가되었습니다.' });
  } catch (error) {
    console.error('거점 학교 생성 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, is_active } = await request.json();

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const { data: updatedSchool, error } = await supabaseAdmin
      .from('seed_schools')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('거점 학교 상태 업데이트 오류:', error);
      return NextResponse.json({ error: '거점 학교 상태 업데이트에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ 
      school: updatedSchool, 
      message: `거점 학교가 ${is_active ? '활성화' : '비활성화'}되었습니다.` 
    });
  } catch (error) {
    console.error('거점 학교 상태 업데이트 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
