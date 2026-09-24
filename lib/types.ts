export interface MetaTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
  frequency: number | null;
}

export interface MetaDaily extends MetaTotals {
  date: string;
}

export interface MetaAd extends MetaTotals {
  id: string;
  name: string;
  campaignName: string;
  status: string;
  thumbnail: string | null;
}

export interface MetaCampaign extends MetaTotals {
  id: string;
  name: string;
  firstDate: string;
  lastDate: string;
  status: string;
  objective: string;
  dailyBudget: number | null;
  results: number | null;
  resultLabel: string;
  daily: { date: string; spend: number }[];
  ads: MetaAd[];
}

export interface BreakdownRow {
  label: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
}

export interface MetaData {
  totals: MetaTotals;
  prevTotals: MetaTotals;
  daily: MetaDaily[];
  campaigns: MetaCampaign[];
  ads: MetaAd[];
  ageGender: { age: string; male: number; female: number; unknown: number; spendMale: number; spendFemale: number }[];
  platforms: BreakdownRow[];
  placements: BreakdownRow[];
  regions: BreakdownRow[];
  reachKnown: boolean;
  breakdownPeriod: { since: string; until: string } | null;
  lastSync: string | null;
}

export interface ShopifyOrderLite {
  date: string;
  total: number;
  returning: boolean;
  fromMeta: boolean;
  source: string;
}

export interface ShopifyData {
  currency: string;
  revenue: number;
  orders: number;
  prevRevenue: number;
  prevOrders: number;
  unitsSold: number;
  newCustomers: number;
  returningCustomers: number;
  metaOrders: number;
  metaRevenue: number;
  daily: { date: string; revenue: number; orders: number; newCustomers: number; returningCustomers: number }[];
  hourly: { hour: number; orders: number; revenue: number }[];
  topProducts: { title: string; units: number; revenue: number }[];
  sources: { label: string; orders: number; revenue: number }[];
  truncated: boolean;
}

export interface DashboardData {
  demo: boolean;
  meta: MetaData | null;
  metaError: string | null;
  shopify: ShopifyData | null;
  shopifyError: string | null;
  margin: number | null;
  updatedAt: string;
}
