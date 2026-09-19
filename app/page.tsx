import Link from "next/link";
import { loadDashboard } from "@/lib/data";
import { MIN_DATE, RANGES, resolveRange } from "@/lib/range";
import { dec, eur, eur0, num, pct, roas, safeDiv } from "@/lib/format";
import { Bars, Metric, Panel, SectionHead, Status } from "@/components/ui";
import { AgeGenderChart, OrdersChart, RevenueSpendChart, TrafficChart } from "@/components/Charts";

export const revalidate = 900;

export default async function Page({ searchParams }: { searchParams: Promise<{ r?: string; demo?: string }> }) {
  const sp = await searchParams;
  const range = resolveRange(sp.r);
  const forceDemo = sp.demo === "1";
  const d = await loadDashboard(range, forceDemo);
  const m = d.meta;
  const s = d.shopify;
  const t = m?.totals;
  const p = m?.prevTotals;
  const hasPrev = !!p && (p.spend > 0 || p.impressions > 0);
  const pv = <T,>(v: T) => (hasPrev ? v : undefined);

  const spend = t?.spend ?? 0;
  const revenue = s?.revenue ?? null;
  const blendedRoas = revenue != null && spend ? revenue / spend : null;
  const metaRoas = t ? safeDiv(t.purchaseValue, t.spend) : null;
  const profit = d.margin != null && revenue != null ? revenue * d.margin - spend : null;
  const roi = profit != null && spend ? (profit / spend) * 100 : null;
  const aov = s ? safeDiv(s.revenue, s.orders) : null;
  const ctr = t ? safeDiv(t.linkClicks * 100, t.impressions) : null;
  const cpc = t ? safeDiv(t.spend, t.linkClicks) : null;
  const cpm = t ? safeDiv(t.spend * 1000, t.impressions) : null;
  const cplpv = t ? safeDiv(t.spend, t.landingPageViews) : null;
  const pixelHasSales = !!t && (t.purchases > 0 || t.addToCart > 0);

  const shopDaily = new Map(s?.daily.map((x) => [x.date, x]) ?? []);
  const metaDaily = new Map(m?.daily.map((x) => [x.date, x]) ?? []);
  const days = s?.daily.map((x) => x.date) ?? m?.daily.map((x) => x.date) ?? [];
  const chart = days.map((date) => ({ date, spend: metaDaily.get(date)?.spend ?? 0, revenue: shopDaily.get(date)?.revenue ?? null }));

  const funnel = t
    ? [
        { label: "Impresije", v: t.impressions },
        { label: "Klikovi na link", v: t.linkClicks },
        { label: "Posjete sajtu", v: t.landingPageViews },
        ...(pixelHasSales
          ? [
              { label: "Dodato u korpu", v: t.addToCart },
              { label: "Započeta kupovina", v: t.initiateCheckout },
              { label: "Kupovine", v: t.purchases },
            ]
          : s
            ? [{ label: "Porudžbine", v: s.orders }]
            : []),
      ]
    : [];
  const fMax = Math.max(1, ...funnel.map((f) => f.v));

  const fmtD = (x: string) => x.split("-").reverse().join(".") + ".";
  const fmtDS = (x: string) => {
    const [, mm, dd] = x.split("-");
    return `${dd}.${mm}.`;
  };
  const fmtDT = (x: string) =>
    new Intl.DateTimeFormat("sr-Latn-ME", { timeZone: "Europe/Podgorica", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(x));
  const q = (r: string) => `/?r=${r}${forceDemo ? "&demo=1" : ""}`;

  return (
    <main className="wrap">
      <header>
        <div className="top">
          <div className="title-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Orijent parfimerija" className="logo" />
            <div className="period">
              {fmtD(range.since)} – {fmtD(range.until)} <span>· izvještaj o reklamama i prodaji</span>
            </div>
          </div>
          <div className="meta-line">
            <span>Prodaja: uživo</span>
            <span className="dot-sep">Meta reklame: {m?.lastSync ? `ažurirano ${fmtDT(m.lastSync)}` : "—"}</span>
            {process.env.DASHBOARD_PASSWORD ? (
              <span className="dot-sep">
                <a href="/api/logout">Odjava</a>
              </span>
            ) : null}
          </div>
        </div>
        <nav className="ranges">
          {RANGES.map((r) => (
            <Link key={r.key} href={q(r.key)} className={r.key === range.key ? "on" : ""} prefetch={false}>
              {r.label}
            </Link>
          ))}
        </nav>
      </header>

      {d.demo && <div className="banner">Demo prikaz sa izmišljenim brojevima.</div>}
      {d.metaError && <div className="banner err">Meta reklame: {d.metaError}</div>}
      {d.shopifyError && <div className="banner err">Prodavnica (Shopify): {d.shopifyError}</div>}
      {s?.truncated && <div className="banner">Period ima mnogo porudžbina, prikazan je dio. Izaberite kraći period za tačne brojke.</div>}

      <section>
        <SectionHead eyebrow="Pregled" title="Koliko je uloženo i šta se vratilo" sub="Prodaja dolazi iz Shopify prodavnice, ulaganje iz Meta reklama." />
        <div className="panel">
          <div className="hero">
            {s && <Metric accent label="Prihod prodavnice" value={eur(s.revenue)} cur={s.revenue} prev={pv(s.prevRevenue)} hint="Vrijednost svih porudžbina, bez otkazanih." />}
            {s && <Metric label="Porudžbine" value={num(s.orders)} cur={s.orders} prev={pv(s.prevOrders)} />}
            {t && <Metric label="Uloženo u reklame" value={eur(t.spend)} cur={t.spend} prev={pv(p?.spend)} hint="Ukupan trošak Meta reklama (Facebook i Instagram)." />}
            {s && t && <Metric accent label="Ukupni ROAS" value={roas(blendedRoas)} hint="Prihod prodavnice podijeljen sa ulaganjem u reklame. 4× znači 4 € prihoda na svaki uloženi euro." />}
          </div>
          <div className="metrics">
            {s && <Metric label="Prosječna korpa" value={eur(aov)} hint="Prosječna vrijednost jedne porudžbine." />}
            {s && <Metric label="Prodato komada" value={num(s.unitsSold)} foot={`${num(s.newCustomers)} novih · ${num(s.returningCustomers)} povratnih kupaca`} />}
            {s && (
              <Metric
                label="Prodaja sa Meta reklama"
                value={eur(s.metaRevenue)}
                foot={`${num(s.metaOrders)} porudžbina · ${pct(safeDiv(s.metaRevenue * 100, s.revenue), 0)} prihoda`}
                hint="Porudžbine gdje je kupac stigao sa Facebooka ili Instagrama."
              />
            )}
            {profit != null && <Metric label="Procijenjeni profit" value={eur(profit)} foot={`ROI ${pct(roi, 0)} · marža ${dec((d.margin ?? 0) * 100, 0)}%`} hint="Prihod × marža − ulaganje u reklame." />}
          </div>
        </div>

        {m && (
          <Panel title={s ? "Prihod i ulaganje po danu" : "Ulaganje u reklame po danu"} note={`${fmtD(range.since)} – ${fmtD(range.until)}`}>
            <RevenueSpendChart data={chart} hasRevenue={!!s} />
          </Panel>
        )}
      </section>

      {m && t && (
        <section>
          <SectionHead eyebrow="Meta reklame" title="Facebook i Instagram" sub="Koliko ljudi je vidjelo reklame, koliko ih je kliknulo i stiglo na sajt." />
          <div className="panel">
            <div className="metrics" style={{ borderTop: 0 }}>
              <Metric label="Impresije" value={num(t.impressions)} cur={t.impressions} prev={pv(p?.impressions)} hint="Koliko puta su reklame prikazane." />
              <Metric label="Doseg" value={m.reachKnown ? num(t.reach) : "—"} foot="različitih osoba" hint="Broj različitih ljudi koji su vidjeli reklamu." />
              <Metric label="Frekvencija" value={m.reachKnown ? dec(t.frequency) : "—"} foot="prikaza po osobi" />
              <Metric label="Klikovi na link" value={num(t.linkClicks)} cur={t.linkClicks} prev={pv(p?.linkClicks)} />
              <Metric label="CTR" value={pct(ctr)} hint="Procenat ljudi koji kliknu na reklamu koju vide." />
              <Metric label="Cijena po kliku" value={eur(cpc)} foot={`${eur(cpm)} za 1.000 prikaza`} hint="CPC — prosječna cijena jednog klika." />
              <Metric label="Posjete sajtu" value={num(t.landingPageViews)} cur={t.landingPageViews} prev={pv(p?.landingPageViews)} hint="Koliko puta se sajt učitao nakon klika." />
              <Metric label="Cijena po posjeti" value={eur(cplpv)} />
              {pixelHasSales && <Metric label="Kupovine (Meta)" value={num(t.purchases)} cur={t.purchases} prev={pv(p?.purchases)} />}
              {pixelHasSales && <Metric label="Vrijednost kupovina" value={eur(t.purchaseValue)} />}
              {pixelHasSales && <Metric label="Cijena po kupovini" value={eur(safeDiv(t.spend, t.purchases))} />}
              {pixelHasSales && <Metric label="ROAS (Meta)" value={roas(metaRoas)} />}
            </div>
          </div>

          <div className="grid two" style={{ marginTop: 14 }}>
            <Panel title="Put do kupovine" note="logaritamska skala">
              <div className="funnel">
                {funnel.map((f, i) => {
                  const prevV = i > 0 ? funnel[i - 1].v : null;
                  return (
                    <div className="f-row" key={f.label} style={{ "--i": i } as any}>
                      <span className="f-label">{f.label}</span>
                      <div className="f-track">
                        <div style={{ width: `${Math.max(3, (Math.log10(f.v + 1) / Math.log10(fMax + 1)) * 100)}%` }} />
                      </div>
                      <div className="f-val num">
                        <b>{num(f.v)}</b>
                        {prevV ? <span>{pct(safeDiv(f.v * 100, prevV), 1)} od prethodnog</span> : <span>polazna tačka</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Klikovi i posjete sajtu">
              <TrafficChart data={m.daily.map((x) => ({ date: x.date, linkClicks: x.linkClicks, landingPageViews: x.landingPageViews }))} />
            </Panel>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-head">
              <h3>Kampanje</h3>
              <span className="note">hronološki, od prve pokrenute</span>
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Kampanja</th>
                    <th>Period</th>
                    <th>Uloženo</th>
                    <th>Rezultati</th>
                    <th>Cijena / rez.</th>
                    <th>Impresije</th>
                    <th>Klikovi</th>
                    <th>CTR</th>
                    <th>CPC</th>
                    <th>Posjete</th>
                  </tr>
                </thead>
                <tbody>
                  {m.campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cell-name">{c.name}</div>
                        <div className="cell-sub">
                          <Status s={c.status} />
                          <span className="sep">·</span>
                          <span>{c.objective}</span>
                          {c.dailyBudget ? (
                            <>
                              <span className="sep">·</span>
                              <span>{eur0(c.dailyBudget)}/dan</span>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {fmtDS(c.firstDate)} – {fmtDS(c.lastDate)}
                      </td>
                      <td>{eur(c.spend)}</td>
                      <td>
                        {c.results != null ? num(c.results) : "—"}
                        {c.results != null && <div className="cell-sub" style={{ justifyContent: "flex-end" }}>{c.resultLabel}</div>}
                      </td>
                      <td>{c.results ? eur(c.spend / c.results) : "—"}</td>
                      <td>{num(c.impressions)}</td>
                      <td>{num(c.linkClicks)}</td>
                      <td>{pct(safeDiv(c.linkClicks * 100, c.impressions))}</td>
                      <td>{eur(safeDiv(c.spend, c.linkClicks))}</td>
                      <td>{num(c.landingPageViews)}</td>
                    </tr>
                  ))}
                  {!m.campaigns.length && (
                    <tr>
                      <td colSpan={10} className="empty">
                        Nijedna kampanja nije bila aktivna u ovom periodu.
                      </td>
                    </tr>
                  )}
                </tbody>
                {m.campaigns.length > 1 && (
                  <tfoot>
                    <tr>
                      <td>Ukupno</td>
                      <td>—</td>
                      <td>{eur(t.spend)}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{num(t.impressions)}</td>
                      <td>{num(t.linkClicks)}</td>
                      <td>{pct(ctr)}</td>
                      <td>{eur(cpc)}</td>
                      <td>{num(t.landingPageViews)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {m.ads.length > 0 && (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panel-head">
                <h3>Reklame</h3>
                <span className="note">po ulaganju</span>
              </div>
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Reklama</th>
                      <th>Uloženo</th>
                      <th>Impresije</th>
                      <th>Klikovi</th>
                      <th>CTR</th>
                      <th>CPC</th>
                      <th>Posjete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.ads.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="cell-name">{a.name}</div>
                          <div className="cell-sub">
                            <Status s={a.status} />
                            <span className="sep">·</span>
                            <span>{a.campaignName}</span>
                          </div>
                        </td>
                        <td>{eur(a.spend)}</td>
                        <td>{num(a.impressions)}</td>
                        <td>{num(a.linkClicks)}</td>
                        <td>{pct(safeDiv(a.linkClicks * 100, a.impressions))}</td>
                        <td>{eur(safeDiv(a.spend, a.linkClicks))}</td>
                        <td>{num(a.landingPageViews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {m && m.breakdownPeriod && (
        <section>
          <SectionHead eyebrow="Publika" title="Ko vidi reklame i gdje" sub={`Period: ${fmtD(m.breakdownPeriod.since)} – ${fmtD(m.breakdownPeriod.until)}`} />
          <div className="grid two">
            <Panel title="Starost i pol" note="impresije">
              <AgeGenderChart data={m.ageGender} />
            </Panel>
            <Panel title="Gdje se prikazuju" note="uloženo">
              <div className="bars-title">Platforme</div>
              <Bars rows={m.platforms} value={(r) => r.spend} format={eur} sub={(r) => `${num(r.impressions)} impresija`} />
              <div className="bars-title">Pozicije</div>
              <Bars rows={m.placements} value={(r) => r.spend} format={eur} sub={(r) => `${pct(safeDiv(r.linkClicks * 100, r.impressions))} CTR`} />
            </Panel>
          </div>
          <Panel title="Gradovi" note="uloženo">
            <Bars rows={m.regions} value={(r) => r.spend} format={eur} sub={(r) => `${num(r.linkClicks)} klikova`} />
          </Panel>
        </section>
      )}

      {s && (
        <section>
          <SectionHead eyebrow="Prodavnica" title="Šta se prodaje" sub="Porudžbine iz Shopify prodavnice orijent.me." />
          <div className="grid two">
            <div className="panel">
              <div className="panel-head">
                <h3>Najprodavaniji parfemi</h3>
              </div>
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Proizvod</th>
                      <th>Komada</th>
                      <th>Prihod</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.topProducts.map((x) => (
                      <tr key={x.title}>
                        <td>
                          <div className="cell-name">{x.title}</div>
                        </td>
                        <td>{num(x.units)}</td>
                        <td>{eur(x.revenue)}</td>
                      </tr>
                    ))}
                    {!s.topProducts.length && (
                      <tr>
                        <td colSpan={3} className="empty">
                          Nema porudžbina u ovom periodu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <Panel title="Odakle dolaze kupci" note="prihod">
                <Bars rows={s.sources} value={(r) => r.revenue} format={eur} sub={(r) => `${num(r.orders)} porudžbina`} />
              </Panel>
              <Panel title="Porudžbine po danu">
                <OrdersChart data={s.daily} />
              </Panel>
            </div>
          </div>
        </section>
      )}

      <section>
        <SectionHead eyebrow="Pojmovnik" title="Šta koji broj znači" />
        <div className="glossary">
          <div className="gl">
            <b>ROAS</b>
            <span>Prihod podijeljen sa ulaganjem u reklame. 3× znači da je svaki uloženi euro vratio 3 € prihoda.</span>
          </div>
          <div className="gl">
            <b>Ukupni ROAS</b>
            <span>Sav prihod prodavnice / ulaganje u reklame. Uključuje i kupce koji nisu direktno kliknuli reklamu.</span>
          </div>
          <div className="gl">
            <b>CTR</b>
            <span>Procenat ljudi koji kliknu na link nakon što vide reklamu.</span>
          </div>
          <div className="gl">
            <b>CPC i CPM</b>
            <span>Cijena jednog klika i cijena 1.000 prikaza reklame.</span>
          </div>
          <div className="gl">
            <b>Doseg i frekvencija</b>
            <span>Koliko različitih ljudi je vidjelo reklamu i koliko puta u prosjeku.</span>
          </div>
          <div className="gl">
            <b>Posjete sajtu</b>
            <span>Koliko puta se sajt zaista učitao nakon klika na reklamu.</span>
          </div>
        </div>
      </section>

      <footer>
        <span>Izvori: Meta Ads · Shopify · prikaz od {fmtD(MIN_DATE)}</span>
        <span>Pripremio Vuk Milošević</span>
      </footer>
    </main>
  );
}
