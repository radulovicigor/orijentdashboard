import type { MetaAd, MetaData, MetaTotals, ShopifyData } from "./types";
import { eachDay } from "./range";

// Deterministic pseudo-random so the demo looks the same on every load
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function sum(rows: MetaTotals[]): MetaTotals {
  const t: MetaTotals = { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, addToCart: 0, initiateCheckout: 0, purchases: 0, purchaseValue: 0, frequency: null };
  for (const r of rows) {
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.reach += r.reach;
    t.clicks += r.clicks;
    t.linkClicks += r.linkClicks;
    t.landingPageViews += r.landingPageViews;
    t.addToCart += r.addToCart;
    t.initiateCheckout += r.initiateCheckout;
    t.purchases += r.purchases;
    t.purchaseValue += r.purchaseValue;
  }
  t.reach = Math.round(t.reach * 0.55);
  t.frequency = t.reach ? t.impressions / t.reach : null;
  return t;
}

function day(r: () => number): MetaTotals {
  const spend = 9 + r() * 7;
  const impressions = Math.round(spend * (380 + r() * 120));
  const linkClicks = Math.round(impressions * (0.011 + r() * 0.006));
  const lpv = Math.round(linkClicks * 0.72);
  const atc = Math.round(lpv * (0.07 + r() * 0.04));
  const ic = Math.round(atc * 0.55);
  const purchases = Math.round(ic * (0.45 + r() * 0.2));
  return {
    spend,
    impressions,
    reach: Math.round(impressions * 0.7),
    clicks: Math.round(linkClicks * 1.6),
    linkClicks,
    landingPageViews: lpv,
    addToCart: atc,
    initiateCheckout: ic,
    purchases,
    purchaseValue: purchases * (38 + r() * 20),
    frequency: null,
  };
}

export function demoMeta(since: string, until: string): MetaData {
  const r = rng(42);
  const days = eachDay(since, until);
  const daily = days.map((date) => ({ date, ...day(r) }));
  const prev = days.map(() => day(r)).map((d) => ({ ...d, spend: d.spend * 0.9, purchases: Math.round(d.purchases * 0.8), purchaseValue: d.purchaseValue * 0.78 }));
  const totals = sum(daily);
  const prevTotals = sum(prev);

  const share = [0.46, 0.31, 0.23];
  const names = ["Katalog Prodaja", "Orijent — Otkrij Svoj Parfem (Kviz Traffic) v2", "Orijent — Upoznajte Orijent (Awareness CG)"];
  const objectives = ["Prodaja", "Saobraćaj", "Svijest o brendu"];
  const campaigns = names.map((name, i) => {
    const f = share[i];
    const t: MetaTotals = {
      spend: totals.spend * f,
      impressions: Math.round(totals.impressions * f * (i === 2 ? 1.6 : 0.8)),
      reach: Math.round(totals.reach * f * (i === 2 ? 1.5 : 0.8)),
      clicks: Math.round(totals.clicks * f),
      linkClicks: Math.round(totals.linkClicks * f * (i === 1 ? 1.5 : 0.8)),
      landingPageViews: Math.round(totals.landingPageViews * f * (i === 1 ? 1.5 : 0.8)),
      addToCart: Math.round(totals.addToCart * (i === 0 ? 0.7 : 0.15)),
      initiateCheckout: Math.round(totals.initiateCheckout * (i === 0 ? 0.7 : 0.15)),
      purchases: Math.round(totals.purchases * (i === 0 ? 0.72 : i === 1 ? 0.2 : 0.08)),
      purchaseValue: totals.purchaseValue * (i === 0 ? 0.72 : i === 1 ? 0.2 : 0.08),
      frequency: 1.3 + i * 0.4,
    };
    const results = i === 0 ? t.purchases : i === 1 ? t.landingPageViews : t.reach;
    const dailySpend = days.map((date) => ({ date, spend: (t.spend / days.length) * (0.5 + r() * 1.2) }));
    return {
      id: String(i),
      name,
      firstDate: since,
      lastDate: until,
      status: "ACTIVE",
      objective: objectives[i],
      dailyBudget: [8, 5, 4][i],
      results,
      resultLabel: ["Kupovine", "Pregledi stranice", "Doseg"][i],
      daily: dailySpend,
      ads: [] as MetaAd[],
      ...t,
    };
  });

  const adNames = ["Katalog — Collection Story", "Katalog — Carousel", "Kviz — Koncept A (bočica)", "Kviz — Koncept B (kviz)", "Awareness — Reel 1", "Awareness — Dupe format"];
  const ads = adNames.map((name, i) => {
    const f = [0.26, 0.2, 0.17, 0.14, 0.13, 0.1][i];
    return {
      id: String(i),
      name,
      campaignName: names[i < 2 ? 0 : i < 4 ? 1 : 2],
      status: "ACTIVE",
      thumbnail: null,
      spend: totals.spend * f,
      impressions: Math.round(totals.impressions * f),
      reach: Math.round(totals.reach * f),
      clicks: Math.round(totals.clicks * f),
      linkClicks: Math.round(totals.linkClicks * f * (1.2 - i * 0.08)),
      landingPageViews: Math.round(totals.landingPageViews * f),
      addToCart: Math.round(totals.addToCart * f),
      initiateCheckout: Math.round(totals.initiateCheckout * f),
      purchases: Math.round(totals.purchases * f * (1.5 - i * 0.2)),
      purchaseValue: totals.purchaseValue * f * (1.5 - i * 0.2),
      frequency: null,
    };
  });

  for (const c of campaigns) c.ads = ads.filter((a) => a.campaignName === c.name).sort((x, y) => y.spend - x.spend);

  const ages = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const ageW = [0.18, 0.34, 0.24, 0.13, 0.07, 0.04];
  const ageGender = ages.map((age, i) => ({
    age,
    female: Math.round(totals.impressions * ageW[i] * 0.58),
    male: Math.round(totals.impressions * ageW[i] * 0.4),
    unknown: Math.round(totals.impressions * ageW[i] * 0.02),
    spendFemale: totals.spend * ageW[i] * 0.58,
    spendMale: totals.spend * ageW[i] * 0.4,
  }));

  const bd = (label: string, f: number) => ({
    label,
    spend: totals.spend * f,
    impressions: Math.round(totals.impressions * f),
    linkClicks: Math.round(totals.linkClicks * f),
    purchases: Math.round(totals.purchases * f),
    purchaseValue: totals.purchaseValue * f,
  });

  return {
    totals,
    prevTotals,
    daily,
    campaigns,
    ads,
    ageGender,
    platforms: [bd("Instagram", 0.68), bd("Facebook", 0.29), bd("Audience Network", 0.03)],
    placements: [bd("Instagram · Stories", 0.27), bd("Instagram · Reels", 0.23), bd("Instagram · Feed", 0.18), bd("Facebook · Feed", 0.17), bd("Facebook · Reels", 0.08), bd("Facebook · Stories", 0.04)],
    reachKnown: true,
    breakdownPeriod: { since, until },
    lastSync: new Date().toISOString(),
    regions: [bd("Podgorica", 0.41), bd("Budva", 0.14), bd("Nikšić", 0.11), bd("Bar", 0.09), bd("Herceg Novi", 0.08), bd("Kotor", 0.07), bd("Bijelo Polje", 0.05)],
  };
}

