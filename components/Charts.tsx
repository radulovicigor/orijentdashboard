"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

/* Validirana paleta za tamnu podlogu (dataviz validator: sve provjere prolaze). */
const S1 = "#ad8838";
const S2 = "#7c8fd9";
const GRID = "rgba(238,226,206,0.07)";
const AXIS = "#8b8276";

const fmtEur = (v: number) => `${v.toLocaleString("sr-Latn-ME", { maximumFractionDigits: 0 })} €`;
const fmtNum = (v: number) => v.toLocaleString("sr-Latn-ME", { maximumFractionDigits: 0 });
const shortDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}.${m}.`;
};

const axis = { stroke: "transparent", tick: { fill: AXIS, fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: {
    background: "#171512",
    border: "1px solid rgba(238,226,206,0.14)",
    borderRadius: 10,
    fontSize: 12,
    padding: "10px 12px",
    boxShadow: "0 14px 40px rgba(0,0,0,.45)",
  },
  labelStyle: { color: "#f2ece1", marginBottom: 6, fontWeight: 600 },
  itemStyle: { padding: "1px 0" },
  cursor: { stroke: "rgba(238,226,206,0.18)", strokeWidth: 1 },
} as const;
const legend = { wrapperStyle: { fontSize: 11.5, color: AXIS, paddingTop: 14 }, iconType: "circle", iconSize: 7 } as const;

export function RevenueSpendChart({ data, hasRevenue }: { data: { date: string; spend: number; revenue: number | null }[]; hasRevenue: boolean }) {
  // Prihod i ulaganje su različitog reda veličine – zato dva grafika sa zajedničkom vremenskom osom,
  // nikad dvije y-ose na istom grafiku.
  return (
    <div>
      {hasRevenue && (
        <>
          <div className="chart-label rev">Prihod prodavnice</div>
          <div style={{ width: "100%", height: 186 }}>
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} syncId="dan">
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={S1} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={S1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={26} {...axis} hide />
                <YAxis tickFormatter={fmtEur} width={68} {...axis} />
                <Tooltip {...tip} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number, n: string) => [fmtEur(v), n]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Prihod prodavnice"
                  stroke={S1}
                  strokeWidth={2}
                  fill="url(#gRev)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#0a0908" }}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <div className="chart-label spend" style={{ marginTop: hasRevenue ? 18 : 0 }}>Uloženo u reklame</div>
      <div style={{ width: "100%", height: hasRevenue ? 132 : 250 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} syncId="dan">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={26} {...axis} />
            <YAxis tickFormatter={fmtEur} width={68} {...axis} />
            <Tooltip {...tip} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number, n: string) => [fmtEur(v), n]} />
            <Bar
              dataKey="spend"
              name="Uloženo u reklame"
              fill={S2}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrafficChart({ data }: { data: { date: string; linkClicks: number; landingPageViews: number }[] }) {
  return (
    <div style={{ width: "100%", height: 244 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={26} {...axis} />
          <YAxis tickFormatter={fmtNum} width={44} {...axis} />
          <Tooltip {...tip} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number, n: string) => [fmtNum(v), n]} />
          <Legend {...legend} />
          <Bar dataKey="linkClicks" name="Klikovi na link" fill={S2} radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={700} animationEasing="ease-out" />
          <Line
            type="monotone"
            dataKey="landingPageViews"
            name="Posjete sajtu"
            stroke={S1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#0a0908" }}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgeGenderChart({ data }: { data: { age: string; female: number; male: number }[] }) {
  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="age" {...axis} />
          <YAxis tickFormatter={fmtNum} width={52} {...axis} />
          <Tooltip {...tip} formatter={(v: number, n: string) => [`${fmtNum(v)} impresija`, n]} />
          <Legend {...legend} />
          <Bar dataKey="female" name="Žene" fill={S1} radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={700} animationEasing="ease-out" />
          <Bar dataKey="male" name="Muškarci" fill={S2} radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignSpendChart({ data }: { data: { date: string; spend: number }[] }) {
  return (
    <div style={{ width: "100%", height: 120 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={26} {...axis} />
          <YAxis tickFormatter={fmtEur} width={60} {...axis} />
          <Tooltip {...tip} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number) => [fmtEur(v), "Uloženo"]} />
          <Bar dataKey="spend" name="Uloženo" fill={S2} radius={[3, 3, 0, 0]} maxBarSize={12} animationDuration={600} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({ data }: { data: { date: string; newCustomers: number; returningCustomers: number }[] }) {
  return (
    <div style={{ width: "100%", height: 196 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={26} {...axis} />
          <YAxis allowDecimals={false} width={28} {...axis} />
          <Tooltip {...tip} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number, n: string) => [fmtNum(v), n]} />
          <Legend {...legend} />
          <Bar dataKey="newCustomers" name="Novi kupci" stackId="k" fill={S1} radius={[0, 0, 0, 0]} maxBarSize={14} animationDuration={700} animationEasing="ease-out" />
          <Bar dataKey="returningCustomers" name="Povratni kupci" stackId="k" fill={S2} radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourlyOrdersChart({ data }: { data: { hour: number; orders: number }[] }) {
  const fmtHour = (h: number) => `${h}h`;
  return (
    <div style={{ width: "100%", height: 196 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="hour" tickFormatter={fmtHour} interval={1} {...axis} />
          <YAxis allowDecimals={false} width={28} {...axis} />
          <Tooltip {...tip} labelFormatter={(l) => fmtHour(Number(l))} formatter={(v: number) => [fmtNum(v), "Porudžbine"]} />
          <Bar dataKey="orders" name="Porudžbine" fill={S1} radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekdayChart({ data, hasRevenue }: { data: { day: string; revenue: number; spend: number }[]; hasRevenue: boolean }) {
  // Prihod i ulaganje su različitog reda veličine – isti princip kao RevenueSpendChart: dva grafika, zajednička osa dana.
  return (
    <div>
      {hasRevenue && (
        <>
          <div className="chart-label rev">Prihod prodavnice</div>
          <div style={{ width: "100%", height: 130 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} syncId="dan-u-sedmici">
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" {...axis} hide />
                <YAxis tickFormatter={fmtEur} width={68} {...axis} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [fmtEur(v), n]} />
                <Bar dataKey="revenue" name="Prihod prodavnice" fill={S1} radius={[3, 3, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <div className="chart-label spend" style={{ marginTop: hasRevenue ? 18 : 0 }}>Uloženo u reklame</div>
      <div style={{ width: "100%", height: hasRevenue ? 130 : 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} syncId="dan-u-sedmici">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...axis} />
            <YAxis tickFormatter={fmtEur} width={68} {...axis} />
            <Tooltip {...tip} formatter={(v: number, n: string) => [fmtEur(v), n]} />
            <Bar dataKey="spend" name="Uloženo u reklame" fill={S2} radius={[3, 3, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
