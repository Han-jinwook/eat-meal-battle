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
    >
      <span className="mr-1">
        {isLiked ? (
          <span className="text-yellow-500">👍</span>
        ) : (
          <span className="text-gray-400">👍</span>
        )}
      </span>
      <span className="text-xs text-gray-700">{count}</span>
    </button>
  );
}