export function demoShopify(since: string, until: string, meta: MetaData): ShopifyData {
  const r = rng(7);
  const days = eachDay(since, until);
  const daily = days.map((date, i) => {
    const orders = Math.max(0, Math.round((meta.daily[i]?.purchases ?? 0) * 1.35 + r() * 3));
    const returningCustomers = Math.round(orders * (0.2 + r() * 0.15));
    return { date, orders, revenue: orders * (40 + r() * 18), newCustomers: orders - returningCustomers, returningCustomers };
  });
  // Blaga dnevna šara: pauza noću, dva vrha (podne i veče), da "Sat u danu" izgleda uvjerljivo.
  const hourShape = [0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.6, 1, 1.4, 1.7, 2, 2.4, 2.2, 1.8, 1.6, 1.7, 2, 2.6, 3, 2.8, 2, 1.2, 0.5];
  const hourTotal = hourShape.reduce((a, b) => a + b, 0);
  const revenue = daily.reduce((a, d) => a + d.revenue, 0);
  const orders = daily.reduce((a, d) => a + d.orders, 0);
  const products = [
    ["Lattafa Khamrah EDP 100ml", 0.19],
    ["Lattafa Asad EDP 100ml", 0.15],
    ["Armaf Club de Nuit Intense Man", 0.13],
    ["Rasasi Hawas for Him", 0.1],
    ["Lattafa Yara EDP 100ml", 0.09],
    ["Afnan 9pm EDP 100ml", 0.08],
    ["Lattafa Badee Al Oud Amethyst", 0.06],
    ["Nusuk Ajwad", 0.05],
  ] as const;
  const metaOrders = Math.round(orders * 0.62);
  return {
    currency: "EUR",
    revenue,
    orders,
    prevRevenue: revenue * 0.82,
    prevOrders: Math.round(orders * 0.85),
    unitsSold: Math.round(orders * 1.3),
    newCustomers: Math.round(orders * 0.74),
    returningCustomers: Math.round(orders * 0.26),
    metaOrders,
    metaRevenue: revenue * 0.62,
    daily,
    hourly: hourShape.map((w, hour) => ({ hour, orders: Math.round((orders * w) / hourTotal), revenue: Math.round((revenue * w) / hourTotal) })),
    topProducts: products.map(([title, f]) => ({ title, revenue: revenue * f, units: Math.round(orders * 1.3 * f) })),
    sources: [
      { label: "Meta (Facebook / Instagram)", orders: metaOrders, revenue: revenue * 0.62 },
      { label: "Direktno / nepoznato", orders: Math.round(orders * 0.24), revenue: revenue * 0.24 },
      { label: "Google", orders: Math.round(orders * 0.11), revenue: revenue * 0.11 },
      { label: "Email", orders: Math.round(orders * 0.03), revenue: revenue * 0.03 },
    ],
    truncated: false,
  };
}
