"use client";

interface RepBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function RepBadge({ score, size = 'md', showLabel = true }: RepBadgeProps) {
  const getBadgeStyle = (score: number) => {
    if (score >= 1000) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (score >= 500) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 200) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 100) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
    }
  };

  const getIcon = (score: number) => {
    if (score >= 1000) return '👑';
    if (score >= 500) return '⭐';
    if (score >= 200) return '🏆';
    if (score >= 100) return '🌟';
    return '💫';
  };

  return (
    <div className={`inline-flex items-center space-x-1 border rounded-full font-medium ${getBadgeStyle(score)} ${getSizeClasses(size)}`}>
      <span>{getIcon(score)}</span>
      <span>{score}</span>
      {showLabel && <span className="hidden sm:inline">rep</span>}
    </div>
  );
} 