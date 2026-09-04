import { useState, useEffect } from 'react';
import { getInitials } from '../../lib/utils';

export interface TeacherAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  rounded?: 'lg' | 'xl' | '2xl' | 'full';
  border?: boolean;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-xs sm:text-sm',
  lg: 'w-14 h-14 text-sm sm:text-base font-bold',
  xl: 'w-20 h-20 text-lg sm:text-xl font-bold',
  '2xl': 'w-32 h-32 sm:w-40 sm:h-40 text-3xl sm:text-4xl font-extrabold',
};

const roundedClasses = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

const avatarGradients = [
  'from-indigo-500 to-indigo-700',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700',
  'from-emerald-500 to-emerald-700',
  'from-violet-500 to-violet-700',
  'from-cyan-500 to-cyan-700',
  'from-pink-500 to-pink-700',
  'from-teal-500 to-teal-700',
];

function getGradientIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % avatarGradients.length;
}

export default function TeacherAvatar({
  name,
  photoUrl,
  size = 'md',
  className = '',
  rounded = 'xl',
  border = true,
}: TeacherAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error state if photoUrl changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [photoUrl]);

  const cleanUrl = photoUrl?.trim();
  const showImage = Boolean(cleanUrl && !hasError);
  const gradientClass = avatarGradients[getGradientIndex(name || 'Teacher')];
  const sizeClass = sizeClasses[size];
  const roundClass = roundedClasses[rounded];
  const borderClass = border ? 'border border-white/15 shadow-sm' : '';

  if (showImage && cleanUrl) {
    return (
      <div
        className={`relative flex-shrink-0 overflow-hidden ${sizeClass} ${roundClass} ${borderClass} ${className} bg-surface-800`}
      >
        <img
          src={cleanUrl}
          alt={name}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {!isLoaded && (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold select-none`}
          >
            {getInitials(name)}
          </div>
        )}
      </div>
    );
  }

  // Fallback to stylish initial avatar
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradientClass} text-white font-bold select-none ${sizeClass} ${roundClass} ${borderClass} ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
