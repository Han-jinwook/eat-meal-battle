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
        isLiked ? 'bg-pink-50 text-black font-medium' : 'text-gray-600 hover:text-gray-900'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} px-2 py-1 rounded-md`}
    >
      <span className="mr-1">{isLiked ? '👍' : '👍'}</span>
      <span>{count}</span>
    </button>
  );
}
