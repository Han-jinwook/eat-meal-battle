"use client";

import React from 'react';

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

interface QuizOptionsSectionProps {
  quiz: Quiz;
  selectedOption: number | null;
  submitted: boolean;
  submitting: boolean;
  isViewingMode: boolean;
  mealImageUrl: string | null;
  onOptionSelect: (optionIndex: number) => void;
  onSubmitAnswer: () => void;
}

const QuizOptionsSection: React.FC<QuizOptionsSectionProps> = ({
  quiz,
  selectedOption,
  submitted,
  submitting,
  isViewingMode,
  mealImageUrl,
  onOptionSelect,
  onSubmitAnswer
}) => {
  return (
    <>
      {/* 퀴즈 보기 */}
      <div className="space-y-3 mb-6">
        {quiz.options.map((option, index) => {
          let optionClass = "border rounded-lg p-4 transition-colors ";
          
          if (submitted && quiz.correct_answer !== undefined) {
            // 퀴즈 완료 후에는 커서를 기본 화살표로
            optionClass += "cursor-default ";
            if (index + 1 === quiz.correct_answer) {
              optionClass += "bg-green-50 border-green-300";
            } else if (index + 1 === selectedOption) {
              optionClass += "bg-red-50 border-red-300";
            } else {
              optionClass += "border-gray-200";
            }
          } else {
            // 퀴즈 풀이 중에는 클릭 가능한 커서
            optionClass += "cursor-pointer ";
            optionClass += selectedOption === index + 1
              ? "bg-blue-50 border-blue-300"
              : "hover:bg-gray-50 border-gray-200";
          }
          
          return (
            <div
              key={index}
              className={optionClass}
              onClick={() => {
                if (!submitted && !isViewingMode) {
                  onOptionSelect(index + 1);
                }
              }}
            >
              <div className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-800 dark:text-gray-900 text-sm font-medium mr-3">
                  {index + 1}
                </span>
                <span className="dark:text-gray-100">{option}</span>
                
                {submitted && quiz.correct_answer !== undefined && (
                  <div className="ml-auto">
                    {index + 1 === quiz.correct_answer ? (
                      <span className="text-green-500">✓</span>
                    ) : index + 1 === selectedOption ? (
                      <span className="text-red-500">✗</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 제출 버튼 */}
      {!submitted && !isViewingMode && (
        <div className="flex items-center gap-4 justify-center">
          {/* 급식이미지 - 왼쪽에 크게 배치 */}
          {mealImageUrl && (
            <img 
              src={mealImageUrl}
              alt="급식 이미지"
              className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 shadow-sm flex-shrink-0"
            />
          )}
          
          <button
            onClick={onSubmitAnswer}
            disabled={selectedOption === null || submitting}
            className="w-24 h-24 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>AI채점 중</span>
              </div>
            ) : (
              "정답 제출"
            )}
          </button>
        </div>
      )}
    </>
  );
};

export default QuizOptionsSection;
