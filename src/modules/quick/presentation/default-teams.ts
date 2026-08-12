import type { QuickTeamColorId } from '../domain/types';

/** Порядок цветов по умолчанию: манишки — жёлтые, зелёные, красные. */
export const DEFAULT_TEAM_COLORS: readonly QuickTeamColorId[] = ['amber', 'green', 'coral'];

export function defaultTeams(
  nameFor: (colorId: QuickTeamColorId) => string,
  count: 2 | 3,
): { name: string; colorId: QuickTeamColorId }[] {
  return DEFAULT_TEAM_COLORS.slice(0, count).map((colorId) => ({
    name: nameFor(colorId),
    colorId,
  }));
}
