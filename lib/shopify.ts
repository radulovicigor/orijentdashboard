import type { ShopifyData } from "./types";
import { eachDay } from "./range";

const VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const REVALIDATE = 3600;

function shopDomain() {
  const d = process.env.SHOPIFY_STORE_DOMAIN;
  if (!d) throw new Error("SHOPIFY_STORE_DOMAIN nije postavljen");
  return d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

let cachedToken: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN;
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Shopify pristup nije podešen (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)");
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Shopify token: ${json?.error_description ?? json?.error ?? res.statusText}`);
  }
  cachedToken = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 86399) * 1000 };
  return cachedToken.token;
}

async function gql<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shopDomain()}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: REVALIDATE },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Shopify API: ${res.status} ${JSON.stringify(json?.errors ?? res.statusText)}`);
  if (json.errors?.length) throw new Error(`Shopify API: ${json.errors.map((e: any) => e.message).join("; ")}`);
  return json.data as T;
}

const JOURNEY = `customerJourneySummary { firstVisit { source utmParameters { source medium } } lastVisit { source utmParameters { source medium } } }`;

function ordersQuery(withCustomer: boolean, withJourney: boolean) {
  return `query Orders($q: String!, $after: String) {
    orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        cancelledAt
        test
        sourceName
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        ${withCustomer ? "customer { numberOfOrders }" : ""}
        ${withJourney ? JOURNEY : ""}
        lineItems(first: 50) { nodes { title quantity discountedTotalSet { shopMoney { amount } } } }
      }
    }
  }`;
}

function isMetaSource(s: string) {
  const l = s.toLowerCase().trim();
  return l.includes("facebook") || l.includes("instagram") || ["fb", "ig", "meta", "an", "msg", "threads"].includes(l);
}

function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Podgorica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function localHour(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Podgorica", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
}

async function fetchOrders(since: string, until: string, maxPages: number) {
  // Shopify search: dates are interpreted in the shop's timezone
  const q = `created_at:>='${since}T00:00:00' AND created_at:<='${until}T23:59:59'`;
  const variants: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, false],
  ];
  let lastErr: unknown;
  for (const [withCustomer, withJourney] of variants) {
    try {
      const nodes: any[] = [];
      let after: string | null = null;
      let pages = 0;
      let truncated = false;
      do {
        const data: any = await gql(ordersQuery(withCustomer, withJourney), { q, after });
        nodes.push(...data.orders.nodes);
        after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
        pages++;
        if (after && pages >= maxPages) {
          truncated = true;
          break;
        }
      } while (after);
      return { nodes, truncated };
    } catch (e) {
      lastErr = e;
      // Retry without protected-customer-data fields if access is denied
      if (!/access|denied|permission|protected/i.test(String(e))) throw e;
    }
  }
  throw lastErr;
}

export async function getShopifyData(since: string, until: string, prev: { since: string; until: string }): Promise<ShopifyData> {
  const [cur, prv] = await Promise.all([fetchOrders(since, until, 20), fetchOrders(prev.since, prev.until, 20)]);

  const valid = (o: any) => !o.cancelledAt && !o.test;
  const orders = cur.nodes.filter(valid);
  const prevOrders = prv.nodes.filter(valid);

  const amount = (o: any) => parseFloat(o.currentTotalPriceSet?.shopMoney?.amount ?? "0") || 0;
  const currency = orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode ?? "EUR";

  const dayMap = new Map(eachDay(since, until).map((d) => [d, { date: d, revenue: 0, orders: 0, newCustomers: 0, returningCustomers: 0 }]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  const products = new Map<string, { title: string; units: number; revenue: number }>();
  const sources = new Map<string, { label: string; orders: number; revenue: number }>();
  let units = 0;
  let newC = 0;
  let retC = 0;
  let metaOrders = 0;
  let metaRevenue = 0;

  for (const o of orders) {
    const total = amount(o);
    const day = dayMap.get(localDate(o.createdAt));
    if (day) {
      day.revenue += total;
      day.orders += 1;
    }
    const h = hourly[localHour(o.createdAt)];
    if (h) {
      h.orders += 1;
      h.revenue += total;
    }
    for (const li of o.lineItems?.nodes ?? []) {
      units += li.quantity;
      const p = products.get(li.title) ?? { title: li.title, units: 0, revenue: 0 };
      p.units += li.quantity;
      p.revenue += parseFloat(li.discountedTotalSet?.shopMoney?.amount ?? "0") || 0;
      products.set(li.title, p);
    }
    if (o.customer) {
      if (Number(o.customer.numberOfOrders) > 1) {
        retC++;
        if (day) day.returningCustomers += 1;
      } else {
        newC++;
        if (day) day.newCustomers += 1;
      }
    }
    const j = o.customerJourneySummary;
    const srcParts = [
      j?.lastVisit?.utmParameters?.source,
      j?.lastVisit?.source,
      j?.firstVisit?.utmParameters?.source,
      j?.firstVisit?.source,
    ].filter(Boolean) as string[];
    const isMeta = srcParts.some(isMetaSource);
    let label: string;
    if (isMeta) label = "Meta (Facebook / Instagram)";
    else if (srcParts.length) label = prettySource(srcParts[0]);
    else label = o.sourceName === "pos" ? "Prodavnica (POS)" : "Direktno / nepoznato";
    if (isMeta) {
      metaOrders++;
      metaRevenue += total;
    }
    const s = sources.get(label) ?? { label, orders: 0, revenue: 0 };
    s.orders++;
    s.revenue += total;
    sources.set(label, s);
  }

  return {
    currency,
    revenue: orders.reduce((a, o) => a + amount(o), 0),
    orders: orders.length,
    prevRevenue: prevOrders.reduce((a, o) => a + amount(o), 0),
    prevOrders: prevOrders.length,
    unitsSold: units,
    newCustomers: newC,
    returningCustomers: retC,
    metaOrders,
    metaRevenue,
    daily: [...dayMap.values()],
    hourly,
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    sources: [...sources.values()].sort((a, b) => b.revenue - a.revenue),
    truncated: cur.truncated || prv.truncated,
  };
}

function prettySource(s: string) {
  const l = s.toLowerCase();
  if (l.includes("google")) return "Google";
  if (l.includes("tiktok")) return "TikTok";
  if (l.includes("email") || l.includes("klaviyo") || l.includes("mail")) return "Email";
  if (l === "direct" || l === "(direct)") return "Direktno / nepoznato";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
