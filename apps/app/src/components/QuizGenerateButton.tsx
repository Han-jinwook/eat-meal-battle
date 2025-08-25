"use client";

import React from 'react';

interface QuizGenerateButtonProps {
  isGenerating: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const QuizGenerateButton: React.FC<QuizGenerateButtonProps> = ({
  isGenerating,
  onClick,
  disabled = false,
  className = ""
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isGenerating}
      className={`p-0 relative overflow-hidden hover:opacity-90 ${className}`}
    >
      {isGenerating ? (
        <svg width="280" height="60" viewBox="0 0 280 60" role="img" aria-label="퀴즈 생성 중">
          <defs>
            <linearGradient id="quizGenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6A00FF"/>
              <stop offset="50%" stopColor="#3F55FF"/>
              <stop offset="100%" stopColor="#00D1FF"/>
            </linearGradient>
            <filter id="quizGenShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0A1B2B" floodOpacity="0.18"/>
            </filter>
          </defs>
          
          {/* Button shape */}
          <rect x="3" y="3" rx="12" ry="12" width="274" height="54" fill="url(#quizGenGrad)" filter="url(#quizGenShadow)"/>
          
          {/* Loading spinner */}
          <g transform="translate(25,30)">
            <circle cx="0" cy="0" r="8" fill="none" stroke="#1EE6D6" strokeWidth="2" strokeLinecap="round">
              <animate attributeName="stroke-dasharray" values="0 50;25 25;0 50" dur="1.5s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.5s" repeatCount="indefinite"/>
            </circle>
          </g>
          
          {/* Text */}
          <text x="60" y="38" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
            fontWeight="700" fontSize="18" fill="#FFFFFF">퀴즈 생성 중...</text>
        </svg>
      ) : (
        <svg width="280" height="60" viewBox="0 0 280 60" role="img" aria-label="퀴즈 생성 버튼">
          <defs>
            <linearGradient id="quizGenGradStatic" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6A00FF"/>
              <stop offset="50%" stopColor="#3F55FF"/>
              <stop offset="100%" stopColor="#00D1FF"/>
            </linearGradient>
            <filter id="quizGenShadowStatic" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0A1B2B" floodOpacity="0.18"/>
            </filter>
          </defs>
          
          {/* Button shape */}
          <rect x="3" y="3" rx="12" ry="12" width="274" height="54" fill="url(#quizGenGradStatic)" filter="url(#quizGenShadowStatic)"/>
          
          {/* Robot icon */}
          <g id="robot" transform="translate(25,30) scale(0.3)">
            {/* Antenna */}
            <circle cx="-10" cy="-58" r="8" fill="#1EE6D6"/>
            <rect x="-12" y="-48" rx="4" ry="4" width="4" height="16" fill="#1EE6D6"/>
            
            {/* Head outer */}
            <rect x="-80" y="-40" width="140" height="100" rx="28" ry="28" fill="#1EE6D6"/>
            
            {/* Side ears */}
            <rect x="-98" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
            <rect x="60" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
            
            {/* Face window */}
            <rect x="-60" y="-20" width="100" height="60" rx="18" ry="18" fill="#0A1B2B"/>
            
            {/* Eyes */}
            <circle cx="-32" cy="4" r="7" fill="#1EE6D6"/>
            <circle cx="8" cy="4" r="7" fill="#1EE6D6"/>
            
            {/* Smile */}
            <path d="M -36 20 Q -26 32 -16 20" fill="none" stroke="#1EE6D6" strokeWidth="4" strokeLinecap="round"/>
            
            {/* Neck */}
            <rect x="-40" y="60" width="60" height="10" rx="5" ry="5" fill="#11BDB0"/>
            
            {/* Base */}
            <path d="M -70 70 h 120 a 20 20 0 0 1 0 40 h -120 a 20 20 0 0 1 0 -40 z" fill="#1EE6D6"/>
          </g>
          
          {/* Text */}
          <text x="140" y="22" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
            fontWeight="700" fontSize="12" fill="#FFFFFF" textAnchor="middle">학년별 맞춤</text>
          <text x="140" y="42" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
            fontWeight="700" fontSize="12" fill="#FFFFFF" textAnchor="middle">AI퀴즈 생성하기</text>
        </svg>
      )}
    </button>
  );
};

export default QuizGenerateButton;
