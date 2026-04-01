import { requireAuth } from "../middleware/auth.js";
import {
  resolveMediaPublicBaseUrl,
  resolvePublicSiteBaseUrl,
} from "../utils/catalog.js";
import {
  buildSeoCacheKey,
  CACHE_TTLS,
  readCacheJson,
  triggerDeployHook,
  writeCacheJson,
} from "../utils/cache.js";
import {
  invalidJson,
  json,
  methodNotAllowed,
  serverError,
} from "../utils/http.js";
import {
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import { sanitizeText } from "../utils/validate.js";

const SEO_ALLOWED_SLUGS = [
  "home",
  "services",
  "gallery",
  "testimonials",
  "blog",
  "book",
];

const FRESH_SEO_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const extensionFromType = (type) => {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/jpeg" || type === "image/jpg") {
    return "jpg";
  }
  if (type === "image/gif") {
    return "gif";
  }
  return "webp";
};

const isAllowedSlug = (value) => SEO_ALLOWED_SLUGS.includes(String(value || ""));

const normalizeSeoImageUrl = (value, env) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${resolvePublicSiteBaseUrl(env)}${raw}`;
  }

  if (raw.startsWith("assets/")) {
    return `${resolvePublicSiteBaseUrl(env)}/${raw}`;
  }

  return `${resolveMediaPublicBaseUrl(env)}/${raw.replace(/^\/+/, "")}`;
};

const isSafeSeoImageValue = (value, env) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return true;
  }

  if (raw.startsWith("/") || raw.startsWith("assets/")) {
    return true;
  }

  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      (url.href.startsWith(`${resolvePublicSiteBaseUrl(env)}/`) ||
        url.href.startsWith(`${resolveMediaPublicBaseUrl(env)}/`) ||
        url.hostname === "mktintworks.com" ||
        url.hostname.endsWith(".mktintworks.com") ||
        url.hostname.endsWith(".pages.dev") ||
        url.hostname.endsWith(".r2.dev"))
    );
  } catch {
    return false;
  }
};

const normalizeSeoRow = (row, env) => ({
  page_slug: sanitizeText(row?.page_slug || "", 40),
  meta_title: sanitizeText(row?.meta_title || "", 60),
  meta_description: sanitizeText(row?.meta_description || "", 160),
  og_image_url: normalizeSeoImageUrl(row?.og_image_url || "", env),
  og_title: sanitizeText(row?.og_title || "", 60),
  og_description: sanitizeText(row?.og_description || "", 160),
  updated_at: row?.updated_at || null,
});

const buildDefaultSeoRow = (slug, env) =>
  normalizeSeoRow(
    {
      page_slug: slug,
      meta_title: "",
      meta_description: "",
      og_image_url: "",
      og_title: "",
      og_description: "",
      updated_at: null,
    },
    env
  );

const primeSeoCache = async (env, slug, row = null) => {
  const normalized = row
    ? normalizeSeoRow(row, env)
    : buildDefaultSeoRow(slug, env);

  await writeCacheJson(
    env,
    buildSeoCacheKey(slug),
    normalized,
    CACHE_TTLS.seo
  );

  return normalized;
};

const getSEOSettings = async (request, env, slug) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  if (!isAllowedSlug(slug)) {
    return json({ error: "Invalid page slug." }, { status: 400 }, request);
  }

  try {
    const cached = await readCacheJson(env, buildSeoCacheKey(slug));
    if (cached) {
      return json(
        {
          settings: cached,
          source: "cache",
        },
        { headers: FRESH_SEO_HEADERS },
        request
      );
    }

    const row = await env.DB.prepare(
      `
        SELECT
          page_slug,
          meta_title,
          meta_description,
          og_image_url,
          og_title,
          og_description,
          updated_at
        FROM seo_settings
        WHERE page_slug = ?
      `
    )
      .bind(slug)
      .first();

    return json(
      {
        settings: await primeSeoCache(
          env,
          slug,
          row || {
            page_slug: slug,
            meta_title: "",
            meta_description: "",
            og_image_url: "",
            og_title: "",
            og_description: "",
            updated_at: null,
          }
        ),
        source: "database",
      },
      { headers: FRESH_SEO_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch SEO settings", slug, error?.message);
    return serverError(request);
  }
};

const saveSEOSettings = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return invalidJson(request);
  }

  const pageSlug = sanitizeText(body?.page_slug || "", 40).toLowerCase();
  const metaTitle = sanitizeText(body?.meta_title || "", 60);
  const metaDescription = sanitizeText(body?.meta_description || "", 160);
  const ogImageUrl = sanitizeText(body?.og_image_url || "", 2000);
  const ogTitle = sanitizeText(body?.og_title || "", 60);
  const ogDescription = sanitizeText(body?.og_description || "", 160);

  if (!isAllowedSlug(pageSlug)) {
    return json({ error: "Invalid page slug." }, { status: 400 }, request);
  }

  if (!metaTitle) {
    return json({ error: "Meta title is required." }, { status: 400 }, request);
  }

  if (!metaDescription) {
    return json(
      { error: "Meta description is required." },
      { status: 400 },
      request
    );
  }

  if (!isSafeSeoImageValue(ogImageUrl, env)) {
    return json(
      {
        error:
          "OG image URL must be a public MK Tintworks asset path, Pages URL, or public R2 URL.",
      },
      { status: 400 },
      request
    );
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT og_image_url FROM seo_settings WHERE page_slug = ?"
    )
      .bind(pageSlug)
      .first();

    await env.DB.prepare(
      `
        INSERT INTO seo_settings (
          page_slug,
          meta_title,
          meta_description,
          og_image_url,
          og_title,
          og_description,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(page_slug)
        DO UPDATE SET
          meta_title = excluded.meta_title,
          meta_description = excluded.meta_description,
          og_image_url = COALESCE(excluded.og_image_url, seo_settings.og_image_url),
          og_title = excluded.og_title,
          og_description = excluded.og_description,
          updated_at = excluded.updated_at
      `
    )
      .bind(
        pageSlug,
        metaTitle,
        metaDescription,
        ogImageUrl || null,
        ogTitle || null,
        ogDescription || null
      )
      .run();

    const savedRow = await env.DB.prepare(
      `
        SELECT
          page_slug,
          meta_title,
          meta_description,
          og_image_url,
          og_title,
          og_description,
          updated_at
        FROM seo_settings
        WHERE page_slug = ?
      `
    )
      .bind(pageSlug)
      .first();

    await primeSeoCache(env, pageSlug, savedRow);
    await triggerDeployHook(env);

    return json(
      {
        success: true,
        settings: {
          page_slug: pageSlug,
          meta_title: metaTitle,
          meta_description: metaDescription,
          og_image_url: normalizeSeoImageUrl(
            ogImageUrl || existing?.og_image_url || "",
            env
          ),
          og_title: ogTitle,
          og_description: ogDescription,
        },
      },
      { headers: FRESH_SEO_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to save SEO settings", pageSlug, error?.message);
    return serverError(request);
  }
};

const uploadOGImage = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json(
      { error: "Request must be multipart/form-data." },
      { status: 400 },
      request
    );
  }

  const file = formData.get("image");
  const validationError = validateImageUpload(file);
  if (validationError) {
    return json({ error: validationError }, { status: 400 }, request);
  }

  const pageSlug = sanitizeText(formData.get("page") || "", 40).toLowerCase();
  if (!isAllowedSlug(pageSlug)) {
    return json({ error: "Invalid page slug." }, { status: 400 }, request);
  }

  const extension = extensionFromType(file.type);
  const filename = generateSecureFilename(`og-${pageSlug}`, extension);
  const r2Key = buildR2Key("seo/og-images", filename);
  const cdnUrl = `${resolveMediaPublicBaseUrl(env)}/${r2Key}`;
  const fileSizeKb = Math.max(1, Math.round(file.size / 1024));

  try {
    await env.MEDIA_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    await env.DB.prepare(
      `
        INSERT INTO media (
          filename,
          original_name,
          r2_key,
          cdn_url,
          file_type,
          file_size_kb,
          used_in
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        filename,
        sanitizeText(file.name || filename, 255),
        r2Key,
        cdnUrl,
        file.type,
        fileSizeKb,
        JSON.stringify(["seo"])
      )
      .run();

    return json(
      {
        success: true,
        filename,
        r2_key: r2Key,
        cdn_url: cdnUrl,
        file_type: file.type,
        file_size_kb: fileSizeKb,
      },
      { headers: FRESH_SEO_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to upload SEO OG image", pageSlug, error?.message);
    return serverError(request);
  }
};

const getAllSEOSettings = async (request, env) => {
  try {
    const settings = {};
    const missingSlugs = [];

    for (const slug of SEO_ALLOWED_SLUGS) {
      const cached = await readCacheJson(env, buildSeoCacheKey(slug));
      if (cached) {
        settings[slug] = cached;
      } else {
        missingSlugs.push(slug);
      }
    }

    if (missingSlugs.length) {
      const result = await env.DB.prepare(
        `
          SELECT
            page_slug,
            meta_title,
            meta_description,
            og_image_url,
            og_title,
            og_description,
            updated_at
          FROM seo_settings
          WHERE page_slug IN (${missingSlugs.map(() => "?").join(", ")})
          ORDER BY page_slug ASC
        `
      )
        .bind(...missingSlugs)
        .all();

      const rowsBySlug = new Map(
        (result.results || []).map((row) => [String(row?.page_slug || "").trim(), row])
      );

      for (const slug of missingSlugs) {
        settings[slug] = await primeSeoCache(
          env,
          slug,
          rowsBySlug.get(slug) || {
            page_slug: slug,
            meta_title: "",
            meta_description: "",
            og_image_url: "",
            og_title: "",
            og_description: "",
            updated_at: null,
          }
        );
      }
    }

    return json(
      { settings },
      { headers: FRESH_SEO_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch public SEO settings", error?.message);
    return serverError(request);
  }
};

export const handleSeoRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/seo/public") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getAllSEOSettings(request, env);
  }

  if (pathname === "/api/seo/save") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return saveSEOSettings(request, env);
  }

  if (pathname === "/api/seo/upload-og-image") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return uploadOGImage(request, env);
  }

  const seoSlugMatch = pathname.match(/^\/api\/seo\/([a-z0-9-]+)$/);
  if (seoSlugMatch) {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getSEOSettings(request, env, seoSlugMatch[1]);
  }

  return json({ error: "SEO route not found." }, { status: 404 }, request);
};
