import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const apiBase =
  process.env.CMS_API_BASE ||
  "https://mktintworks-cms-api.mktintworks.workers.dev";
const buildStamp = String(Date.now());

const copyTargets = [
  { from: "_headers", to: "_headers" },
  { from: "_redirects", to: "_redirects" },
  { from: "404.html", to: "404.html" },
  { from: "assets", to: "assets" },
  { from: "blog", to: "blog" },
  { from: "book.html", to: "book.html" },
  { from: "cms-preview-overlay.js", to: "cms-preview-overlay.js" },
  { from: "favicon.svg", to: "favicon.svg" },
  { from: "gallery.html", to: "gallery.html" },
  { from: "index.html", to: "index.html" },
  { from: "services.html", to: "services.html" },
  { from: "testimonials.html", to: "testimonials.html" },
];

const htmlPages = [
  { file: "index.html", slug: "home" },
  { file: "services.html", slug: "services" },
  { file: "gallery.html", slug: "gallery" },
  { file: "testimonials.html", slug: "testimonials" },
  { file: "book.html", slug: "book" },
  { file: "404.html", slug: "404" },
  { file: "blog/index.html", slug: "blog" },
  { file: "blog/3m-vs-llumar-kenya.html", slug: "blog-3m-vs-llumar-kenya" },
  {
    file: "blog/ntsa-tint-regulations-kenya-2026.html",
    slug: "blog-ntsa-tint-regulations-kenya-2026",
  },
];

const fetchContent = async (slug) => {
  const url = new URL(`${apiBase}/api/pages/content`);
  url.searchParams.set("slug", slug);
  url.searchParams.set("_build", buildStamp);
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${slug}: ${response.status}`);
  }

  const payload = await response.json();
  return payload.content || {};
};

const fetchProductState = async () => {
  const url = new URL(`${apiBase}/api/products/site-data`);
  url.searchParams.set("_build", buildStamp);
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  return response.json();
};

const injectContentState = (html, pageContent, sharedContent, productState) =>
  html
    .replace(
      /window\.CMS_PAGE_CONTENT = window\.CMS_PAGE_CONTENT \|\| \{\};/,
      `window.CMS_PAGE_CONTENT = ${JSON.stringify(pageContent)};`
    )
    .replace(
      /window\.CMS_SHARED_CONTENT = window\.CMS_SHARED_CONTENT \|\| \{ nav: \{\}, footer: \{\} \};/,
      `window.CMS_SHARED_CONTENT = ${JSON.stringify(sharedContent)};`
    )
    .replace(
      /window\.CMS_PRODUCTS_STATE = window\.CMS_PRODUCTS_STATE \|\| \{ products: \[\], groups: \{ "3m": \[\], llumar: \[\], other: \[\] \}, generated_at: null \};/,
      `window.CMS_PRODUCTS_STATE = ${JSON.stringify(productState)};`
    );

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const target of copyTargets) {
  await cp(path.join(root, target.from), path.join(dist, target.to), {
    recursive: true,
  });
}

let navContent = {};
let footerContent = {};
let productState = {
  products: [],
  groups: { "3m": [], llumar: [], other: [] },
  generated_at: null,
};

try {
  [navContent, footerContent] = await Promise.all([
    fetchContent("nav"),
    fetchContent("footer"),
  ]);
} catch (error) {
  console.warn("Shared CMS content fetch failed. Static labels will remain.", error.message);
}

try {
  productState = await fetchProductState();
} catch (error) {
  console.warn("Product state fetch failed. Static product content will remain.", error.message);
}

for (const page of htmlPages) {
  const filePath = path.join(dist, page.file);
  const html = await readFile(filePath, "utf8");
  let pageContent = {};

  if (page.slug) {
    try {
      pageContent = await fetchContent(page.slug);
    } catch (error) {
      console.warn(`Page content fetch failed for ${page.slug}.`, error.message);
    }
  }

  const nextHtml = injectContentState(
    html,
    pageContent,
    {
      nav: navContent,
      footer: footerContent,
    },
    productState
  );
  await writeFile(filePath, nextHtml);
}

console.log("Built static site into dist/");
