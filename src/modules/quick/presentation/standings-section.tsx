'use client';

import { useTranslations } from 'next-intl';
import { computeStandings } from '../domain/standings';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { QuickDay } from './quick-day-store';
import { teamColorVar } from './team-colors';

/** Таблица дня: победа +3, ничья +1; очки → разница → забитые. */
export function StandingsSection({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.standings');
  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const rows = computeStandings(
    day.teams.map((team) => team.id),
    day.matches,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="eyebrow py-1.5 pr-2 font-medium">{t('team')}</th>
                {[t('played'), t('wins'), t('draws'), t('losses')].map((label, index) => (
                  <th key={index} className="eyebrow px-1.5 py-1.5 text-center font-medium">
                    {label}
                  </th>
                ))}
                <th className="eyebrow px-1.5 py-1.5 text-center font-medium">{t('goals')}</th>
                <th className="eyebrow px-1.5 py-1.5 text-center font-medium">{t('diff')}</th>
                <th className="eyebrow py-1.5 pl-1.5 text-right font-medium">{t('points')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = teamById.get(row.teamId);
                if (team === undefined) return null;
                return (
                  <tr key={row.teamId} className="border-b last:border-b-0">
                    <td className="max-w-32 py-2 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: teamColorVar(team.colorId) }}
                          aria-hidden
                        />
                        <span
                          className="display truncate text-base tracking-wide"
                          style={{ color: teamColorVar(team.colorId) }}
                        >
                          {team.name}
                        </span>
                      </span>
                    </td>
                    <td className="digits px-1.5 py-2 text-center">{row.played}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.wins}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.draws}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.losses}</td>
                    <td className="digits px-1.5 py-2 text-center whitespace-nowrap">
                      {row.goalsFor}:{row.goalsAgainst}
                    </td>
                    <td className="digits px-1.5 py-2 text-center">
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>
                    <td className="display digits text-lamp py-2 pl-1.5 text-right text-xl leading-none">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('rules')} {day.teams.length >= 3 ? t('drawRule') : null}
        </p>
      </CardContent>
    </Card>
  );
}
