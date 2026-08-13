import type { ProfileEntity } from '../domain/types';
import type { ProfileDto } from '../schemas';

export function profileToDto(profile: ProfileEntity): ProfileDto {
  return {
    id: profile.id,
    tag: profile.tag,
    displayName: profile.displayName,
    age: profile.age,
    gender: profile.gender,
    countryCode: profile.countryCode,
    skillLevel: profile.skillLevel,
    createdAt: profile.createdAt.toISOString(),
  };
}
