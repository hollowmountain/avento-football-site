'use client';

import { useState } from 'react';
import { clubById } from '../clubs';

/** Значок клуба: картинка из /clubs, при её отсутствии — монограмма. */
export function ClubBadge({
  clubId,
  size = 16,
  className = '',
}: {
  clubId: string;
  size?: number;
  className?: string;
}) {
  const club = clubById(clubId);
  const [broken, setBroken] = useState(false);
  if (club === null) return null;

  if (broken) {
    return (
      <span
        className={`bg-secondary text-secondary-foreground inline-flex shrink-0 items-center justify-center rounded-full text-center font-bold ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(7, size * 0.34) }}
        title={club.name}
        aria-label={club.name}
      >
        {club.mono}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- крошечный статичный значок, next/image избыточен
    <img
      src={`/clubs/${club.id}.png`}
      alt={club.name}
      title={club.name}
      width={size}
      height={size}
      className={`inline-block shrink-0 align-[-3px] ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
