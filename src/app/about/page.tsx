'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AboutPage() {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const generatePDF = async () => {
    setIsGeneratingPDF(true)
    try {
      // 동적 import로 PDF 생성 라이브러리 로드
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const html2canvas = html2canvasModule.default
      const jsPDF = jsPDFModule.jsPDF
      
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
      
      pdf.save('뭐먹지_앱소개.pdf')
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
            <img src="/images/sublogo.png" alt="뭐먹지?" className="h-8" />
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
          <img src="/images/sublogo.png" alt="뭐먹지?" className="mx-auto mb-6 w-48" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">뭐먹지? 앱 소개</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            500만 학생의 목소리로 만드는 새로운 급식 문화
          </p>
        </div>

        {/* 앱 목적 및 취지 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">🎯 앱 목적 및 취지</h2>
          
          {/* 배경 및 현황 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-blue-800 mb-4">📊 급식 현황 및 배경</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">전국 급식 현황</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• <strong>전국 학생 수:</strong> 약 500만명 (초중고)</li>
                  <li>• <strong>급식 제공 학교:</strong> 전국 11,000여개 학교</li>
                  <li>• <strong>일일 급식 제공:</strong> 약 450만식</li>
                  <li>• <strong>연간 급식비:</strong> 약 4조원 규모</li>
                  <li>• <strong>영양사 배치:</strong> 학교당 평균 1-2명</li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">현재 관리 체계</h4>
                <ul className="space-y-2 text-gray-700">
                  <li>• <strong>영양 관리:</strong> 교육부 학교급식법 기준</li>
                  <li>• <strong>원산지 표시:</strong> 의무화 (2008년부터)</li>
                  <li>• <strong>위생 관리:</strong> HACCP 시스템 도입</li>
                  <li>• <strong>품질 평가:</strong> 정성적 평가 위주</li>
                  <li>• <strong>학생 의견:</strong> 체계적 수집 시스템 부재</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-red-600 mb-4">🚨 현재 문제점</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">1. 맛에 대한 피드백 부족</h4>
                    <p className="text-gray-700 text-sm mb-2">영양과 원산지는 철저히 관리되지만, 실제 학생들이 느끼는 '맛'과 '만족도'에 대한 체계적인 수집 시스템이 없습니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 개별 학교 단위의 비정기적 설문조사만 존재</li>
                      <li>- 메뉴별 세부 평가 불가능</li>
                      <li>- 실시간 피드백 시스템 부재</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">2. 데이터 기반 의사결정 한계</h4>
                    <p className="text-gray-700 text-sm mb-2">급식 개선을 위한 객관적 데이터가 부족하여 경험과 추측에 의존한 메뉴 기획이 이루어집니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 학생 선호도 데이터 부족</li>
                      <li>- 지역별/학교별 비교 분석 불가</li>
                      <li>- 계절별/요일별 패턴 분석 어려움</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">3. 급식 품질 격차</h4>
                    <p className="text-gray-700 text-sm mb-2">학교별, 지역별로 급식 품질의 편차가 크지만 이를 객관적으로 측정하고 개선할 방법이 제한적입니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 우수 급식 사례 공유 시스템 부재</li>
                      <li>- 급식 품질 벤치마킹 어려움</li>
                      <li>- 투명한 품질 정보 공개 한계</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-green-600 mb-4">✅ 뭐먹지?의 해결 방안</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">1. 실시간 학생 의견 수집</h4>
                    <p className="text-gray-700 text-sm mb-2">전국 500만 학생의 급식 평가를 실시간으로 수집하여 빅데이터를 구축합니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 메뉴별 5점 척도 평가 시스템</li>
                      <li>- 일일 급식 만족도 트래킹</li>
                      <li>- 개인별 선호도 패턴 분석</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">2. AI 기반 데이터 분석</h4>
                    <p className="text-gray-700 text-sm mb-2">수집된 데이터를 AI가 분석하여 급식 개선을 위한 인사이트를 제공합니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 메뉴 선호도 예측 모델</li>
                      <li>- 계절별/요일별 최적 메뉴 추천</li>
                      <li>- 영양 균형과 맛의 조화점 분석</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">3. 게임화를 통한 참여 유도</h4>
                    <p className="text-gray-700 text-sm mb-2">배틀과 퀴즈 시스템으로 학생들의 자발적 참여를 이끌어냅니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 학교별 급식 배틀 시스템</li>
                      <li>- 교육과 연계된 퀴즈 챌린지</li>
                      <li>- 챔피언 시스템으로 동기 부여</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">4. 투명한 정보 공개</h4>
                    <p className="text-gray-700 text-sm mb-2">급식 품질 정보를 투명하게 공개하여 전체적인 품질 향상을 도모합니다.</p>
                    <ul className="text-gray-600 text-xs space-y-1">
                      <li>- 실시간 급식 만족도 공개</li>
                      <li>- 우수 급식 사례 공유</li>
                      <li>- 개선이 필요한 영역 식별</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 기대 효과 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 shadow-lg mt-8">
            <h3 className="text-2xl font-semibold text-green-800 mb-4">🌟 기대 효과</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📈</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">급식 품질 향상</h4>
                <p className="text-gray-700 text-sm">데이터 기반 메뉴 개선으로 전국 급식 만족도 20% 향상 목표</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎓</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">교육 효과 증대</h4>
                <p className="text-gray-700 text-sm">급식과 연계된 교육 콘텐츠로 학습 흥미도 및 영양 지식 향상</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💰</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">예산 효율성</h4>
                <p className="text-gray-700 text-sm">선호도 기반 식재료 구매로 음식물 쓰레기 30% 감소 목표</p>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">📋 운영 규칙 및 정책</h2>
          
          {/* 평점 시스템 상세 */}
          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-red-600 mb-6">⭐ 평점 시스템 정책</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">평가 기준 및 방식</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">1-5점 척도 시스템</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>5점:</strong> 매우 맛있음 (재주문 의사 있음)</li>
                      <li>• <strong>4점:</strong> 맛있음 (만족스러움)</li>
                      <li>• <strong>3점:</strong> 보통 (평균적인 맛)</li>
                      <li>• <strong>2점:</strong> 아쉬움 (개선 필요)</li>
                      <li>• <strong>1점:</strong> 매우 아쉬움 (대폭 개선 필요)</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">메뉴별 개별 평가</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 주식, 국/찌개, 반찬별 독립 평가</li>
                      <li>• 최대 8개 메뉴까지 개별 점수 부여</li>
                      <li>• 메뉴별 선택적 댓글 작성 가능</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">평가 제한 및 검증</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">시간 제한 정책</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>평가 시간:</strong> 급식시간 후 ~ 당일 23:59까지</li>
                      <li>• <strong>수정 가능:</strong> 평가 후 2시간 이내 1회</li>
                      <li>• <strong>삭제 불가:</strong> 평가 완료 후 삭제 불가</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">악의적 평가 방지</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• AI 기반 비정상 패턴 탐지</li>
                      <li>• 연속 극단 평가 시 경고 시스템</li>
                      <li>• 신고 접수 시 관리자 검토</li>
                      <li>• 부적절 댓글 자동 필터링</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 배틀 시스템 상세 */}
          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-blue-600 mb-6">⚔️ 배틀 시스템 운영 정책</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">랭킹 계산 방식</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">가중치 적용 공식</h5>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <p className="font-mono text-gray-700">최종점수 = (평균평점 × 0.7) + (참여도 × 0.2) + (일관성 × 0.1)</p>
                    </div>
                    <ul className="text-gray-700 text-sm space-y-1 mt-2">
                      <li>• <strong>평균평점:</strong> 해당 기간 메뉴별 평점 평균</li>
                      <li>• <strong>참여도:</strong> 전체 급식일 대비 평가 참여율</li>
                      <li>• <strong>일관성:</strong> 평가자들 간 점수 편차 역수</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">공정성 보장 장치</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 학교 규모별 그룹 분류 (소/중/대규모)</li>
                      <li>• 지역별 기후/문화 특성 고려</li>
                      <li>• 최소 참여자 수 기준 (일일 10명 이상)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">배틀 스케줄러</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">자동 계산 스케줄</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>일일 배틀:</strong> 매일 오후 11시 자동 계산</li>
                      <li>• <strong>주간 배틀:</strong> 매주 일요일 오후 11시</li>
                      <li>• <strong>월간 배틀:</strong> 매월 말일 오후 11시</li>
                      <li>• <strong>긴급 재계산:</strong> 관리자 수동 실행 가능</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">시스템 모니터링</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 계산 실패 시 자동 알림</li>
                      <li>• 성능 지표 실시간 모니터링</li>
                      <li>• 데이터 무결성 검증</li>
                      <li>• 백업 및 복구 시스템</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 퀴즈 시스템 상세 */}
          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-green-600 mb-6">🧠 퀴즈 챌린지 정책</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">출제 및 참여 규칙</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">AI 퀴즈 생성 정책</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>출제 시간:</strong> 매일 오전 6시 자동 생성</li>
                      <li>• <strong>난이도 조절:</strong> 학년별 맞춤 난이도</li>
                      <li>• <strong>교과 연계:</strong> 국어, 수학, 과학, 사회, 영어</li>
                      <li>• <strong>급식 연관성:</strong> 당일 메뉴와 70% 이상 연관</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">참여 제한 및 보상</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>참여 횟수:</strong> 1일 1회 (오전 6시 ~ 익일 5시 59분)</li>
                      <li>• <strong>제한 시간:</strong> 문제당 60초 (총 5분)</li>
                      <li>• <strong>재도전:</strong> 불가 (공정성 보장)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">챔피언 선발 시스템</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">주장원/월장원 기준</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>주장원:</strong> 주간 최고 점수 + 연속 참여</li>
                      <li>• <strong>월장원:</strong> 월간 누적 점수 1위</li>
                      <li>• <strong>동점 처리:</strong> 참여 일수 → 평균 소요시간 순</li>
                      <li>• <strong>자격 요건:</strong> 최소 주 5일 이상 참여</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">오답노트 AI 분석</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 개인별 취약 영역 분석</li>
                      <li>• 맞춤형 복습 문제 추천</li>
                      <li>• 학습 패턴 분석 리포트</li>
                      <li>• 학부모 공유 기능</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 시스템 운영 정책 */}
          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-purple-600 mb-6">🔧 시스템 운영 정책</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">테스트 모드 vs 프로덕션 모드</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">테스트 모드 (개발/검증용)</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>데이터:</strong> 샘플 데이터 사용</li>
                      <li>• <strong>AI 기능:</strong> 제한된 API 호출</li>
                      <li>• <strong>알림:</strong> 개발팀에게만 전송</li>
                      <li>• <strong>배틀 계산:</strong> 수동 실행</li>
                      <li>• <strong>접근 권한:</strong> 개발팀 + 베타 테스터</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">프로덕션 모드 (실제 서비스)</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>데이터:</strong> 실제 사용자 데이터</li>
                      <li>• <strong>AI 기능:</strong> 전체 기능 활성화</li>
                      <li>• <strong>알림:</strong> 실제 사용자에게 전송</li>
                      <li>• <strong>배틀 계산:</strong> 자동 스케줄러 실행</li>
                      <li>• <strong>접근 권한:</strong> 모든 등록 사용자</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">데이터 보안 및 개인정보 보호</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">개인정보 수집 최소화</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>필수 정보:</strong> 이메일, 생년월일, 학교 정보</li>
                      <li>• <strong>선택 정보:</strong> 프로필 이미지, 닉네임</li>
                      <li>• <strong>수집 금지:</strong> 실명, 주소, 전화번호</li>
                      <li>• <strong>보관 기간:</strong> 탈퇴 후 즉시 삭제</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">데이터 암호화 및 보안</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>전송 암호화:</strong> TLS 1.3 적용</li>
                      <li>• <strong>저장 암호화:</strong> AES-256 암호화</li>
                      <li>• <strong>접근 제어:</strong> Row Level Security (RLS)</li>
                      <li>• <strong>감사 로그:</strong> 모든 데이터 접근 기록</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 서비스 제재 및 신고 정책 */}
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-semibold text-orange-600 mb-6">⚠️ 서비스 제재 및 신고 정책</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">금지 행위 및 제재 조치</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">금지 행위</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• 허위 정보 입력 및 다중 계정 생성</li>
                      <li>• 악의적 평점 조작 및 스팸 댓글</li>
                      <li>• 타 사용자 괴롭힘 및 부적절한 언어</li>
                      <li>• 시스템 해킹 시도 및 보안 위협</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">제재 단계</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>1단계:</strong> 경고 (7일간 일부 기능 제한)</li>
                      <li>• <strong>2단계:</strong> 정지 (30일간 서비스 이용 금지)</li>
                      <li>• <strong>3단계:</strong> 영구 정지 (계정 삭제)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">신고 및 이의제기</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">신고 처리 절차</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>접수:</strong> 앱 내 신고 버튼 또는 이메일</li>
                      <li>• <strong>검토:</strong> 48시간 이내 1차 검토</li>
                      <li>• <strong>조치:</strong> 7일 이내 최종 결정 통보</li>
                      <li>• <strong>피드백:</strong> 신고자에게 처리 결과 안내</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">이의제기 절차</h5>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• <strong>기간:</strong> 제재 통보 후 14일 이내</li>
                      <li>• <strong>방법:</strong> 공식 이메일로 증빙자료 첨부</li>
                      <li>• <strong>재검토:</strong> 독립적인 검토위원회 심사</li>
                      <li>• <strong>결과:</strong> 14일 이내 최종 결정</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>&copy; 2024 뭐먹지?. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
