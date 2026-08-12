'use client';

import { ImageDown, Share2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { computeStandings } from '../domain/standings';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { QuickDay } from './quick-day-store';
import { CARD_MATCH_LIMIT, renderResultCard } from './share-card';
import { teamColorHex } from './team-colors';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Публикация: текст итогов в чат + карточка результата картинкой. */
export function ShareSection({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.share');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const [busy, setBusy] = useState(false);

  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const dateLabel = format.dateTime(new Date(day.startedAt), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const buildText = (): string => {
    const rows = computeStandings(
      day.teams.map((team) => team.id),
      day.matches,
    );
    const lines: string[] = [t('textTitle', { date: dateLabel }), '', t('matchesTitle')];
    day.matches.forEach((match, index) => {
      const home = teamById.get(match.homeId)?.name ?? '?';
      const away = teamById.get(match.awayId)?.name ?? '?';
      lines.push(`${index + 1}. ${home} ${match.homeGoals}:${match.awayGoals} ${away}`);
    });
    lines.push('', t('tableTitle'));
    rows.forEach((row, index) => {
      const team = teamById.get(row.teamId);
      if (team === undefined) return;
      lines.push(
        t('tableLine', {
          rank: index + 1,
          team: team.name,
          points: row.points,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
        }),
      );
    });
    return lines.join('\n');
  };

  const shareText = async () => {
    const text = buildText();
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
    } catch (error) {
      if (isAbortError(error)) return;
      // share не взлетел (например, http без TLS) — падаем в буфер обмена
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copied'));
    } catch {
      toast.error(t('failed'));
    }
  };

  const shareCard = async () => {
    setBusy(true);
    try {
      const rows = computeStandings(
        day.teams.map((team) => team.id),
        day.matches,
      );
      const hiddenMatches = day.matches.length - CARD_MATCH_LIMIT;
      const blob = await renderResultCard({
        eyebrow: t('cardEyebrow'),
        dateLabel,
        title: t('cardTitle'),
        standings: rows.flatMap((row) => {
          const team = teamById.get(row.teamId);
          if (team === undefined) return [];
          return [
            {
              name: team.name,
              color: teamColorHex(team.colorId),
              wins: row.wins,
              draws: row.draws,
              losses: row.losses,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              points: row.points,
            },
          ];
        }),
        matchesTitle: t('matchesTitle').replace(':', ''),
        matches: day.matches.map((match) => {
          const home = teamById.get(match.homeId);
          const away = teamById.get(match.awayId);
          return {
            home: home?.name ?? '?',
            homeColor: home !== undefined ? teamColorHex(home.colorId) : '#f2ede3',
            away: away?.name ?? '?',
            awayColor: away !== undefined ? teamColorHex(away.colorId) : '#f2ede3',
            homeGoals: match.homeGoals,
            awayGoals: match.awayGoals,
          };
        }),
        moreLabel: hiddenMatches > 0 ? t('cardMore', { count: hiddenMatches }) : null,
        footer: tCommon('appName'),
      });

      const file = new File([blob], 'avento-quick-day.png', { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (error) {
          if (isAbortError(error)) return;
        }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('downloaded'));
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void shareText()}>
          <Share2 data-icon="inline-start" aria-hidden />
          {t('text')}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void shareCard()}>
          <ImageDown data-icon="inline-start" aria-hidden />
          {t('card')}
        </Button>
      </CardContent>
    </Card>
  );
}
