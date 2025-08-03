import React from 'react';

interface ShareButtonProps {
  onClick: () => void;
  className?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ onClick, className = '' }) => {
  return (
    <div className={`my-4 flex justify-end ${className}`}>
      <button
        onClick={onClick}
        className="w-1/2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
        </svg>
        급식평가 공유하기
      </button>
    </div>
  );
};

export default ShareButton;
