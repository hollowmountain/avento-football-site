/** Доменные типы профиля. Слой ни от чего не зависит. */

export type Gender = 'MALE' | 'FEMALE';

/** Уровень игрока (совпадает с enum Prisma; ANY — «не указан»). */
export type ProfileSkillLevel =
  'ANY' | 'BEGINNER' | 'AMATEUR' | 'INTERMEDIATE' | 'ADVANCED' | 'SEMI_PRO' | 'PRO';

export interface ProfileEntity {
  id: string;
  tag: string;
  displayName: string;
  age: number | null;
  gender: Gender | null;
  /** ISO 3166-1 alpha-2 в нижнем регистре — флаг «для красоты». */
  countryCode: string | null;
  /** Любимый клуб (id из палитры клубов). */
  club: string | null;
  /** Уровень игрока: подставляется при записи, участвует в жеребьёвке. */
  skillLevel: ProfileSkillLevel;
  createdAt: Date;
  updatedAt: Date;
}
