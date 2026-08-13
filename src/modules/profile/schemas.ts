import { z } from 'zod';
import { TAG_MAX, TAG_MIN, isValidTag, normalizeTag } from './domain/tag';

/** Zod DTO профиля — общие для клиента и сервера. */

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

const displayNameSchema = z
  .string()
  .transform((s) => s.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(2, 'минимум 2 симв.').max(60, 'максимум 60 симв.'));

export const tagSchema = z
  .string()
  .transform(normalizeTag)
  .pipe(
    z
      .string()
      .min(TAG_MIN, `минимум ${TAG_MIN} симв.`)
      .max(TAG_MAX, `максимум ${TAG_MAX} симв.`)
      .refine(isValidTag, 'латиница, цифры и «_»; начинается с буквы'),
  );

export const GENDERS = ['MALE', 'FEMALE'] as const;

export const profileBodySchema = z.object({
  displayName: displayNameSchema,
  tag: tagSchema,
  age: z.coerce.number().int().min(6, 'минимум 6').max(99, 'максимум 99').nullish(),
  gender: z.enum(GENDERS).nullish(),
});

export const loginBodySchema = z.object({
  code: z.string().trim().min(16, 'слишком короткий код').max(128),
});

export type ProfileBody = z.infer<typeof profileBodySchema>;

export interface ProfileDto {
  id: string;
  tag: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  createdAt: string;
}
