import type { BreakdownRow, MetaAd, MetaCampaign, MetaData, MetaTotals } from "./types";
import { META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_API_VERSION } from "./config";
import { eachDay, MIN_DATE, type RangeKey } from "./range";

// Meta Ads podaci se čitaju uživo sa Graph API-ja (System User token, ads_read, bez isteka).
const GRAPH = "https://graph.facebook.com";
const REVALIDATE = 900; // 15 min cache, isto kao stranica

function graphUrl(path: string, params: Record<string, string>): string {
  const u = new URL(`${GRAPH}/${META_API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", META_ACCESS_TOKEN);
  return u.toString();
}

async function fetchAllPages(initialUrl: string): Promise<any[]> {
  const out: any[] = [];
  let pageUrl: string | null = initialUrl;
  let guard = 0;
  while (pageUrl && guard < 25) {
    const res: Response = await fetch(pageUrl, { next: { revalidate: REVALIDATE } });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Meta API: ${json?.error?.message ?? res.statusText}`);
    out.push(...(json.data ?? []));
    pageUrl = json.paging?.next ?? null;
    guard++;
  }
  return out;
}

type ActionRow = { action_type: string; value: string }[] | undefined;

const PURCHASE_KEYS = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"];
const ATC_KEYS = ["omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"];
const IC_KEYS = ["omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout"];
const LPV_KEYS = ["omni_landing_page_view", "landing_page_view"];

