import { change, dec } from "@/lib/format";

export function Delta({ cur, prev, invert = false }: { cur?: number | null; prev?: number | null; invert?: boolean }) {
  const c = change(cur ?? null, prev ?? null);
  if (c == null) return null;
  const flat = Math.abs(c) < 0.5;
  const good = invert ? c < 0 : c > 0;
  return (
    <span className={`delta ${flat ? "flat" : good ? "up" : "down"}`}>
      {flat ? "±" : c > 0 ? "▲" : "▼"} {dec(Math.abs(c), 1)}%
    </span>
  );
}

export function Metric({
  label,
  value,
  cur,
  prev,
  invert,
  hint,
  foot,
  accent,
}: {
  label: string;
  value: string;
  cur?: number | null;
  prev?: number | null;
  invert?: boolean;
  hint?: string;
  foot?: string;
  accent?: boolean;
}) {
  const showDelta = cur !== undefined && prev !== undefined && prev !== null;
  return (
    <div className={`metric${accent ? " accent" : ""}`}>
      <div className={hint ? "label hint" : "label"} title={hint} data-tip={hint} tabIndex={hint ? 0 : undefined}>
        {label}
      </div>
      <div className="value">{value}</div>
      {(showDelta || foot) && (
        <div className="foot">
          {showDelta && <Delta cur={cur} prev={prev} invert={invert} />}
          {showDelta && <span>vs. prethodni period</span>}
          {!showDelta && foot}
        </div>
      )}
    </div>
  );
}

export function Bars({
  rows,
  value,
  format,
  sub,
}: {
  rows: { label: string }[];
  value: (r: any) => number;
  format: (v: number) => string;
  sub?: (r: any) => string;
}) {
  const max = Math.max(1, ...rows.map(value));
  if (!rows.length) return <p className="muted">Nema podataka za ovaj period.</p>;
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={r.label} style={{ "--i": i } as any}>
          <div className="line">
            <span>{r.label}</span>
            <span className="num">
              <b>{format(value(r))}</b>
              {sub && <span className="sub">{sub(r)}</span>}
            </span>
          </div>
          <div className="track">
            <div style={{ width: `${Math.max(1.5, (value(r) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<string, string> = {
  ACTIVE: "Aktivna",
  PAUSED: "Pauzirana",
  CAMPAIGN_PAUSED: "Pauzirana",
  ADSET_PAUSED: "Pauzirana",
  ARCHIVED: "Arhivirana",
  DELETED: "Obrisana",
  IN_PROCESS: "U obradi",
  WITH_ISSUES: "Problem",
  PENDING_REVIEW: "Na pregledu",
  DISAPPROVED: "Odbijena",
  COMPLETED: "Završena",
};

export function Status({ s }: { s: string }) {
  const label = STATUS[s] ?? (s === "UNKNOWN" ? "—" : s);
  return (
    <span className={`status${s === "ACTIVE" ? " active" : ""}`}>
      <i />
      {label}
    </span>
  );
}

export function Panel({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      {(title || note) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {note && <span className="note">{note}</span>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="section-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  );
}
