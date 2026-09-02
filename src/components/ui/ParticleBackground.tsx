import { useMemo } from 'react';

interface ParticleBackgroundProps {
  count?: number;
}

export default function ParticleBackground({ count = 30 }: ParticleBackgroundProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        duration: `${8 + Math.random() * 12}s`,
        delay: `${Math.random() * 5}s`,
        tx: `${(Math.random() - 0.5) * 100}px`,
        ty: `${(Math.random() - 0.5) * 80}px`,
      })),
    [count]
  );

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            '--duration': p.duration,
            '--delay': p.delay,
            '--tx': p.tx,
            '--ty': p.ty,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
