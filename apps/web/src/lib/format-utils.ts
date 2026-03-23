/** Scale an ingredient amount and format as a human-readable fraction string. */
export function scaleAmount(amount: number | undefined, multiplier: number): string {
  if (amount == null || amount === 0) return '';
  const scaled = amount * multiplier;
  if (scaled === Math.floor(scaled)) return String(scaled);
  const frac = scaled % 1;
  const whole = Math.floor(scaled);
  if (Math.abs(frac - 0.25) < 0.01) return whole > 0 ? `${whole} 1/4` : '1/4';
  if (Math.abs(frac - 0.33) < 0.04) return whole > 0 ? `${whole} 1/3` : '1/3';
  if (Math.abs(frac - 0.5) < 0.01) return whole > 0 ? `${whole} 1/2` : '1/2';
  if (Math.abs(frac - 0.67) < 0.04) return whole > 0 ? `${whole} 2/3` : '2/3';
  if (Math.abs(frac - 0.75) < 0.01) return whole > 0 ? `${whole} 3/4` : '3/4';
  return scaled.toFixed(1);
}
