/*
 * BACKUP FILE - PublicDashboard_backup.tsx
 * 
 * 이 파일은 비로그인 사용자용 대시보드 컴포넌트의 백업입니다.
 * login/page.tsx와 유사한 기능을 제공하므로 중복 가능성이 있어 백업으로 보관합니다.
 * 
 * 원래 파일명: PublicDashboard.tsx
 * 백업 생성일: 2025-01-11
 * 
 * 추후 확인 후 필요 없으면 삭제 예정
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PublicDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginClick = () => {
    setIsLoading(true);
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <img src="/images/characters/meal-rabbit.png" alt="급식" className="w-6 h-6 object-contain" />
              급식배틀
            </h1>
            </div>
            <button
              onClick={handleLoginClick}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? '로딩...' : '로그인'}
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <div className="mb-8">
<<<<<<< HEAD:apps/app/src/components/PublicDashboard.tsx
            <div className="mb-6">
              <img 
                src="/images/sub-logo.png" 
                alt="급식배틀 로고" 
                className="mx-auto h-32 md:h-40 w-auto"
              />
            </div>
=======
            <img src="/images/characters/meal-rabbit.png" alt="급식" className="w-24 h-24 object-contain mx-auto mb-4" />
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              급식배틀
            </h1>
>>>>>>> 203cc88b2e5ab22db9b841294a3ce877d3b18a4f:apps/app/src/components/PublicDashboard_backup.tsx
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              우리 학교 급식을 평가하고 친구들과 퀴즈를 즐겨보세요!
            </p>
          </div>
          
          <button
            onClick={handleLoginClick}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? '로딩 중...' : '지금 시작하기 →'}
          </button>
        </div>

<<<<<<< HEAD:apps/app/src/components/PublicDashboard.tsx
        {/* 기능 소개 - 업데이트됨 */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4 text-center md:text-left">🍽️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center md:text-left">급식</h3>
            <p className="text-gray-600 text-center md:text-left">
=======
        {/* 기능 소개 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
            <img src="/images/characters/meal-rabbit.png" alt="급식 평가" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">급식 평가</h3>
            <p className="text-gray-600">
>>>>>>> 203cc88b2e5ab22db9b841294a3ce877d3b18a4f:apps/app/src/components/PublicDashboard_backup.tsx
              오늘의 급식 메뉴를 확인하고 평점을 매겨보세요. 
              친구들과 함께 맛있는 메뉴를 찾아보세요!
            </p>
            <ul className="text-gray-600 text-sm mt-3 space-y-1">
              <li>• 메뉴별 하나하나 별점 메기고 소감댓글 남기기</li>
              <li>• 부모님과 공유연결해 두면 항상 내 입맛 체크도 가능</li>
            </ul>
          </div>

<<<<<<< HEAD:apps/app/src/components/PublicDashboard.tsx
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4 text-center md:text-left">⚔️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center md:text-left">배틀</h3>
            <ul className="text-gray-600 text-sm space-y-1">
              <li>• 우리학교/우리동네/전국 최고의 메뉴, 최악의 메뉴 실시간 확인</li>
              <li>• 우리동네/전국 최고 급식평점을 준 학교와 최하 평점 학교순위 확인</li>
              <li>• Data 기반한 월별 AI분석 리포트 - 급식담당자/학교당국/학부모 참고용</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl mb-4 text-center md:text-left">🧠</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center md:text-left">퀴즈</h3>
            <ul className="text-gray-600 text-sm space-y-1">
              <li>• 오늘 먹은 메뉴/학변별 맞춤 AI가 출제한 꿀잼 퀴즈 1일 1개 풀기</li>
              <li>• 먹고 끝이 아니라 전 교과와 연계/확장된 교육소재로 공부흥미와 편식방지까지</li>
            </ul>
=======
          <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
            <img src="/images/characters/battle-tiger.png" alt="급식 배틀" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">급식 배틀</h3>
            <p className="text-gray-600">
              학교별, 메뉴별 급식 배틀에 참여하세요. 
              우리 학교 급식이 얼마나 맛있는지 확인해보세요!
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
            <img src="/images/characters/quiz-fox.png" alt="급식 퀴즈" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">급식 퀴즈</h3>
            <p className="text-gray-600">
              급식 관련 재미있는 퀴즈를 풀어보세요. 
              친구들과 퀴즈 대결을 통해 주장원, 월장원에 도전하세요!
            </p>
>>>>>>> 203cc88b2e5ab22db9b841294a3ce877d3b18a4f:apps/app/src/components/PublicDashboard_backup.tsx
          </div>
        </div>

        {/* 사용 방법 */}
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            어떻게 사용하나요?
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">회원가입</h3>
              <p className="text-gray-600 text-sm">구글 또는 카카오 계정으로 간편하게 가입하세요</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">학교 등록</h3>
              <p className="text-gray-600 text-sm">내 학교를 등록하고 학년, 반 정보를 입력하세요</p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">급식 평가</h3>
              <p className="text-gray-600 text-sm">오늘의 급식을 먹고 별점과 댓글을 남겨보세요</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">4️⃣</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">퀴즈 도전</h3>
              <p className="text-gray-600 text-sm">친구들과 퀴즈 대결을 통해 챔피언에 도전하세요</p>
            </div>
          </div>
        </div>

        {/* CTA 섹션 */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            지금 바로 시작해보세요!
          </h2>
          <p className="text-gray-600 mb-8">
            친구들과 함께 급식을 더 재미있게 즐겨보세요
          </p>
          <button
            onClick={handleLoginClick}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? '로딩 중...' : '무료로 시작하기'}
          </button>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 급식배틀. 모든 권리 보유.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
