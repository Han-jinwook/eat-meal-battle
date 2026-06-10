import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '사이트맵 | 뭐먹지? - 나만의 맛집 서랍장 & 학교 급식',
  description: '뭐먹지?의 모든 페이지를 한눈에! 전국 학교별 급식 평가, 지역별 랭킹 등 모든 서비스를 찾아보세요.',
}

export default function SitemapPage() {
  const mainPages = [
    { href: '/', title: '메인 페이지', desc: '뭐먹지? 홈' },
    { href: '/about', title: '서비스 소개', desc: '뭐먹지? 안내' },
  ]

  const popularSchools = [
    '청라고등학교', '가림고등학교', '판교고등학교', 
    '서울고등학교', '부산고등학교', '인천고등학교'
  ]

  const regions = [
    '서울', '부산', '대구', '인천', '광주', '대전', 
    '울산', '세종', '경기', '강원', '충북', '충남', 
    '전북', '전남', '경북', '경남', '제주'
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗺️ 뭐먹지? 사이트맵
          </h1>
          <p className="text-gray-600 mb-8">
            뭐먹지?의 모든 페이지를 한눈에 확인하세요!
          </p>

          {/* 주요 서비스 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
              🍱 주요 서비스
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {mainPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-medium text-indigo-600">{page.title}</h3>
                  <p className="text-sm text-gray-600">{page.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* 인기 학교 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
              🏫 인기 학교
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {popularSchools.map((school) => (
                <Link
                  key={school}
                  href={`/school/${encodeURIComponent(school)}`}
                  className="block p-3 text-center border rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {school}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* 지역별 랭킹 */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
              🏆 지역별 급식 랭킹
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {regions.map((region) => (
                <Link
                  key={region}
                  href={`/ranking/${encodeURIComponent(region)}`}
                  className="block p-2 text-center border rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {region}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* 기타 페이지 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
              📋 기타 페이지
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Link href="/login" className="block p-3 border rounded-lg hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-700">로그인</span>
              </Link>
              <Link href="/privacy-policy" className="block p-3 border rounded-lg hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-700">개인정보처리방침</span>
              </Link>
            </div>
          </section>

          <div className="mt-8 p-4 bg-indigo-50 rounded-lg">
            <p className="text-sm text-indigo-700">
              💡 <strong>찾는 학교가 없나요?</strong><br />
              메인 페이지에서 학교명을 검색하면 전국 모든 학교의 급식 정보를 확인할 수 있습니다!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
