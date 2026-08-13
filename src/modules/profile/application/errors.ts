/** Ошибки бизнес-логики профиля. Возвращаются значениями через Result. */
export type ProfileErrorCode =
  'TAG_TAKEN' | 'PROFILE_EXISTS' | 'PROFILE_NOT_FOUND' | 'BAD_LOGIN_CODE';

export interface ProfileError {
  code: ProfileErrorCode;
  message: string;
}

export function profileError(code: ProfileErrorCode, message: string): ProfileError {
  return { code, message };
}

export const PROFILE_ERROR_STATUS: Record<ProfileErrorCode, number> = {
  TAG_TAKEN: 409,
  PROFILE_EXISTS: 409,
  PROFILE_NOT_FOUND: 404,
  BAD_LOGIN_CODE: 401,
};
