import { VOTES_PER_CATEGORY } from '../../lib/constants';

interface ProgressIndicatorProps {
  allocated: number;
  total?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export default function ProgressIndicator({
  allocated,
  total = VOTES_PER_CATEGORY,
  size = 'md',
  showLabel = true,
  className = '',
}: ProgressIndicatorProps) {
  const percentage = (allocated / total) * 100;
  const isComplete = allocated === total;

  const sizeConfig = {
    sm: { ring: 48, stroke: 4, text: 'text-xs', label: 'text-[10px]' },
    md: { ring: 64, stroke: 5, text: 'text-lg', label: 'text-xs' },
    lg: { ring: 80, stroke: 6, text: 'text-2xl', label: 'text-sm' },
  };

  const config = sizeConfig[size];
  const radius = (config.ring - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: config.ring, height: config.ring }}>
        {/* Background ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${config.ring} ${config.ring}`}>
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-surface-700"
          />
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop
                offset="0%"
                stopColor={isComplete ? '#10b981' : '#6366f1'}
              />
              <stop
                offset="100%"
                stopColor={isComplete ? '#34d399' : '#a855f7'}
              />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold tabular-nums ${config.text} ${
            isComplete ? 'text-emerald-400' : 'text-white'
          }`}>
            {allocated}
          </span>
        </div>
      </div>

      {showLabel && (
        <span className={`font-medium ${config.label} ${
          isComplete ? 'text-emerald-400' : 'text-surface-400'
        }`}>
          {isComplete ? '✓ Complete' : `of ${total}`}
        </span>
      )}
    </div>
  );
}
