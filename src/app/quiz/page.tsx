import { Suspense } from 'react';
import QuizWrapper from './client-wrapper';

export default function QuizPage() {

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }>
          <QuizWrapper />
        </Suspense>
      </div>
    </main>
  );
}
