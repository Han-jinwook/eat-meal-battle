'use client';

interface LikeButtonProps {
  count: number;
  isLiked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function LikeButton({ count, isLiked, onToggle, disabled = false }: LikeButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
    >
      <span className="mr-1 flex items-center justify-center w-5 h-5">
        {isLiked ? (
          // 좋아요 활성화 상태 - 채워진 아이콘
          <svg 
            viewBox="0 0 24 24" 
            className="w-5 h-5 fill-blue-600"
          >
            <path d="M7,22 L3,22 L3,10 L7,10 L7,22 Z M19.7507342,10.4137392 L14.2618608,10.4137392 L14.9110375,6.35765469 C15.1310205,4.93928291 14.06216,3.66896766 12.7595814,3.18316087 C12.5176311,3.09761964 12.2590594,3.04519397 12,3.04519397 C11.3357497,3.04519397 10.738532,3.43708398 10.4594998,4.02922829 L7.1282278,10 L10,10 L10,19.5 C10.8370479,19.5 11.5426519,19.5 12.0000108,19.5 C12.5624172,19.5 13.1374733,19.4344721 13.7251792,19.3033241 C14.5511793,19.1178695 21,17.9572276 21,17.9572276 L21,12.0643062 C21,12.0643062 20.7096832,10.7093823 19.7507342,10.4137392 Z" />
          </svg>
        ) : (
          // 좋아요 비활성화 상태 - 테두리만 있는 아이콘
          <svg 
            viewBox="0 0 24 24" 
            className="w-5 h-5 stroke-gray-500 fill-none"
            strokeWidth="1.5"
          >
            <path d="M7,22 L3,22 L3,10 L7,10 L7,22 Z M19.7507342,10.4137392 L14.2618608,10.4137392 L14.9110375,6.35765469 C15.1310205,4.93928291 14.06216,3.66896766 12.7595814,3.18316087 C12.5176311,3.09761964 12.2590594,3.04519397 12,3.04519397 C11.3357497,3.04519397 10.738532,3.43708398 10.4594998,4.02922829 L7.1282278,10 L10,10 L10,19.5 C10.8370479,19.5 11.5426519,19.5 12.0000108,19.5 C12.5624172,19.5 13.1374733,19.4344721 13.7251792,19.3033241 C14.5511793,19.1178695 21,17.9572276 21,17.9572276 L21,12.0643062 C21,12.0643062 20.7096832,10.7093823 19.7507342,10.4137392 Z" />
          </svg>
        )}
      </span>
      <span className="text-xs text-gray-700">{count}</span>
    </button>
  );
}
