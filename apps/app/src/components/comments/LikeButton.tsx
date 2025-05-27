'use client';

interface LikeButtonProps {
  count: number;
  isLiked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function LikeButton({ count, isLiked, onToggle, disabled = false }: LikeButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center text-sm ${
        isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="mr-1">{isLiked ? '❤️' : '🤍'}</span>
      <span>{count > 0 ? count : '좋아요'}</span>
    </button>
  );
}
