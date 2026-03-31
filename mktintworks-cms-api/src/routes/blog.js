import { requireAuth } from "../middleware/auth.js";
import {
  triggerDeploy,
  resolveMediaPublicBaseUrl,
  resolvePublicSiteBaseUrl,
} from "../utils/catalog.js";
import {
  invalidJson,
  json,
  methodNotAllowed,
  serverError,
} from "../utils/http.js";
import {
  ALLOWED,
  generateSlug,
  sanitizeHTML,
  sanitizeText,
  validateEnum,
  validateSlug,
} from "../utils/validate.js";

const FRESH_BLOG_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const normalizeBlogUrl = (value, env) => {
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

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h2|h3|h4|section|article)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatKeywords = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeText(item, 60))
      .filter(Boolean)
      .join(", ");
  }

  const raw = sanitizeText(value || "", 500);
  if (!raw) {
    return "";
  }

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => sanitizeText(item, 60))
          .filter(Boolean)
          .join(", ");
      }
    } catch {
      // Fall back to comma-delimited text.
    }
  }

  return raw;
};

const buildSummary = (row) => {
  const stored = sanitizeText(row?.summary || "", 600);
  if (stored) {
    return stored;
  }

  const metaDescription = sanitizeText(row?.meta_description || "", 160);
  if (metaDescription) {
    return metaDescription;
  }

  return sanitizeText(stripHtml(row?.content || ""), 240);
};

const normalizeArticleRow = (row, env, { includeContent = false } = {}) => ({
  id: Number(row?.id || 0),
  slug: sanitizeText(row?.slug || "", 100),
  title: sanitizeText(row?.title || "", 300),
  ai_title: sanitizeText(row?.ai_title || "", 60),
  meta_description: sanitizeText(row?.meta_description || "", 160),
  summary: buildSummary(row),
  keywords: formatKeywords(row?.keywords || ""),
  content: includeContent ? row?.content || "" : undefined,
  featured_image_url: normalizeBlogUrl(row?.featured_image_url, env),
  featured_image_alt: sanitizeText(row?.featured_image_alt || "", 200),
  category: sanitizeText(row?.category || "general", 40).toLowerCase(),
  read_time_minutes: Math.max(1, Number(row?.read_time_minutes || 1)),
  status: sanitizeText(row?.status || "draft", 20).toLowerCase(),
  source_type: sanitizeText(row?.source_type || "written", 30).toLowerCase(),
  published_at: row?.published_at || null,
  created_at: row?.created_at || null,
});

const findArticleById = async (env, id) =>
  env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first();

const findArticleBySlug = async (env, slug) =>
  env.DB.prepare("SELECT id, slug FROM blog_posts WHERE slug = ?")
    .bind(slug)
    .first();

const normalizeIncomingSlug = (value) => {
  const raw = sanitizeText(value || "", 140).toLowerCase();
  if (!raw) {
    return "";
  }

  const cleaned = raw
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);

  return cleaned;
};

const createAutoSlug = (title) => {
  const generated = normalizeIncomingSlug(generateSlug(title || ""));
  if (generated) {
    return generated;
  }

  return `article-${Date.now()}`;
};

const buildUniqueSlug = async (env, baseSlug, excludeId = null) => {
  const root = normalizeIncomingSlug(baseSlug) || `article-${Date.now()}`;
  let candidate = root;
  let suffix = 2;

  while (true) {
    const existing = await findArticleBySlug(env, candidate);
    if (!existing || Number(existing.id) === Number(excludeId || 0)) {
      return candidate;
    }

    candidate = `${root}-${suffix}`.substring(0, 100);
    suffix += 1;
  }
};

const ensureCategory = (value, request) => {
  const category = sanitizeText(value || "general", 40).toLowerCase();
  if (!validateEnum(category, ALLOWED.blog_category)) {
    return json(
      {
        error: `category must be one of: ${ALLOWED.blog_category.join(", ")}`,
      },
      { status: 400 },
      request
    );
  }

  return category;
};

const ensureStatus = (value, request) => {
  const status = sanitizeText(value || "draft", 20).toLowerCase();
  if (!validateEnum(status, ALLOWED.blog_status)) {
    return json(
      { error: `status must be one of: ${ALLOWED.blog_status.join(", ")}` },
      { status: 400 },
      request
    );
  }

  return status;
};

