/**
 * Сплит стоимости поля. Только целые числа (минимальные единицы валюты).
 * Каждый платит поровну с округлением вверх — поле должно быть оплачено полностью.
 */
export interface PriceSplit {
  totalMinor: number;
  payersCount: number;
  /** null — платить пока некому (нет подтверждённых игроков). */
  perPersonMinor: number | null;
}

export function splitPrice(totalMinor: number, confirmedCount: number): PriceSplit {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    throw new Error(`Некорректная стоимость: ${totalMinor}`);
  }
  if (totalMinor === 0 || confirmedCount <= 0) {
    return {
      totalMinor,
      payersCount: Math.max(0, confirmedCount),
      perPersonMinor: totalMinor === 0 ? 0 : null,
    };
  }
  return {
    totalMinor,
    payersCount: confirmedCount,
    perPersonMinor: Math.ceil(totalMinor / confirmedCount),
  };
}
