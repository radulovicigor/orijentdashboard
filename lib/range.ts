export type RangeKey = "7d" | "14d" | "30d" | "this_month" | "last_month" | "all";

// Marketing je preuzet 1. septembra 2026 – raniji podaci se ne prikazuju.
export const MIN_DATE = "2026-09-01";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 dana" },
  { key: "14d", label: "14 dana" },
  { key: "30d", label: "30 dana" },
  { key: "this_month", label: "Ovaj mjesec" },
  { key: "last_month", label: "Prošli mjesec" },
  { key: "all", label: "Sve" },
];

export interface DateRange {
  key: RangeKey;
  since: string;
  until: string;
  /** true kada je period skraćen jer počinje prije 1.9.2026. */
  clamped: boolean;
  label: string;
}

const TZ = "Europe/Podgorica";

function todayParts(): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function iso(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function resolveRange(input?: string): DateRange {
  const key = (RANGES.find((r) => r.key === input)?.key ?? "30d") as RangeKey;
  const { y, m, d } = todayParts();
  const today = new Date(Date.UTC(y, m - 1, d));
  let since: Date;
  let until: Date = today;
  switch (key) {
    case "7d":
    case "14d":
    case "30d": {
      const n = parseInt(key, 10);
      since = new Date(today);
      since.setUTCDate(since.getUTCDate() - (n - 1));
      break;
    }
    case "this_month":
      since = new Date(Date.UTC(y, m - 1, 1));
      break;
    case "last_month":
      since = new Date(Date.UTC(y, m - 2, 1));
      until = new Date(Date.UTC(y, m - 1, 0));
      break;
    case "all":
      since = new Date(MIN_DATE + "T00:00:00Z");
      break;
  }
  let s = iso(since);
  let clamped = false;
  if (s < MIN_DATE) {
    s = MIN_DATE;
    clamped = true;
  }
  return { key, since: s, until: iso(until), clamped, label: RANGES.find((r) => r.key === key)!.label };
}

/** Previous period of equal length, for comparison. */
/** Prethodni period iste dužine; prazan ako pada prije 1.9.2026. */
export function previousRange(r: DateRange): { since: string; until: string } {
  const s = new Date(r.since + "T00:00:00Z");
  const u = new Date(r.until + "T00:00:00Z");
  const days = Math.round((u.getTime() - s.getTime()) / 86400000) + 1;
  const pu = new Date(s);
  pu.setUTCDate(pu.getUTCDate() - 1);
  const ps = new Date(pu);
  ps.setUTCDate(ps.getUTCDate() - (days - 1));
  // Prije 1.9.2026 nema našeg marketinga – tada nema ni poređenja.
  if (iso(pu) < MIN_DATE) return { since: "2000-01-01", until: "2000-01-01" };
  return { since: iso(ps) < MIN_DATE ? MIN_DATE : iso(ps), until: iso(pu) };
}

export function eachDay(since: string, until: string): string[] {
  const out: string[] = [];
  const d = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");
  while (d <= end) {
    out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
