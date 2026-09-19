const nf0 = new Intl.NumberFormat("sr-Latn-ME", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("sr-Latn-ME", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const eur = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : `${nf2.format(v)} €`);
export const eur0 = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : `${nf0.format(v)} €`);
export const num = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : nf0.format(v));
export const dec = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? "—" : new Intl.NumberFormat("sr-Latn-ME", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const pct = (v: number | null | undefined, d = 2) => (v == null || !isFinite(v) ? "—" : `${dec(v, d)}%`);
export const roas = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : `${dec(v, 2)}×`);

export function safeDiv(a: number, b: number): number | null {
  return b ? a / b : null;
}

export function change(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function shortDate(isoDate: string) {
  const [, m, d] = isoDate.split("-");
  return `${d}.${m}.`;
}
