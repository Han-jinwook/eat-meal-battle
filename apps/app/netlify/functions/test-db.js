import { createClient } from '@supabase/supabase-js'

export const handler = async (event, context) => {
  try {
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 학교 목록 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code')

    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
    }

    console.log(`총 ${schools.length}개 학교 발견`)

    // 간단한 테스트 데이터 저장
    const testData = {
      school_code: schools[0].school_code,
      grade: null,
      year: 2025,
      month: 6,
      week_1_days: 5,
      week_2_days: 5,
      week_3_days: 5,
      week_4_days: 5,
      week_5_days: 1,
      month_total: 21,
      created_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase
      .from('champion_criteria')
      .upsert(testData, {
        onConflict: 'school_code,grade,year,month'
      })

    if (insertError) {
      throw new Error(`데이터 저장 실패: ${insertError.message}`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '테스트 성공!',
        schools: schools.length,
        testData
      })
    }
  } catch (error) {
    console.error('테스트 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
