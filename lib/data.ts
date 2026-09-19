import { getMetaData } from "./meta";
import { getShopifyData } from "./shopify";
import { demoMeta, demoShopify } from "./demo";
import type { DashboardData } from "./types";
import { previousRange, type DateRange } from "./range";

export function isDemoMode(forceDemo?: boolean) {
  return !!forceDemo;
}

export async function loadDashboard(range: DateRange, forceDemo = false): Promise<DashboardData> {
  const prev = previousRange(range);
  const marginEnv = parseFloat(process.env.GROSS_MARGIN ?? "");
  const margin = isFinite(marginEnv) && marginEnv > 0 && marginEnv < 1 ? marginEnv : null;
  const updatedAt = new Date().toISOString();

  if (isDemoMode(forceDemo)) {
    const meta = demoMeta(range.since, range.until);
    return { demo: true, meta, metaError: null, shopify: demoShopify(range.since, range.until, meta), shopifyError: null, margin: margin ?? 0.45, updatedAt };
  }

  const [m, s] = await Promise.allSettled([
    getMetaData(range.key, range.since, range.until, prev),
    process.env.SHOPIFY_STORE_DOMAIN ? getShopifyData(range.since, range.until, prev) : Promise.reject(new Error("još nije povezana (nedostaju pristupni podaci u Vercelu).")),
  ]);

  return {
    demo: false,
    meta: m.status === "fulfilled" ? m.value : null,
    metaError: m.status === "rejected" ? String((m.reason as Error)?.message ?? m.reason) : null,
    shopify: s.status === "fulfilled" ? s.value : null,
    shopifyError: s.status === "rejected" ? String((s.reason as Error)?.message ?? s.reason) : null,
    margin,
    updatedAt,
  };
}