const ensureSourceType = (value, request) => {
  const sourceType = sanitizeText(value || "written", 30).toLowerCase();
  const allowed = ["written", "docx_upload", "pdf_upload"];
  if (!allowed.includes(sourceType)) {
    return json(
      { error: `source_type must be one of: ${allowed.join(", ")}` },
      { status: 400 },
      request
    );
  }

  return sourceType;
};

const isSafeImageValue = (value, env) => {
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
        url.hostname.endsWith(".r2.dev"))
    );
  } catch {
    return false;
  }
};

const validateFeaturedImage = (value, env, request) => {
  const featuredImageUrl = sanitizeText(value || "", 2000);
  if (!isSafeImageValue(featuredImageUrl, env)) {
    return json(
      {
        error:
          "featured_image_url must be a relative site asset, a public R2 asset, or an MK Tintworks https:// URL.",
      },
      { status: 400 },
      request
    );
  }

  return featuredImageUrl;
};

const getArticles = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const result = await env.DB.prepare(
      `
        SELECT
          id,
          slug,
          title,
          category,
          status,
          read_time_minutes,
          published_at,
          created_at
        FROM blog_posts
        ORDER BY
          CASE status
            WHEN 'published' THEN 0
            WHEN 'draft' THEN 1
            ELSE 2
          END ASC,
          COALESCE(published_at, created_at) DESC,
          id DESC
      `
    ).all();

    const articles = (result.results || []).map((row) =>
      normalizeArticleRow(row, env)
    );
    return json({ articles }, { headers: FRESH_BLOG_HEADERS }, request);
  } catch (error) {
    console.error("Failed to fetch CMS blog articles", error?.message);
    return serverError(request);
  }
};

