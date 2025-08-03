import React from 'react';
import Image from 'next/image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealDate: string;
  schoolName: string;
  rating?: number; // 선택적으로 변경
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  mealDate,
  schoolName,
  rating,
}) => {
  if (!isOpen) return null;

  // 날짜 포맷 변환 (YYYY-MM-DD -> YYYY-MM-DD 급식)
  const formattedDate = `${mealDate} 급식`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-sm mx-4">
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">급식 공유하기</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* 이미지 미리보기 영역 */}
          <div className="relative bg-purple-600 rounded-md text-white p-4 h-32 mb-4 flex flex-col justify-center items-center">
            <div className="absolute top-2 right-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
              </svg>
            </div>
            <div className="w-16 h-16 bg-white rounded-full mb-1"></div>
            <div className="text-center">
              <div className="font-bold">{formattedDate}</div>
              <div className="text-sm">{schoolName}</div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-center text-gray-600 text-sm">
              오늘 먹은 급식의 맛평가를 친구들과 함께 하기
            </p>
          </div>

          {/* 공유 버튼들 */}
          <button className="w-full py-3 bg-yellow-400 text-black font-medium rounded-md flex items-center justify-center">
            <span className="mr-2">•</span> 카카오톡으로 공유하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
