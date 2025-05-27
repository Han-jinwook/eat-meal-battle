'use client';

interface LikeButtonProps {
  count: number;
  isLiked: boolean;
  onToggle: () => void;
}

export default function LikeButton({ count, isLiked, onToggle }: LikeButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center text-sm ${
        isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
      }`}
    >
      <span className="mr-1">{isLiked ? '❤️' : '🤍'}</span>
      <span>{count > 0 ? count : '좋아요'}</span>
    </button>
  );
}
