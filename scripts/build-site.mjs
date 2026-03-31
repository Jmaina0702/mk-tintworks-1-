import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const apiBase =
  process.env.CMS_API_BASE ||
  "https://mktintworks-cms-api.mktintworks.workers.dev";
const buildStamp = String(Date.now());
const publicSiteBase =
  process.env.PUBLIC_SITE_BASE || "https://mk-tintworks-1.pages.dev";

const displayDateFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const copyTargets = [
  { from: "_headers", to: "_headers" },
  { from: "_redirects", to: "_redirects" },
  { from: "404.html", to: "404.html" },
  { from: "assets", to: "assets" },
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
];

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, "&#96;");

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h2|h3|h4|section|article)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const categoryLabel = (value) =>
  String(value || "general")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toIsoDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().split("T")[0]
    : "";
};

const formatDisplayDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? displayDateFormatter.format(date)
    : "Draft";
};

const normalizeBlogArticle = (article) => ({
  id: Number(article?.id || 0),
  slug: String(article?.slug || "").trim(),
  title: String(article?.title || "").trim(),
  ai_title: String(article?.ai_title || "").trim(),
  meta_description: String(article?.meta_description || "").trim(),
  summary: String(article?.summary || "").trim(),
  keywords: String(article?.keywords || "").trim(),
  content: String(article?.content || "").trim(),
  featured_image_url: String(article?.featured_image_url || "").trim(),
  featured_image_alt: String(article?.featured_image_alt || "").trim(),
  category: String(article?.category || "general").trim().toLowerCase(),
  read_time_minutes: Math.max(1, Number(article?.read_time_minutes || 1)),
  status: String(article?.status || "draft").trim().toLowerCase(),
  source_type: String(article?.source_type || "written").trim().toLowerCase(),
  published_at: article?.published_at || null,
  created_at: article?.created_at || null,
});

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

const fetchGalleryState = async () => {
  const url = new URL(`${apiBase}/api/gallery/public`);
  url.searchParams.set("_build", buildStamp);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch gallery: ${response.status}`);
  }
  return response.json();
};

const fetchBlogState = async () => {
  const url = new URL(`${apiBase}/api/blog/public`);
  url.searchParams.set("_build", buildStamp);
  url.searchParams.set("full", "1");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch blog: ${response.status}`);
  }

  const payload = await response.json();
  return {
    articles: Array.isArray(payload?.articles)
      ? payload.articles.map(normalizeBlogArticle)
      : [],
  };
};

const fetchTestimonialsState = async () => {
  const url = new URL(`${apiBase}/api/testimonials/public`);
  url.searchParams.set("_build", buildStamp);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch testimonials: ${response.status}`);
  }

  const payload = await response.json();
  return {
    testimonials: Array.isArray(payload?.testimonials) ? payload.testimonials : [],
    generated_at: new Date().toISOString(),
  };
};

const injectContentState = (
  html,
  pageContent,
  sharedContent,
  productState,
  testimonialsState
) =>
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
    )
    .replace(
      /window\.CMS_TESTIMONIALS_STATE = window\.CMS_TESTIMONIALS_STATE \|\| \{ testimonials: \[\], generated_at: null \};/,
      `window.CMS_TESTIMONIALS_STATE = ${JSON.stringify(testimonialsState)};`
    );

const renderBlogCards = (articles) => {
  if (!articles.length) {
    return `
          <article class="blog-card glass-card">
            <div class="blog-card-body">
              <span class="blog-category">No Articles Yet</span>
              <h3>No published articles yet.</h3>
              <p>The blog will appear here as soon as articles are published from the CMS.</p>
            </div>
          </article>
    `;
  }

  return articles
    .map(
      (article, index) => `
          <article class="blog-card glass-card" data-reveal${
            index > 0 ? ` data-reveal-delay="${index}"` : ""
          }>
            <img
              src="${escapeAttribute(
                article.featured_image_url || "/assets/images/og-default.webp"
              )}"
              alt="${escapeAttribute(
                article.featured_image_alt || article.title || "MK Tintworks article preview"
              )}"
              loading="lazy"
              decoding="async"
              width="600"
              height="375"
            >
            <div class="blog-card-body">
              <span class="blog-category">${escapeHtml(categoryLabel(article.category))}</span>
              <h3>
                <a href="/blog/${escapeAttribute(article.slug)}.html">${escapeHtml(article.title)}</a>
              </h3>
              <p>${escapeHtml(article.summary || article.meta_description || "Read the latest guidance from MK Tintworks.")}</p>
              <p class="post-meta">
                <time datetime="${escapeAttribute(toIsoDate(article.published_at || article.created_at))}">
                  ${escapeHtml(formatDisplayDate(article.published_at || article.created_at))}
                </time>
                <span>${escapeHtml(`${article.read_time_minutes} min read`)}</span>
              </p>
              <a href="/blog/${escapeAttribute(article.slug)}.html" class="btn-ghost blog-card-action">Read More</a>
            </div>
          </article>
      `
    )
    .join("");
};

const replaceBlogGrid = (html, cardsMarkup) => {
  const startToken = '<div class="blog-grid" id="blog-grid">';
  const endToken = "\n        </div>\n      </div>\n    </section>";
  const start = html.indexOf(startToken);
  if (start === -1) {
    return html;
  }

  const end = html.indexOf(endToken, start);
  if (end === -1) {
    return html;
  }

  return `${html.slice(0, start + startToken.length)}
