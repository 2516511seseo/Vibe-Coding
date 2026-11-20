import { mkdir, readFile, writeFile } from "node:fs/promises";

const appConfig = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const configuredUrl = process.env.SITE_URL || (vercelDomain ? `https://${vercelDomain}` : appConfig.expo.extra?.siteUrl);
if (!configuredUrl) throw new Error("Set SITE_URL or expo.extra.siteUrl before generating SEO files.");

const origin = new URL(configuredUrl).origin;
const publicDirectory = new URL("../public/", import.meta.url);
await mkdir(publicDirectory, { recursive: true });
await writeFile(
  new URL("robots.txt", publicDirectory),
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  new URL("sitemap.xml", publicDirectory),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`,
);
