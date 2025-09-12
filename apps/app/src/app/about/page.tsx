'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AboutPage() {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const generatePDF = async () => {
    setIsGeneratingPDF(true)
    try {
      // PDF 생성 로직은 나중에 구현
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).jsPDF
      
      const element = document.getElementById('about-content')
      if (!element) return
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save('급식배틀_앱소개.pdf')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/sublogo.png" alt="급식배틀" className="h-8" />
          </Link>
          <button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isGeneratingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                PDF 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF 다운로드
              </>
            )}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div id="about-content" className="max-w-6xl mx-auto px-4 py-8">
        {/* 타이틀 섹션 */}
        <div className="text-center mb-12">
          <img src="/images/sublogo.png" alt="급식배틀" className="mx-auto mb-6 w-48" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">급식배틀 앱 소개</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            500만 학생의 목소리로 만드는 새로운 급식 문화
          </p>
        </div>

        {/* 앱 목적 및 취지 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">🎯 앱 목적 및 취지</h2>
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-4">현재 문제점</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• 영양과 원산지는 관리되지만 '맛'에 대한 피드백 부족</li>
                  <li>• 학생들의 급식 만족도를 체계적으로 수집할 방법 없음</li>
                  <li>• 급식 개선을 위한 데이터 기반 의사결정 어려움</li>
                  <li>• 학교별, 지역별 급식 품질 격차 파악 불가</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-600 mb-4">해결 방안</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• 실시간 급식 평가 시스템으로 학생 의견 수집</li>
                  <li>• AI 기반 데이터 분석으로 개선점 도출</li>
                  <li>• 게임화된 시스템으로 참여도 향상</li>
                  <li>• 투명한 급식 품질 정보 공개</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 기술 스택 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">⚙️ 기술 스택</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-purple-600 mb-4">프론트엔드</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Next.js 14 (App Router)</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• React Hooks</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-blue-600 mb-4">백엔드 & 데이터</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Supabase (PostgreSQL)</li>
                <li>• Row Level Security</li>
                <li>• Real-time subscriptions</li>
                <li>• Edge Functions</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-orange-600 mb-4">AI & 배포</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• OpenAI GPT API</li>
                <li>• DALL-E 이미지 생성</li>
                <li>• Netlify 배포</li>
                <li>• Serverless Functions</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 주요 기능 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">🚀 주요 기능</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-orange-50 rounded-xl p-6 border-l-4 border-orange-400">
              <div className="flex items-center mb-4">
                <img src="/images/characters/meal-rabbit.png" alt="급식" className="w-12 h-12 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">급식 평가</h3>
              </div>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• AI 생성 이미지와 함께 메뉴 확인</li>
                <li>• 메뉴별 개별 별점 평가</li>
                <li>• 소감 댓글 작성</li>
                <li>• 부모님과 실시간 공유</li>
              </ul>
            </div>
            <div className="bg-red-50 rounded-xl p-6 border-l-4 border-red-400">
              <div className="flex items-center mb-4">
                <img src="/images/characters/battle-tiger.png" alt="배틀" className="w-12 h-12 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">급식 배틀</h3>
              </div>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• 학교별/지역별 급식 순위</li>
                <li>• 메뉴별 인기도 랭킹</li>
                <li>• 실시간 배틀 현황</li>
                <li>• AI 분석 리포트</li>
              </ul>
            </div>
            <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-400">
              <div className="flex items-center mb-4">
                <img src="/images/characters/quiz-fox.png" alt="퀴즈" className="w-12 h-12 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">교육 퀴즈</h3>
              </div>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• AI 맞춤 퀴즈 출제</li>
                <li>• 전 교과 연계 학습</li>
                <li>• 주장원/월장원 시스템</li>
                <li>• 오답노트 AI 분석</li>
              </ul>
            </div>
            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-400">
              <div className="flex items-center mb-4">
                <svg className="w-12 h-12 mr-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3 className="text-xl font-semibold text-gray-900">관심학교</h3>
              </div>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• 다른 학교 급식 정보 구독</li>
                <li>• 관심학교 퀴즈 참여</li>
                <li>• 학교별 비교 분석</li>
                <li>• 알림 및 업데이트 수신</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 사용자별 가이드 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">👥 사용자별 가이드</h2>
          
          {/* 학생용 */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-blue-600 mb-4">🎓 초중고 학생</h3>
            <div className="bg-blue-50 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">주요 활동</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>1. 학교 등록 및 학년/반 설정</li>
                    <li>2. 매일 급식 메뉴 확인 및 평가</li>
                    <li>3. 친구들과 급식 배틀 참여</li>
                    <li>4. 일일 퀴즈 도전으로 챔피언 되기</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">혜택</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>• 내 의견이 급식 개선에 반영</li>
                    <li>• 재미있는 게임으로 학습 효과</li>
                    <li>• 친구들과 건전한 경쟁</li>
                    <li>• 편식 개선 및 영양 교육</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 학부모용 */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-purple-600 mb-4">👨‍👩‍👧‍👦 학부모</h3>
            <div className="bg-purple-50 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">모니터링 기능</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>• 자녀의 급식 평가 내역 확인</li>
                    <li>• 선호 메뉴 및 편식 패턴 파악</li>
                    <li>• 학교 급식 품질 정보 확인</li>
                    <li>• 퀴즈 참여도 및 학습 현황</li>
                    <li>• 관심학교 퀴즈 구독 및 알림</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">활용 방안</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>• 가정에서 영양 교육 연계</li>
                    <li>• 자녀와 급식에 대한 대화</li>
                    <li>• 학교 급식 개선 의견 제시</li>
                    <li>• 건강한 식습관 형성 지원</li>
                    <li>• 관심학교 퀴즈로 교육 참여</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 급식관계자용 */}
          <div>
            <h3 className="text-2xl font-semibold text-green-600 mb-4">🏫 급식관계자</h3>
            <div className="bg-green-50 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">데이터 분석</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>• 실시간 급식 만족도 모니터링</li>
                    <li>• 메뉴별 선호도 통계</li>
                    <li>• 학교별/지역별 비교 분석</li>
                    <li>• AI 기반 개선 제안</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">업무 개선</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li>• 데이터 기반 메뉴 기획</li>
                    <li>• 학생 피드백 즉시 반영</li>
                    <li>• 급식 품질 향상 근거 마련</li>
                    <li>• 투명한 급식 운영</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 규칙 및 제도 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">📋 규칙 및 제도</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-red-600 mb-4">평점 시스템</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• 1-5점 별점 시스템</li>
                <li>• 메뉴별 개별 평가</li>
                <li>• 하루 1회 평가 제한</li>
                <li>• 악의적 평가 방지 시스템</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-blue-600 mb-4">배틀 및 랭킹</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• 주간/월간 랭킹 시스템</li>
                <li>• 공정한 비교를 위한 가중치 적용</li>
                <li>• 참여도 기반 신뢰도 점수</li>
                <li>• 지역별/규모별 구분 랭킹</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-green-600 mb-4">퀴즈 챌린지</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• 일일 퀴즈 1회 참여</li>
                <li>• 주장원/월장원 선발</li>
                <li>• 연속 참여 보너스</li>
                <li>• 교육과정 연계 문제 출제</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-purple-600 mb-4">개인정보 보호</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• 최소한의 개인정보 수집</li>
                <li>• 익명화된 데이터 분석</li>
                <li>• 학부모 동의 기반 연동</li>
                <li>• 안전한 데이터 암호화</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 연락처 */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">📞 문의하기</h2>
          <div className="bg-white rounded-xl p-8 shadow-lg max-w-2xl mx-auto">
            <p className="text-gray-600 mb-4">
              급식배틀 앱에 대한 문의사항이나 제안이 있으시면 언제든 연락해 주세요.
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>개발팀:</strong> 급식배틀 개발팀</p>
              <p><strong>이메일:</strong> contact@mealbattle.com</p>
              <p><strong>웹사이트:</strong> www.mealbattle.com</p>
            </div>
          </div>
        </section>
      </div>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>&copy; 2024 급식배틀. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
