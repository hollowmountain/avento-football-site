/**
 * Палитра любимых клубов. Значки лежат в /public/clubs/<id>.png
 * (квадрат, прозрачный фон); пока файла нет — ClubBadge показывает
 * монограмму, поэтому код не зависит от наличия картинок.
 */
export interface ClubPreset {
  id: string;
  name: string;
  /** Монограмма для заглушки, 2–3 символа. */
  mono: string;
}

export const CLUBS: readonly ClubPreset[] = [
  { id: 'barcelona', name: 'Барселона', mono: 'FCB' },
  { id: 'real-madrid', name: 'Реал Мадрид', mono: 'RM' },
  { id: 'atletico', name: 'Атлетико', mono: 'ATM' },
  { id: 'manchester-united', name: 'Манчестер Юнайтед', mono: 'MU' },
  { id: 'liverpool', name: 'Ливерпуль', mono: 'LFC' },
  { id: 'chelsea', name: 'Челси', mono: 'CFC' },
  { id: 'arsenal', name: 'Арсенал', mono: 'AFC' },
  { id: 'psg', name: 'ПСЖ', mono: 'PSG' },
  { id: 'bayern', name: 'Бавария', mono: 'FCB' },
  { id: 'borussia-dortmund', name: 'Боруссия Д', mono: 'BVB' },
  { id: 'inter', name: 'Интер', mono: 'INT' },
  { id: 'inter-miami', name: 'Интер Майами', mono: 'MIA' },
  { id: 'al-nassr', name: 'Аль-Наср', mono: 'NSR' },
  { id: 'al-hilal', name: 'Аль-Хиляль', mono: 'HLL' },
  { id: 'zenit', name: 'Зенит', mono: 'ЗЕН' },
  { id: 'cska', name: 'ЦСКА', mono: 'ЦСК' },
  { id: 'krasnodar', name: 'Краснодар', mono: 'КРД' },
  { id: 'akhmat', name: 'Ахмат', mono: 'АХТ' },
  { id: 'astana', name: 'Астана', mono: 'АСТ' },
];

export const CLUB_IDS = CLUBS.map((club) => club.id);

export function clubById(id: string | null): ClubPreset | null {
  if (id === null) return null;
  return CLUBS.find((club) => club.id === id) ?? null;
}