function pickAction(actions: ActionRow, keys: string[]): number {
  if (!actions) return 0;
  for (const k of keys) {
    const a = actions.find((x) => x.action_type === k);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

type InsightRow = {
  date: string;
  entityId: string;
  name: string | null;
  parentName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
};

async function fetchDailyInsights(level: "account" | "campaign" | "ad", since: string, until: string): Promise<InsightRow[]> {
  const fields =
    level === "account"
      ? "spend,impressions,clicks,inline_link_clicks,actions,action_values"
      : level === "campaign"
        ? "campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions,action_values"
        : "ad_id,ad_name,campaign_name,spend,impressions,clicks,inline_link_clicks,actions,action_values";
  const rows = await fetchAllPages(
    graphUrl(`act_${META_AD_ACCOUNT_ID}/insights`, {
      level,
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      fields,
      limit: "500",
    }),
  );
  return rows.map((r: any) => ({
    date: r.date_start,
    entityId: level === "account" ? "account" : level === "campaign" ? r.campaign_id : r.ad_id,
    name: level === "campaign" ? r.campaign_name : level === "ad" ? r.ad_name : null,
    parentName: level === "ad" ? r.campaign_name : null,
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    linkClicks: Number(r.inline_link_clicks) || 0,
    landingPageViews: pickAction(r.actions, LPV_KEYS),
    addToCart: pickAction(r.actions, ATC_KEYS),
    initiateCheckout: pickAction(r.actions, IC_KEYS),
    purchases: pickAction(r.actions, PURCHASE_KEYS),
    purchaseValue: pickAction(r.action_values, PURCHASE_KEYS),
  }));
}

async function fetchCampaignMeta(): Promise<Map<string, { objective: string; status: string; dailyBudget: number | null }>> {
  const rows = await fetchAllPages(graphUrl(`act_${META_AD_ACCOUNT_ID}/campaigns`, { fields: "id,objective,status,daily_budget", limit: "500" }));
  return new Map(
    rows.map((r: any) => [
      r.id,
      { objective: r.objective ?? "", status: r.status ?? "UNKNOWN", dailyBudget: r.daily_budget != null ? Number(r.daily_budget) / 100 : null },
    ]),
  );
}

async function fetchAdMeta(): Promise<Map<string, { status: string }>> {
  const rows = await fetchAllPages(graphUrl(`act_${META_AD_ACCOUNT_ID}/ads`, { fields: "id,status", limit: "500" }));
  return new Map(rows.map((r: any) => [r.id, { status: r.status ?? "UNKNOWN" }]));
}

async function fetchAccountReach(since: string, until: string): Promise<{ reach: number; frequency: number | null }> {
  const rows = await fetchAllPages(
    graphUrl(`act_${META_AD_ACCOUNT_ID}/insights`, { level: "account", time_range: JSON.stringify({ since, until }), fields: "reach,frequency", limit: "5" }),
  );
  const r = rows[0];
  return { reach: r ? Number(r.reach) || 0 : 0, frequency: r?.frequency != null ? Number(r.frequency) : null };
}

async function fetchBreakdown(breakdowns: string, since: string, until: string): Promise<any[]> {
  return fetchAllPages(
    graphUrl(`act_${META_AD_ACCOUNT_ID}/insights`, {
      level: "account",
      time_range: JSON.stringify({ since, until }),
      breakdowns,
      fields: "spend,impressions,inline_link_clicks",
      limit: "500",
    }),
  );
}

function emptyTotals(): MetaTotals {
  return { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, addToCart: 0, initiateCheckout: 0, purchases: 0, purchaseValue: 0, frequency: null };
}

function addRow(t: MetaTotals, r: InsightRow) {
  t.spend += r.spend;
  t.impressions += r.impressions;
  t.clicks += r.clicks;
  t.linkClicks += r.linkClicks;
  t.landingPageViews += r.landingPageViews;
  t.addToCart += r.addToCart;
  t.initiateCheckout += r.initiateCheckout;
  t.purchases += r.purchases;
  t.purchaseValue += r.purchaseValue;
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

// Koji rezultat je "primarni" za dati cilj kampanje (isti princip kao Meta-in "Rezultati" u Ads Manageru).
const OBJECTIVE_RESULT: Record<string, { metric: keyof Pick<MetaTotals, "purchases" | "landingPageViews" | "linkClicks">; label: string } | "reach" | undefined> = {
  OUTCOME_SALES: { metric: "purchases", label: "Kupovine" },
  PRODUCT_CATALOG_SALES: { metric: "purchases", label: "Kupovine" },
  CONVERSIONS: { metric: "purchases", label: "Kupovine" },
  OUTCOME_TRAFFIC: { metric: "landingPageViews", label: "Pregledi stranice" },
  LINK_CLICKS: { metric: "linkClicks", label: "Klikovi na link" },
  OUTCOME_AWARENESS: "reach",
  BRAND_AWARENESS: "reach",
  REACH: "reach",
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
  rewarded_video: "Rewarded video",
  threads_feed: "Feed",
};

function cleanRegion(r: string) {
  if (/cetinje/i.test(r)) return "Cetinje";
  return r.replace(/ Municipality$/i, "").replace(/ Capital City$/i, "").replace(/^Unknown$/i, "Nepoznato");
}

function mergeBy(rows: BreakdownRow[]): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const cur = map.get(r.label);
    if (!cur) map.set(r.label, { ...r });
    else {
      cur.spend += r.spend;
      cur.impressions += r.impressions;
      cur.linkClicks += r.linkClicks;
    }
  }
  return [...map.values()].filter((r) => r.impressions > 0).sort((a, b) => b.spend - a.spend);
}

const bd = (label: string, spend: number, impressions: number, linkClicks: number): BreakdownRow => ({ label, spend, impressions, linkClicks, purchases: 0, purchaseValue: 0 });

function groupLevel(rows: InsightRow[], since: string, until: string) {
  const m = new Map<string, { name: string; parentName: string | null; first: string; last: string; t: MetaTotals }>();
  for (const r of rows) {
    if (!inRange(r.date, since, until)) continue;
    const g = m.get(r.entityId) ?? { name: r.name ?? r.entityId, parentName: r.parentName, first: r.date, last: r.date, t: emptyTotals() };
    addRow(g.t, r);
    if (r.date < g.first) g.first = r.date;
    if (r.date > g.last) g.last = r.date;
    if (r.name) g.name = r.name;
    if (r.parentName) g.parentName = r.parentName;
    m.set(r.entityId, g);
  }
  return [...m.entries()].filter(([, g]) => g.t.spend > 0 || g.t.impressions > 0);
}

export async function getMetaData(key: RangeKey, since: string, until: string, prev: { since: string; until: string }): Promise<MetaData> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    throw new Error("Meta pristup nije podešen (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID u Vercelu).");
  }
  // previousRange() vraća "2000-01-01" kao znak da prethodnog perioda nema (pada prije MIN_DATE) -
  // taj datum ne šaljemo Meti (Graph API odbija opsege starije od ~37 mjeseci).
  const fetchSince = prev.since >= MIN_DATE && prev.since < since ? prev.since : since;

  const [accountRows, campaignRows, adRows, campaignMeta, adMeta, reachInfo, ageGenderRaw, placementRaw, regionRaw] = await Promise.all([
    fetchDailyInsights("account", fetchSince, until),
    fetchDailyInsights("campaign", fetchSince, until),
    fetchDailyInsights("ad", fetchSince, until),
    fetchCampaignMeta(),
    fetchAdMeta(),
    fetchAccountReach(since, until),
    fetchBreakdown("age,gender", since, until),
    fetchBreakdown("publisher_platform,platform_position", since, until),
    fetchBreakdown("region", since, until),
  ]);

  const totals = emptyTotals();
  const prevTotals = emptyTotals();
  const dayMap = new Map(eachDay(since, until).map((d) => [d, { date: d, ...emptyTotals() }]));
  for (const r of accountRows) {
    if (inRange(r.date, since, until)) {
      addRow(totals, r);
      const d = dayMap.get(r.date);
      if (d) addRow(d, r);
    }
    if (inRange(r.date, prev.since, prev.until)) addRow(prevTotals, r);
  }
  // Doseg se čita direktno za tačan period (nije zbir po danima) - uvijek tačan, za razliku od stare Supabase snimke.
  totals.reach = reachInfo.reach;
  totals.frequency = reachInfo.reach ? totals.impressions / reachInfo.reach : reachInfo.frequency;

  const campaigns: MetaCampaign[] = groupLevel(campaignRows, since, until)
    .map(([id, g]) => {
      const meta = campaignMeta.get(id);
      const objective = meta?.objective ?? "";
      const spec = OBJECTIVE_RESULT[objective];
      let results: number | null = null;
      let resultLabel = "—";
      if (spec === "reach") {
        resultLabel = "Doseg"; // dnevni doseg se ne može sabirati, isto ograničenje kao ranije
      } else if (spec) {
        results = g.t[spec.metric];
        resultLabel = spec.label;
      }
      return {
        id,
        name: g.name,
        firstDate: g.first,
        lastDate: g.last,
        status: meta?.status ?? "UNKNOWN",
        objective: OBJECTIVE_LABEL[objective] ?? objective,
        dailyBudget: meta?.dailyBudget ?? null,
        results,
        resultLabel,
        ...g.t,
      };
    })
    // hronološki: kampanja koja je prva krenula ide prva
    .sort((a, b) => (a.firstDate === b.firstDate ? a.lastDate.localeCompare(b.lastDate) : a.firstDate.localeCompare(b.firstDate)));

  const ads: MetaAd[] = groupLevel(adRows, since, until)
    .map(([id, g]) => ({
      id,
      name: g.name,
      campaignName: g.parentName ?? "",
      status: adMeta.get(id)?.status ?? "UNKNOWN",
      thumbnail: null,
      ...g.t,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 12);

  const ageMap = new Map<string, { age: string; male: number; female: number; unknown: number; spendMale: number; spendFemale: number }>();
  for (const r of ageGenderRaw) {
    const age: string = r.age;
    if (!age || /unknown/i.test(age)) continue;
    const cur = ageMap.get(age) ?? { age, male: 0, female: 0, unknown: 0, spendMale: 0, spendFemale: 0 };
    const impr = Number(r.impressions) || 0;
    const spend = Number(r.spend) || 0;
    if (r.gender === "male") {
      cur.male += impr;
      cur.spendMale += spend;
    } else if (r.gender === "female") {
      cur.female += impr;
      cur.spendFemale += spend;
    } else cur.unknown += impr;
    ageMap.set(age, cur);
  }

  const platforms = mergeBy(
    placementRaw.map((r) => bd(PLATFORM_LABEL[r.publisher_platform] ?? r.publisher_platform, Number(r.spend) || 0, Number(r.impressions) || 0, Number(r.inline_link_clicks) || 0)),
  );
  const placements = mergeBy(
    placementRaw.map((r) =>
      bd(`${PLATFORM_LABEL[r.publisher_platform] ?? r.publisher_platform} · ${POSITION_LABEL[r.platform_position] ?? r.platform_position}`, Number(r.spend) || 0, Number(r.impressions) || 0, Number(r.inline_link_clicks) || 0),
    ),
  ).slice(0, 10);
  const regions = mergeBy(regionRaw.map((r) => bd(cleanRegion(r.region), Number(r.spend) || 0, Number(r.impressions) || 0, Number(r.inline_link_clicks) || 0))).slice(0, 12);

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
    reachKnown: true,
    breakdownPeriod: { since, until },
    lastSync: new Date().toISOString(),
  };
}
