import { createClient } from '@supabase/supabase-js'

export const handler = async (event, context) => {
  try {
    // 단계 1: 환경 변수 확인
    console.log('Step 1: Checking environment variables')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('SUPABASE_URL exists:', !!supabaseUrl)
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing environment variables',
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseServiceKey
        })
      }
    }
    
    // 단계 2: Supabase import 테스트
    console.log('Step 2: Testing Supabase import')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('Supabase client created successfully')
    
    // 단계 3: 간단한 쿼리 테스트
    console.log('Step 3: Testing simple query')
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code')
      .limit(1)
    
    if (schoolError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'School query failed',
          details: schoolError.message,
          code: schoolError.code
        })
      }
    }
    
    // 학교 목록 가져오기
    const { data: allSchools, error: allSchoolError } = await supabase
      .from('school_infos')
      .select('school_code')

    if (allSchoolError) {
      throw new Error(`학교 목록 조회 실패: ${allSchoolError.message}`)
    }

    console.log(`총 ${allSchools.length}개 학교 발견`)

    // 간단한 테스트 데이터 저장 (grade 제거)
    const testData = {
      school_code: allSchools[0].school_code,
      year: 2025,
      month: 6,
      week_1_days: 5,
      week_2_days: 5,
      week_3_days: 5,
      week_4_days: 4,
      week_5_days: 0,
      month_total: 19
    }

    const { data: testResult, error: testError } = await supabase
      .from('champion_criteria')
      .upsert(testData, {
        onConflict: 'school_code,year,month'
      })
      .select()

    if (testError) {
      throw new Error(`데이터 저장 실패: ${testError.message}`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '테스트 성공!',
        schools: allSchools.length,
        testData
      })
    }
    
  } catch (error) {
    console.error('Critical error:', error)
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Critical error',
        message: error.message,
        name: error.name,
        stack: error.stack
      })
    }
  }
}
