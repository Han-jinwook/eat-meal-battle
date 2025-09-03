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
      await navigator.clipboard.writeText(prompt);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        onClose();
        // AI 앱 열기
        window.open(appUrl, '_blank');
      }, 1500);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 복사 실패 시에도 앱은 열어줌
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
            iOS는 보안상 자동 복사가 제한됩니다.<br/>
            아래 버튼을 눌러 복사한 후 {appName}에서 붙여넣기하세요.
          </p>

          <div className="bg-gray-50 p-3 rounded-lg mb-4 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {prompt.substring(0, 200)}...
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                copySuccess 
                  ? 'bg-green-500 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              disabled={copySuccess}
            >
              {copySuccess ? '✅ 복사 완료!' : '📋 복사하기'}
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
