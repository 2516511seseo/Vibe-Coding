import appConfig from "../../app.json";

export function getSiteOrigin() {
  const explicitUrl = process.env.SITE_URL;
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const configuredUrl = explicitUrl || (vercelDomain ? `https://${vercelDomain}` : appConfig.expo.extra?.siteUrl);
  if (!configuredUrl) throw new Error("Set SITE_URL or expo.extra.siteUrl before generating SEO metadata.");
  return new URL(configuredUrl).origin;
}
