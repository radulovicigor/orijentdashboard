import type { BreakdownRow, MetaAd, MetaCampaign, MetaData, MetaTotals } from "./types";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { eachDay, type RangeKey } from "./range";

// Meta Ads data is synced once a day into Supabase (no Meta API token needed here).
const REVALIDATE = 900; // 15 min cache

type Row = {
  kind: "account" | "campaign" | "ad";
  date: string;
  entity_id: string;
  name: string | null;
  parent_name: string | null;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  landing_page_views: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  purchase_value: number;
  results: number | null;
  result_type: string | null;
  updated_at: string;
};

async function rest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("baza nije povezana (nedostaju SUPABASE_URL / SUPABASE_KEY u Vercelu).");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Baza (Supabase): ${res.status} ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

async function loadRows(since: string, until: string): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let offset = 0; offset < 20000; offset += page) {
    const rows = await rest<Row[]>(
      `meta_daily?select=*&date=gte.${since}&date=lte.${until}&order=date.asc,kind.asc,entity_id.asc&limit=${page}&offset=${offset}`,
    );
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out.map((r) => ({
    ...r,
    spend: Number(r.spend),
    impressions: Number(r.impressions),
    reach: Number(r.reach),
    clicks: Number(r.clicks),
    link_clicks: Number(r.link_clicks),
    landing_page_views: Number(r.landing_page_views),
    add_to_cart: Number(r.add_to_cart),
    initiate_checkout: Number(r.initiate_checkout),
    purchases: Number(r.purchases),
    purchase_value: Number(r.purchase_value),
    daily_budget: r.daily_budget == null ? null : Number(r.daily_budget),
    results: r.results == null ? null : Number(r.results),
  }));
}

function empty(): MetaTotals {
  return { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, addToCart: 0, initiateCheckout: 0, purchases: 0, purchaseValue: 0, frequency: null };
}

function add(t: MetaTotals, r: Row) {
  t.spend += r.spend;
  t.impressions += r.impressions;
  t.reach += r.reach;
  t.clicks += r.clicks;
  t.linkClicks += r.link_clicks;
  t.landingPageViews += r.landing_page_views;
  t.addToCart += r.add_to_cart;
  t.initiateCheckout += r.initiate_checkout;
  t.purchases += r.purchases;
  t.purchaseValue += r.purchase_value;
}

const inRange = (d: string, s: string, u: string) => d >= s && d <= u;

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_SALES: "Prodaja",
  OUTCOME_TRAFFIC: "Saobraćaj",
  OUTCOME_AWARENESS: "Svijest o brendu",
  OUTCOME_ENGAGEMENT: "Angažman",
  OUTCOME_LEADS: "Potencijalni kupci",
  OUTCOME_APP_PROMOTION: "Aplikacija",
  LINK_CLICKS: "Saobraćaj",
  POST_ENGAGEMENT: "Angažman",
  MESSAGES: "Poruke",
  REACH: "Doseg",
  BRAND_AWARENESS: "Svijest o brendu",
  CONVERSIONS: "Konverzije",
  PRODUCT_CATALOG_SALES: "Katalog prodaja",
};

const RESULT_LABEL: Record<string, string> = {
  profile_visit_view: "Posjete profilu",
  reach: "Doseg",
  omni_landing_page_view: "Pregledi stranice",
  landing_page_view: "Pregledi stranice",
  link_click: "Klikovi na link",
  "onsite_conversion.messaging_conversation_started_7d": "Započeti razgovori",
  "offsite_conversion.fb_pixel_purchase": "Kupovine",
  omni_purchase: "Kupovine",
  post_engagement: "Angažman",
  thruplay: "Pregledi videa",
  lead: "Lidovi",
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  threads: "Threads",
  whatsapp: "WhatsApp",
};

const POSITION_LABEL: Record<string, string> = {
  feed: "Feed",
  story: "Stories",
  status: "Status",
  instagram_stories: "Stories",
  facebook_stories: "Stories",
  instagram_reels: "Reels",
  facebook_reels: "Reels",
  facebook_reels_overlay: "Reels overlay",
  instagram_explore: "Explore",
  instagram_explore_grid_home: "Explore",
  instagram_search: "Pretraga",
  marketplace: "Marketplace",
  video_feeds: "Video feed",
  search: "Pretraga",
  instream_video: "In-stream video",
  right_hand_column: "Desna kolona",
  instagram_profile_feed: "Profil",
  an_classic: "Audience Network",
  messenger_inbox: "Messenger",
};

function cleanRegion(r: string) {
  if (/cetinje/i.test(r)) return "Cetinje";
  return r.replace(/ Municipality$/i, "").replace(/ Capital City$/i, "").replace(/^Unknown$/i, "Nepoznato");
}

type BreakdownSnapshot = {
  since: string;
  until: string;
  age_gender: [string, string, number, number, number][];
  placements: [string, string, number, number, number][];
  regions: [string, number, number, number][];
};
type ReachSnapshot = Record<string, { since: string; until: string; reach: number; frequency: number | null }>;

function mergeBy(rows: BreakdownRow[]): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const cur = map.get(r.label);
    if (!cur) map.set(r.label, { ...r });
    else {
      cur.spend += r.spend;
      cur.impressions += r.impressions;
      cur.linkClicks += r.linkClicks;
      cur.purchases += r.purchases;
      cur.purchaseValue += r.purchaseValue;
    }
  }
  return [...map.values()].filter((r) => r.impressions > 0).sort((a, b) => b.spend - a.spend);
}

