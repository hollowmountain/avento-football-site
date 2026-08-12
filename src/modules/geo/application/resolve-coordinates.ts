import type { Coordinates, Geocoder } from './ports';

export interface ResolveCoordinatesInput {
  venueName: string;
  address: string;
  city: string;
}

/**
 * Координаты площадки по человеческому адресу.
 * Пробуем от точного к общему: «площадка, адрес, город» → «адрес, город» → «город».
 * Так игра создаётся даже когда дом не найден: точка будет по городу,
 * а дедуп и погода останутся осмысленными.
 */
export async function resolveCoordinates(
  geocoder: Geocoder,
  input: ResolveCoordinatesInput,
): Promise<Coordinates | null> {
  const queries = [
    `${input.venueName}, ${input.address}, ${input.city}`,
    `${input.address}, ${input.city}`,
    input.city,
  ];

  for (const query of queries) {
    const found = await geocoder.lookup(query);
    if (found) return found;
  }
  return null;
}
