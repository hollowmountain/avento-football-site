/** Доменные типы профиля. Слой ни от чего не зависит. */

export type Gender = 'MALE' | 'FEMALE';

export interface ProfileEntity {
  id: string;
  tag: string;
  displayName: string;
  age: number | null;
  gender: Gender | null;
  /** ISO 3166-1 alpha-2 в нижнем регистре — флаг «для красоты». */
  countryCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}