const bd = (label: string, spend: number, impressions: number, linkClicks: number): BreakdownRow => ({ label, spend, impressions, linkClicks, purchases: 0, purchaseValue: 0 });

export async function getMetaData(key: RangeKey, since: string, until: string, prev: { since: string; until: string }): Promise<MetaData> {
  const [rows, snaps] = await Promise.all([
    loadRows(prev.since < since ? prev.since : since, until),
    rest<{ key: string; data: unknown; updated_at: string }[]>(`meta_snapshot?select=key,data,updated_at`),
  ]);
  const snap = Object.fromEntries(snaps.map((s) => [s.key, s.data])) as { reach?: ReachSnapshot; breakdowns?: BreakdownSnapshot; sync?: { last_sync: string } };

  const acc = rows.filter((r) => r.kind === "account");
  const totals = empty();
  const prevTotals = empty();
  const dayMap = new Map(eachDay(since, until).map((d) => [d, { date: d, ...empty() }]));
  for (const r of acc) {
    if (inRange(r.date, since, until)) {
      add(totals, r);
      const d = dayMap.get(r.date);
      if (d) add(d, r);
    }
    if (inRange(r.date, prev.since, prev.until)) add(prevTotals, r);
  }

  // Unique reach can't be summed across days; use the synced value for this exact period when available.
  const rs = Object.values(snap.reach ?? {}).find((v) => v && v.since === since && v.until === until);
  let reachKnown = false;
  if (rs) {
    totals.reach = rs.reach;
    totals.frequency = rs.reach ? totals.impressions / rs.reach : null;
    reachKnown = true;
  } else if (totals.spend === 0) {
    totals.reach = 0;
    reachKnown = true;
  }

  const group = (kind: "campaign" | "ad") => {
    const m = new Map<string, { last: Row; first: string; t: MetaTotals; results: number; hasResults: boolean }>();
    for (const r of rows) {
      if (r.kind !== kind || !inRange(r.date, since, until)) continue;
      const g = m.get(r.entity_id) ?? { last: r, first: r.date, t: empty(), results: 0, hasResults: false };
      add(g.t, r);
      if (r.date < g.first) g.first = r.date;
      if (r.results != null) {
        g.results += r.results;
        g.hasResults = true;
      }
      if (r.date >= g.last.date) g.last = r;
      m.set(r.entity_id, g);
    }
    return [...m.entries()].filter(([, g]) => g.t.spend > 0 || g.t.impressions > 0);
  };

  const campaigns: MetaCampaign[] = group("campaign")
    .map(([id, g]) => {
      const rt = g.last.result_type ?? "";
      let results: number | null = g.hasResults ? g.results : null;
      if (rt === "reach") results = null; // daily reach can't be summed
      return {
        id,
        name: g.last.name ?? id,
        firstDate: g.first,
        lastDate: g.last.date,
        status: g.last.status ?? "UNKNOWN",
        objective: OBJECTIVE_LABEL[g.last.objective ?? ""] ?? g.last.objective ?? "",
        dailyBudget: g.last.daily_budget,
        results,
        resultLabel: RESULT_LABEL[rt] ?? (rt ? rt : "—"),
        ...g.t,
      };
    })
    // hronološki: kampanja koja je prva krenula ide prva
    .sort((a, b) => (a.firstDate === b.firstDate ? a.lastDate.localeCompare(b.lastDate) : a.firstDate.localeCompare(b.firstDate)));

  const ads: MetaAd[] = group("ad")
    .map(([id, g]) => ({
      id,
      name: g.last.name ?? id,
      campaignName: g.last.parent_name ?? "",
      status: g.last.status ?? "UNKNOWN",
      thumbnail: null,
      ...g.t,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 12);

  const b = snap.breakdowns;
  const ageMap = new Map<string, { age: string; male: number; female: number; unknown: number; spendMale: number; spendFemale: number }>();
  for (const [age, g, spend, impr] of b?.age_gender ?? []) {
    if (age === "Unknown") continue;
    const cur = ageMap.get(age) ?? { age, male: 0, female: 0, unknown: 0, spendMale: 0, spendFemale: 0 };
    if (g === "male") {
      cur.male += impr;
      cur.spendMale += spend;
    } else if (g === "female") {
      cur.female += impr;
      cur.spendFemale += spend;
    } else cur.unknown += impr;
    ageMap.set(age, cur);
  }

  const placementsRaw = b?.placements ?? [];
  const platforms = mergeBy(placementsRaw.map(([p, , s, i, c]) => bd(PLATFORM_LABEL[p] ?? p, s, i, c)));
  const placements = mergeBy(
    placementsRaw.map(([p, pos, s, i, c]) => bd(`${PLATFORM_LABEL[p] ?? p} · ${POSITION_LABEL[pos] ?? pos}`, s, i, c)),
  ).slice(0, 10);
  const regions = mergeBy((b?.regions ?? []).map(([r, s, i, c]) => bd(cleanRegion(r), s, i, c))).slice(0, 12);

  return {
    totals,
    prevTotals,
    daily: [...dayMap.values()],
    campaigns,
    ads,
    ageGender: [...ageMap.values()].sort((a, b) => a.age.localeCompare(b.age)),
    platforms,
    placements,
    regions,
    reachKnown,
    breakdownPeriod: b ? { since: b.since, until: b.until } : null,
    lastSync: snap.sync?.last_sync ?? null,
  };
}
