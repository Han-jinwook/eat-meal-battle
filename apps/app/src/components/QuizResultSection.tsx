"use client";

import React from 'react';
import { toast } from 'react-hot-toast';

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;
  explanation?: string;
  meal_date: string;
  meal_id?: string;
  meal_image_url?: string;
  user_answer?: {
    selected_option?: number;
    is_correct?: boolean;
  };
  selected_option?: number;
  is_correct?: boolean;
  report_status?: 'none' | 'pending' | 'verified_correct' | 'verified_incorrect';
  ai_verification?: {
    isCorrect: boolean;
    confidence: number;
    reasoning: string;
  };
}

interface QuizResultSectionProps {
  quiz: Quiz;
  isViewingMode: boolean;
  reportingQuiz: boolean;
  mealImageUrl: string | null;
  onReportQuiz: () => void;
}

const QuizResultSection: React.FC<QuizResultSectionProps> = ({
  quiz,
  isViewingMode,
  reportingQuiz,
  mealImageUrl,
  onReportQuiz
}) => {
  return (
    <div>
      <div className="text-center">
        {/* 결과 메시지 */}
        {quiz.user_answer && quiz.user_answer.is_correct !== undefined && (
          <div className="flex items-center gap-4 justify-center">
            {/* 급식이미지 - 왼쪽에 크게 배치 */}
            {mealImageUrl && (
              <img 
                src={mealImageUrl}
                alt="급식 이미지"
                className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 shadow-sm flex-shrink-0"
              />
            )}
            
            <p className="text-lg font-semibold">
              {quiz.user_answer.is_correct ? (
                <span className="text-green-600">정답입니다! 🎉</span>
              ) : (
                <span className="text-red-600">틀렸습니다. 다음에 다시 도전해보세요!</span>
              )}
            </p>
          </div>
        )}
        
        {/* 설명 */}
        {quiz.explanation && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-1">💡 설명</p>
            <p className="text-gray-600">{quiz.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResultSection;
