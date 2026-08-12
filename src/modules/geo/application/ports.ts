export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Geocoder {
  /** Координаты по текстовому запросу; null — не нашлось или сервис недоступен. */
  lookup(query: string): Promise<Coordinates | null>;
}
