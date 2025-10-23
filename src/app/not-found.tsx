import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다 | 급식배틀',
  description: '요청하신 페이지를 찾을 수 없습니다. 급식배틀 메인 페이지로 돌아가서 전국 학교 급식 랭킹과 AI 급식퀴즈를 즐겨보세요!',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center px-6">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="text-gray-600 mb-8">
            요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
        </div>

        <div className="space-y-4">
          <Link 
            href="/"
            className="block w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            🍱 급식배틀 메인으로
          </Link>
          
          <Link 
            href="/quiz"
            className="block w-full bg-white text-indigo-600 py-3 px-6 rounded-lg font-medium border border-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            🧠 AI 급식퀴즈 하러가기
          </Link>
          
          <Link 
            href="/battle"
            className="block w-full bg-white text-indigo-600 py-3 px-6 rounded-lg font-medium border border-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            🏆 급식 랭킹 보러가기
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>학교를 찾고 계신가요?</p>
          <p className="mt-1">
            메인 페이지에서 <strong>학교 검색</strong>을 이용해보세요!
          </p>
        </div>
      </div>
    </div>
  )
}
