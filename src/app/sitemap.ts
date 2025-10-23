import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://lunbat.com'
  
  // 기본 정적 페이지들
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/quiz`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/battle`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  try {
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 활성화된 학교 목록 조회 (최근 30일 내 활동이 있는 학교들)
    const { data: schools } = await supabase
      .from('schools')
      .select('school_code, school_name')
      .not('school_name', 'is', null)
      .limit(500) // SEO 효율성을 위해 상위 500개 학교만

    // 학교별 동적 페이지 생성 (기존 쿼리 파라미터 방식)
    const schoolQueryPages: MetadataRoute.Sitemap = (schools || []).map(school => ({
      url: `${baseUrl}/?school_code=${school.school_code}&school_name=${encodeURIComponent(school.school_name)}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    }))

    // 학교별 SEO 친화적 URL 생성
    const schoolSeoPages: MetadataRoute.Sitemap = (schools || []).slice(0, 100).map(school => ({
      url: `${baseUrl}/school/${encodeURIComponent(school.school_name)}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }))

    // 지역별 랭킹 페이지
    const regions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
    const regionPages: MetadataRoute.Sitemap = regions.map(region => ({
      url: `${baseUrl}/ranking/${encodeURIComponent(region)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    return [...staticPages, ...schoolQueryPages, ...schoolSeoPages, ...regionPages]
  } catch (error) {
    console.error('Sitemap 생성 중 오류:', error)
    // DB 오류 시 기본 정적 페이지만 반환
    return staticPages
  }
}
