import React from 'react';
import Image from 'next/image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealDate: string;
  schoolName: string;
  rating: number;
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
          <p className="text-center text-gray-600 text-sm mb-4">
            친구들에게 오늘의 급식을 공유해보세요.
          </p>

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

          {/* 평점 정보 */}
          <div className="mb-4">
            <p className="text-center font-medium mb-1">오늘의 급식 평점</p>
            <div className="flex justify-center items-center mb-2">
              <span className="text-2xl font-bold mr-2">{rating.toFixed(1)}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg 
                    key={star}
                    className={`w-5 h-5 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`} 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-center text-gray-500 text-sm">
              아래 버튼을 클릭하여 급식 정보를 공유하세요.
            </p>
            <p className="text-center text-gray-500 text-sm">
              친구들과 함께 급식을 평가할 수 있습니다.
            </p>
          </div>

          {/* 공유 버튼들 */}
          <button className="w-full py-3 bg-yellow-400 text-black font-medium rounded-md flex items-center justify-center mb-2">
            <span className="mr-2">•</span> 카카오톡으로 공유하기
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-md"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
