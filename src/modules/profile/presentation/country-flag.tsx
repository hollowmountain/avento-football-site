/**
 * SVG-флаг из /public/flags (набор flag-icons, соотношение 4×3).
 * Эмодзи-флаги на Windows рендерятся буквами — SVG выглядит одинаково везде.
 */
export function FlagIcon({
  code,
  width = 20,
  className = '',
}: {
  code: string;
  width?: number;
  className?: string;
}) {
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- крошечный статичный флаг
    <img
      src={`/flags/${normalized}.svg`}
      alt=""
      aria-hidden
      width={width}
      height={Math.round(width * 0.75)}
      className={`inline-block shrink-0 rounded-[2px] align-[-2px] ${className}`}
    />
  );
}
