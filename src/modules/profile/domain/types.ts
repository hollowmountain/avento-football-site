/** Доменные типы профиля. Слой ни от чего не зависит. */

export type Gender = 'MALE' | 'FEMALE';

export interface ProfileEntity {
  id: string;
  tag: string;
  displayName: string;
  age: number | null;
  gender: Gender | null;
  createdAt: Date;
  updatedAt: Date;
}