const getArticle = async (request, env, articleId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(articleId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid article id is required." }, { status: 400 }, request);
  }

  try {
    const row = await findArticleById(env, id);
    if (!row) {
      return json({ error: "Article not found." }, { status: 404 }, request);
    }

    return json(
      { article: normalizeArticleRow(row, env, { includeContent: true }) },
      { headers: FRESH_BLOG_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch article", id, error?.message);
    return serverError(request);
  }
};

const saveArticle = async (request, env) => {
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

  const id = body?.id ? Number(body.id) : null;
  if (id !== null && (!Number.isInteger(id) || id <= 0)) {
    return json({ error: "Article id must be a positive integer." }, { status: 400 }, request);
  }

  const title = sanitizeText(body?.title || "", 300);
  if (!title) {
    return json({ error: "Title is required." }, { status: 400 }, request);
  }

  const content = sanitizeHTML(body?.content || "", 200000);
  const aiTitle = sanitizeText(body?.ai_title || "", 60);
  const metaDescription = sanitizeText(body?.meta_description || "", 160);
  const summary = sanitizeText(body?.summary || "", 600);
  const keywords = formatKeywords(body?.keywords || "");
  const readTimeMinutes = Math.max(
    1,
    Math.min(999, parseInt(body?.read_time_minutes, 10) || 1)
  );
  const category = ensureCategory(body?.category, request);
  if (typeof category !== "string") {
    return category;
  }

  const status = ensureStatus(body?.status, request);
  if (typeof status !== "string") {
    return status;
  }

  const sourceType = ensureSourceType(body?.source_type, request);
  if (typeof sourceType !== "string") {
    return sourceType;
  }

  const featuredImageUrl = validateFeaturedImage(
    body?.featured_image_url,
    env,
    request
  );
  if (typeof featuredImageUrl !== "string") {
    return featuredImageUrl;
  }

  const featuredImageAlt = sanitizeText(body?.featured_image_alt || "", 200);
  const requestedSlug = normalizeIncomingSlug(body?.slug || "");

  if (status === "published") {
    if (!requestedSlug) {
      return json(
        { error: "Slug is required to publish an article." },
        { status: 400 },
        request
      );
    }

    if (!metaDescription) {
      return json(
        { error: "Meta description is required to publish an article." },
        { status: 400 },
        request
      );
    }
  }

  if (requestedSlug && !validateSlug(requestedSlug)) {
    return json(
      { error: "Slug must be lowercase and use hyphens only." },
      { status: 400 },
      request
    );
  }

  try {
    const existing = id ? await findArticleById(env, id) : null;
    if (id && !existing) {
      return json({ error: "Article not found." }, { status: 404 }, request);
    }

    let slug = requestedSlug;
    if (!slug) {
      slug = createAutoSlug(title);
      slug = await buildUniqueSlug(env, slug, id);
    } else {
      const slugOwner = await findArticleBySlug(env, slug);
      if (slugOwner && Number(slugOwner.id) !== Number(id || 0)) {
        return json(
          { error: "A post with this slug already exists." },
          { status: 409 },
          request
        );
      }
    }

    const now = new Date().toISOString();
    let articleId = id;
    let publishedAt = existing?.published_at || null;

    if (status === "published" && !publishedAt) {
      publishedAt = now;
    }

    if (existing) {
      await env.DB.prepare(
        `
          UPDATE blog_posts
          SET
            slug = ?,
            title = ?,
            ai_title = ?,
            meta_description = ?,
            summary = ?,
            keywords = ?,
            content = ?,
            featured_image_url = ?,
            featured_image_alt = ?,
            category = ?,
            read_time_minutes = ?,
            status = ?,
            source_type = ?,
            published_at = ?
          WHERE id = ?
        `
      )
        .bind(
          slug,
          title,
          aiTitle,
          metaDescription,
          summary,
          keywords,
          content,
          featuredImageUrl || null,
          featuredImageAlt,
          category,
          readTimeMinutes,
          status,
          sourceType,
          publishedAt,
          articleId
        )
        .run();
    } else {
      const insertResult = await env.DB.prepare(
        `
          INSERT INTO blog_posts (
            slug,
            title,
            ai_title,
            meta_description,
            summary,
            keywords,
            content,
            featured_image_url,
            featured_image_alt,
            category,
            read_time_minutes,
            status,
            source_type,
            published_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
        .bind(
          slug,
          title,
          aiTitle,
          metaDescription,
          summary,
          keywords,
          content,
          featuredImageUrl || null,
          featuredImageAlt,
          category,
          readTimeMinutes,
          status,
          sourceType,
          publishedAt
        )
        .run();

      articleId = Number(insertResult.meta?.last_row_id || 0);
    }

    if (status === "published" || existing?.status === "published") {
      await triggerDeploy(env);
    }

    return json(
      {
        success: true,
        id: articleId,
        slug,
        status,
      },
      { headers: FRESH_BLOG_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to save blog article", id || "new", error?.message);
    return serverError(request);
  }
};

const deleteArticle = async (request, env, articleId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(articleId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid article id is required." }, { status: 400 }, request);
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT id, status FROM blog_posts WHERE id = ?"
    )
      .bind(id)
      .first();

    if (!existing) {
      return json({ error: "Article not found." }, { status: 404 }, request);
    }

    await env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id).run();

    if (sanitizeText(existing.status || "", 20).toLowerCase() === "published") {
      await triggerDeploy(env);
    }

    return json({ success: true }, { headers: FRESH_BLOG_HEADERS }, request);
  } catch (error) {
    console.error("Failed to delete article", id, error?.message);
    return serverError(request);
  }
};

const getPublishedArticles = async (request, env) => {
  const url = new URL(request.url);
  const category = sanitizeText(url.searchParams.get("category") || "", 40).toLowerCase();
  const slug = normalizeIncomingSlug(url.searchParams.get("slug") || "");
  const includeContent =
    url.searchParams.get("full") === "1" || url.searchParams.get("full") === "true";

  if (category && !validateEnum(category, ALLOWED.blog_category)) {
    return json(
      {
        error: `category must be one of: ${ALLOWED.blog_category.join(", ")}`,
      },
      { status: 400 },
      request
    );
  }

  try {
    if (slug) {
      const row = await env.DB.prepare(
        `
          SELECT *
          FROM blog_posts
          WHERE slug = ? AND status = 'published'
          LIMIT 1
        `
      )
        .bind(slug)
        .first();

      if (!row) {
        return json({ error: "Article not found." }, { status: 404 }, request);
      }

      return json(
        { article: normalizeArticleRow(row, env, { includeContent: true }) },
        { headers: FRESH_BLOG_HEADERS },
        request
      );
    }

    const clauses = ["status = 'published'"];
    const bindings = [];
    if (category) {
      clauses.push("category = ?");
      bindings.push(category);
    }

    const selectFields = includeContent
      ? "*"
      : `
          id,
          slug,
          title,
          ai_title,
          meta_description,
          summary,
          keywords,
          featured_image_url,
          featured_image_alt,
          category,
          read_time_minutes,
          status,
          source_type,
          published_at,
          created_at
        `;

    const statement = env.DB.prepare(
      `
        SELECT ${selectFields}
        FROM blog_posts
        WHERE ${clauses.join(" AND ")}
        ORDER BY published_at DESC, created_at DESC, id DESC
      `
    );

    const result =
      bindings.length > 0 ? await statement.bind(...bindings).all() : await statement.all();

    const articles = (result.results || []).map((row) =>
      normalizeArticleRow(row, env, { includeContent })
    );

    return json(
      { articles },
      { headers: FRESH_BLOG_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch public blog data", error?.message);
    return serverError(request);
  }
};

const generateBlogSEO = async (request, env) => {
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

  const text = sanitizeText(body?.text || "", 12000);
  const title = sanitizeText(body?.title || "", 300);

  if (text.trim().length < 100) {
    return json(
      { error: "Text must be at least 100 characters." },
      { status: 400 },
      request
    );
  }

  if (!env.AI || typeof env.AI.run !== "function") {
    return json(
      {
        error:
          "Workers AI is unavailable right now. Fill the SEO fields manually and continue publishing.",
      },
      { status: 503 },
      request
    );
  }

  const truncated = text.substring(0, 3000).trim();
  const prompt = `You are an SEO expert for MK Tintworks, a premium window tinting business in Nairobi, Kenya.

Read the following article text and generate SEO metadata optimized for Google Kenya search.

Article title: "${title || "untitled"}"

Article text (first 3000 characters):
"""
${truncated}
"""

Respond with ONLY a valid JSON object. No markdown. No explanation.
Use this exact format:
{
  "title": "SEO title under 60 characters targeting Kenya window tinting search",
  "meta_description": "Compelling description under 160 characters with primary keyword and call to action",
  "summary": "2 to 3 sentence summary for the article listing page. Should make readers want to read the full article.",
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "slug": "url-friendly-slug-lowercase-hyphens-no-spaces"
}`;

  try {
    const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const raw =
      aiResponse?.response ||
      aiResponse?.result?.response ||
      aiResponse?.text ||
      "";
    const jsonMatch = String(raw).match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON.");
    }

    const seoData = JSON.parse(jsonMatch[0]);
    const seoSlug = normalizeIncomingSlug(seoData?.slug || title || "");

    return json(
      {
        title: sanitizeText(seoData?.title || title, 60),
        meta_description: sanitizeText(seoData?.meta_description || "", 160),
        summary: sanitizeText(seoData?.summary || "", 600),
        keywords: formatKeywords(seoData?.keywords || ""),
        slug: seoSlug || createAutoSlug(title),
      },
      { headers: FRESH_BLOG_HEADERS },
      request
    );
  } catch (error) {
    console.error("Blog SEO generation failed", error?.message);
    return json(
      {
        error:
          "AI generation failed. You can still publish by filling the SEO fields manually.",
        detail: sanitizeText(error?.message || "Unknown AI error", 300),
      },
      { status: 500 },
      request
    );
  }
};

export const handleBlogRequest = async (request, env) => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/blog/public") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getPublishedArticles(request, env);
  }

  if (pathname === "/api/blog") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getArticles(request, env);
  }

  if (pathname === "/api/blog/save") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return saveArticle(request, env);
  }

  if (pathname === "/api/blog/generate-seo") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return generateBlogSEO(request, env);
  }

  if (pathname.startsWith("/api/blog/")) {
    const articleId = pathname.split("/").pop();
    if (request.method === "GET") {
      return getArticle(request, env, articleId);
    }

    if (request.method === "DELETE") {
      return deleteArticle(request, env, articleId);
    }

    return methodNotAllowed(request, ["GET", "DELETE"]);
  }

  return json({ error: "Blog route not found." }, { status: 404 }, request);
};
