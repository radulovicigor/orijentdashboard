// Meta Graph API (System User token, ads_read, bez isteka). Set u Vercel environment varijablama.
export const META_ACCESS_TOKEN = (process.env.META_ACCESS_TOKEN || "").trim();
export const META_AD_ACCOUNT_ID = (process.env.META_AD_ACCOUNT_ID || "").trim();
export const META_API_VERSION = (process.env.META_API_VERSION || "v23.0").trim();
