'use client';

import { useState } from 'react';

interface IOSCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  appName: string;
  appUrl: string;
}

export default function IOSCopyModal({ isOpen, onClose, prompt, appName, appUrl }: IOSCopyModalProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      // iOS에서 더 확실한 복사 방법 사용
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(prompt);
        console.log('✅ Clipboard API로 복사 성공');
      } else {
        // Fallback: 텍스트 영역 생성해서 복사
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ Fallback 방식으로 복사 성공');
      }
      
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        onClose();
        // AI 앱 열기
        window.open(appUrl, '_blank');
      }, 1500);
    } catch (error) {
      console.error('❌ 클립보드 복사 실패:', error);
      // 복사 실패 시 수동 복사 안내
      alert('자동 복사에 실패했습니다. 텍스트를 수동으로 선택해서 복사해주세요.');
      onClose();
      window.open(appUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-center">
            📋 iOS 수동 복사
          </h3>
          
          <p className="text-sm text-gray-600 mb-4 text-center">
            <strong>텍스트를 터치해서 전체 선택 → 복사</strong><br/>
            그 다음 {appName}에서 붙여넣기하세요.
          </p>

          <div className="bg-gray-50 p-3 rounded-lg mb-4 max-h-40 overflow-y-auto">
            <textarea 
              readOnly
              value={prompt}
              className="w-full h-32 text-xs text-gray-700 bg-transparent border-none resize-none focus:outline-none"
              onClick={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.select();
                target.setSelectionRange(0, target.value.length);
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                onClose();
                window.open(appUrl, '_blank');
              }}
              className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors bg-blue-500 hover:bg-blue-600 text-white"
            >
              {appName} 웹 열기
            </button>
            
            <button
              onClick={() => {
                onClose();
                window.open(appUrl, '_blank');
              }}
              className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              건너뛰기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
