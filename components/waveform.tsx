'use client';

import { useEffect, useState } from 'react';

export function Waveform({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    const count = 32;
    const initial = Array.from({ length: count }, () => 0.3);
    setBars(initial);

    if (!active) return;

    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map(() => {
          const base = 0.25;
          const variance = Math.random() * 0.75;
          return Math.min(1, base + variance);
        })
      );
    }, 120);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {bars.map((h, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${Math.max(8, h * 56)}px`,
            animationDelay: `${(i % 8) * 80}ms`,
            animationDuration: `${600 + (i % 5) * 100}ms`,
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
