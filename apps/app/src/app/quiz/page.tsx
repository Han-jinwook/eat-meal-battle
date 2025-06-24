import React, { Suspense } from 'react';
import QuizClient from './QuizClient';

export default function QuizPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <QuizClient />
      </Suspense>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
      </div>
      
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col items-center">
          <div className="h-5 bg-gray-200 rounded w-36 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
      </div>
    </div>
  );
}
