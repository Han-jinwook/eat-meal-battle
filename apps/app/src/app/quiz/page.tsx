import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// 동적 클라이언트 컴포넌트 임포트
const QuizClient = dynamic(() => import('./QuizClient'), { ssr: false });

export default function QuizPage() {

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }>
          <QuizClient />
        </Suspense>
      </div>
    </main>
  );
}