${cardsMarkup}${html.slice(end)}`;
};

const pickRelatedArticles = (articles, article) => {
  const peers = articles.filter((item) => item.slug !== article.slug);
  const sameCategory = peers.filter((item) => item.category === article.category);
  const fallback = peers.filter((item) => item.category !== article.category);
  return [...sameCategory, ...fallback].slice(0, 3);
};

const renderRelatedGrid = (articles) => {
  if (!articles.length) {
    return "";
  }

  return articles
    .map(
      (article) => `
          <article class="blog-card glass-card">
            <div class="blog-card-body">
              <span class="blog-category">${escapeHtml(categoryLabel(article.category))}</span>
              <h3><a href="/blog/${escapeAttribute(article.slug)}.html">${escapeHtml(article.title)}</a></h3>
            </div>
          </article>
      `
    )
    .join("");
};

const renderBlogArticlePage = (article, pageContent, sharedContent, relatedArticles) => {
  const seoTitle = article.ai_title || article.title;
  const description =
    article.meta_description ||
    article.summary ||
    stripHtml(article.content).substring(0, 160);
  const ogImage =
    article.featured_image_url || `${publicSiteBase}/assets/images/og-default.webp`;
  const canonical = `https://mktintworks.com/blog/${article.slug}.html`;
  const articleSlug = `blog-${article.slug}`;
  const articleDate = article.published_at || article.created_at;
  const articleDateIso = toIsoDate(articleDate);
  const ldJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description,
    datePublished: articleDateIso || undefined,
    author: { "@type": "Organization", name: "MK Tintworks" },
    publisher: {
      "@type": "Organization",
      name: "MK Tintworks",
      logo: {
        "@type": "ImageObject",
        url: "https://mktintworks.com/assets/images/logo/mk-logo-dark.png",
      },
    },
    image: ogImage,
    mainEntityOfPage: canonical,
  });
  const shareLabel = encodeURIComponent(`${article.title} ${canonical}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeAttribute(description)}">
  <meta name="theme-color" content="#0D0D0D">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeAttribute(seoTitle)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:image" content="${escapeAttribute(ogImage)}">
  <meta property="og:url" content="${escapeAttribute(canonical)}">
  <meta property="og:site_name" content="MK Tintworks">
  <title>${escapeHtml(seoTitle)} | MK Tintworks Blog</title>
  <link rel="canonical" href="${escapeAttribute(canonical)}">
  <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml">
  <link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/animations.css">
  <script>
    window.CMS_PAGE_SLUG = "${escapeAttribute(articleSlug)}";
    window.CMS_PAGE_CONTENT = ${JSON.stringify(pageContent)};
    window.CMS_SHARED_CONTENT = ${JSON.stringify(sharedContent)};
  </script>
  <script type="application/ld+json">${ldJson}</script>
</head>
<body class="article-page" data-page="blog">
  <div class="page-glow" aria-hidden="true"></div>
  <div data-site-nav data-active="blog"></div>
  <div data-wa-float></div>
  <main id="main-content">
    <article class="blog-post">
      <header class="post-hero">
        <div
          class="post-hero-media"
          role="img"
          aria-label="${escapeAttribute(
            article.featured_image_alt || `${article.title} hero image`
          )}"
          style="background-image:url('${escapeAttribute(ogImage)}')"
        ></div>
        <div class="post-hero-overlay" aria-hidden="true"></div>
        <div class="container post-hero-content">
          <span class="post-category">${escapeHtml(categoryLabel(article.category))}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <div class="post-meta">
            <time datetime="${escapeAttribute(articleDateIso)}">${escapeHtml(
              formatDisplayDate(articleDate)
            )}</time>
            <span>${escapeHtml(`${article.read_time_minutes} min read`)}</span>
          </div>
        </div>
      </header>

      <div class="post-body container">
        <aside class="post-toc">
          <p class="toc-title">In this article</p>
          <nav aria-label="Table of contents" data-post-toc></nav>
        </aside>
        <div class="post-content" data-post-body>
          ${article.content || `<p>${escapeHtml(description)}</p>`}
        </div>
      </div>

      <footer class="post-footer container">
        <div class="post-share">
          <p>Share this article:</p>
          <a class="share-link" href="https://wa.me/?text=${shareLabel}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="share-link" href="https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            canonical
          )}" target="_blank" rel="noopener noreferrer">Facebook</a>
          <button class="share-copy" data-copy-url="${escapeAttribute(canonical)}">Copy Link</button>
        </div>
        ${
          relatedArticles.length
            ? `<div class="related-grid">${renderRelatedGrid(relatedArticles)}</div>`
            : ""
        }
      </footer>
    </article>
  </main>
  <div data-book-cta></div>
  <div data-site-footer></div>
  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/cms-content.js" defer></script>
  <script>
    if (window.location.search.includes("cms_preview=true")) {
      var cmsPreviewScript = document.createElement("script");
      cmsPreviewScript.src = "/cms-preview-overlay.js";
      cmsPreviewScript.defer = true;
      document.head.appendChild(cmsPreviewScript);
    }
  </script>
  <script>
    (function loadTawk() {
      const load = () => {
        if (window._tawkLoaded) return;
        window._tawkLoaded = true;
        var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = "https://embed.tawk.to/69c1093d9f6b851c32e01e9f/1jkd0o6gd";
        s1.charset = "UTF-8";
        s1.setAttribute("crossorigin", "*");
        s0.parentNode.insertBefore(s1, s0);
      };
      ["scroll", "click", "touchstart", "keydown"].forEach((eventName) => {
        window.addEventListener(eventName, load, { once: true, passive: true });
      });
    })();
  </script>
</body>
</html>`;
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(path.join(dist, "blog"), { recursive: true });

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
let galleryState = {
  images: [],
};
let blogState = {
  articles: [],
};
let testimonialsState = {
  testimonials: [],
  generated_at: null,
};
let blogStateLoaded = false;

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

try {
  galleryState = await fetchGalleryState();
} catch (error) {
  console.warn("Gallery state fetch failed. Static gallery content will remain.", error.message);
}

try {
  blogState = await fetchBlogState();
  blogStateLoaded = Array.isArray(blogState.articles);
} catch (error) {
  console.warn("Blog state fetch failed. Static blog content will remain.", error.message);
}

try {
  testimonialsState = await fetchTestimonialsState();
} catch (error) {
  console.warn(
    "Testimonials state fetch failed. Static testimonials content will remain.",
    error.message
  );
}

for (const page of htmlPages) {
  let sourcePath = path.join(root, page.file);
  if (page.file === "blog/index.html") {
    sourcePath = path.join(root, "blog", "index.html");
  }

  const filePath = path.join(dist, page.file);
  const html = await readFile(sourcePath, "utf8");
  let pageContent = {};

  if (page.slug) {
    try {
      pageContent = await fetchContent(page.slug);
    } catch (error) {
      console.warn(`Page content fetch failed for ${page.slug}.`, error.message);
    }
  }

  let nextHtml = injectContentState(
    html,
    pageContent,
    {
      nav: navContent,
      footer: footerContent,
    },
    productState,
    testimonialsState
  ).replace(
    /window\.CMS_GALLERY_STATE = window\.CMS_GALLERY_STATE \|\| \{ images: \[\] \};/,
    `window.CMS_GALLERY_STATE = ${JSON.stringify(galleryState)};`
  );

  if (page.file === "blog/index.html" && blogStateLoaded) {
    nextHtml = replaceBlogGrid(nextHtml, renderBlogCards(blogState.articles));
  }

  await writeFile(filePath, nextHtml);
}

if (!blogStateLoaded) {
  await cp(path.join(root, "blog"), path.join(dist, "blog"), {
    recursive: true,
    force: true,
  });
} else {
  for (const article of blogState.articles) {
    let articlePageContent = {};

    try {
      articlePageContent = await fetchContent(`blog-${article.slug}`);
    } catch (error) {
      console.warn(`Page content fetch failed for blog-${article.slug}.`, error.message);
    }

    const articleHtml = renderBlogArticlePage(
      article,
      articlePageContent,
      {
        nav: navContent,
        footer: footerContent,
      },
      pickRelatedArticles(blogState.articles, article)
    );

    await writeFile(
      path.join(dist, "blog", `${article.slug}.html`),
      articleHtml
    );
  }
}

console.log("Built static site into dist/");
