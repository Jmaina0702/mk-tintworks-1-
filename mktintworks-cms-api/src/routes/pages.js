import { requireAuth } from "../middleware/auth.js";
import {
  buildPageCacheKey,
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
  sanitizeHTML,
  sanitizeText,
  validateEnum,
} from "../utils/validate.js";

const ALLOWED_TYPES = ["text", "html", "image", "link", "price"];
const FRESH_CONTENT_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const isSafeImageUrl = (value) => {
  try {
    const url = new URL(String(value).trim());
    return (
      url.protocol === "https:" &&
      (url.hostname === "mktintworks.com" ||
        url.hostname.endsWith(".mktintworks.com") ||
        url.hostname.endsWith(".r2.dev"))
    );
  } catch {
    return false;
  }
};

const sanitizeContentValue = (type, value) => {
  switch (type) {
    case "text":
    case "link":
    case "price":
      return sanitizeText(String(value), 10000);
    case "html":
      return sanitizeHTML(String(value), 50000);
    case "image": {
      const trimmed = String(value || "").trim();
      if (!isSafeImageUrl(trimmed)) {
        throw new Error(
          "image value must be an https:// URL from MK Tintworks or the public R2 bucket"
        );
      }
      return trimmed;
    }
    default:
      throw new Error("Unsupported content type");
  }
};

const cachePageContent = async (env, pageSlug) => {
  const rows = await env.DB.prepare(
    `
      SELECT section_key, content_type, content
      FROM pages
      WHERE page_slug = ?
      ORDER BY section_key
    `
  )
    .bind(pageSlug)
    .all();

  const content = {};
  for (const row of rows.results || []) {
    content[row.section_key] = row.content;
  }

  await writeCacheJson(
    env,
    buildPageCacheKey(pageSlug),
    content,
    CACHE_TTLS.pages
  );

  return content;
};

export const updatePageContent = async (request, env) => {
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

  const key = String(body?.key || "").trim();
  const type = String(body?.type || "").trim().toLowerCase();
  const value = body?.value;

  if (!key || key.indexOf(":") < 1 || key.indexOf(":") !== key.lastIndexOf(":")) {
    return json(
      { error: "key must be in format page_slug:section_key" },
      { status: 400 },
      request
    );
  }

  if (!validateEnum(type, ALLOWED_TYPES)) {
    return json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 },
      request
    );
  }

  if (value === undefined || value === null) {
    return json({ error: "value is required" }, { status: 400 }, request);
  }

  const [pageSlug, sectionKey] = key.split(":");
  if (!pageSlug || !sectionKey) {
    return json(
      { error: "key must include both page_slug and section_key" },
      { status: 400 },
      request
    );
  }

  let sanitized;
  try {
    sanitized = sanitizeContentValue(type, value);
  } catch (error) {
    return json({ error: error.message }, { status: 400 }, request);
  }

  try {
    await env.DB.prepare(
      `
        INSERT INTO pages (page_slug, section_key, content_type, content, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(page_slug, section_key)
        DO UPDATE SET
          content_type = excluded.content_type,
          content = excluded.content,
          updated_at = excluded.updated_at
      `
    )
      .bind(pageSlug, sectionKey, type, sanitized)
      .run();

    await cachePageContent(env, pageSlug);
    await triggerDeployHook(env);

    return json(
      { success: true, key, type, value: sanitized },
      { headers: FRESH_CONTENT_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to update page content", key, error?.message);
    return serverError(request);
  }
};

export const getPageContent = async (request, env) => {
  const url = new URL(request.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  const bypassCache = /^(1|true|yes)$/i.test(
    String(url.searchParams.get("fresh") || "").trim()
  );

  if (!slug) {
    return json({ error: "slug parameter required" }, { status: 400 }, request);
  }

  try {
    const cached = bypassCache
      ? null
      : await readCacheJson(env, buildPageCacheKey(slug));

    if (cached) {
      return json(
        { content: cached, source: "cache" },
        { headers: FRESH_CONTENT_HEADERS },
        request
      );
    }

    const content = await cachePageContent(env, slug);
    return json(
      { content, source: "database" },
      { headers: FRESH_CONTENT_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to read page content", slug, error?.message);
    return serverError(request);
  }
};

export const handlePagesRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/pages/content") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }
    return getPageContent(request, env);
  }

  if (pathname === "/api/pages/update") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }
    return updatePageContent(request, env);
  }

  return json({ error: "Page route not found." }, { status: 404 }, request);
};
