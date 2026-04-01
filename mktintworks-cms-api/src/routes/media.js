import { requireAuth } from "../middleware/auth.js";
import { resolveMediaPublicBaseUrl } from "../utils/catalog.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import {
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import { sanitizeText } from "../utils/validate.js";

const FRESH_MEDIA_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const DERIVABLE_MODULES = new Set([
  "blog",
  "gallery",
  "pages",
  "products",
  "promotions",
  "seo",
]);

const extensionFromType = (type) => {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  if (type === "image/gif") {
    return "gif";
  }
  return "jpg";
};

const normalizeUsageToken = (value) => {
  const raw = sanitizeText(value || "", 200).toLowerCase();
  if (!raw) {
    return "";
  }

  if (
    raw === "gallery" ||
    raw.startsWith("gallery:") ||
    raw.startsWith("gallery-")
  ) {
    return "gallery";
  }

  if (
    raw === "products" ||
    raw === "product" ||
    raw.startsWith("products:") ||
    raw.startsWith("product-")
  ) {
    return "products";
  }

  if (
    raw === "blog" ||
    raw.startsWith("blog:") ||
    raw.startsWith("blog-")
  ) {
    return "blog";
  }

  if (
    raw === "promotions" ||
    raw === "promotion" ||
    raw.startsWith("promotions:") ||
    raw.startsWith("promotion-")
  ) {
    return "promotions";
  }

  if (raw === "seo" || raw.startsWith("seo:")) {
    return "seo";
  }

  if (raw === "pages" || raw === "page" || raw.startsWith("pages:")) {
    return "pages";
  }

  if (raw.includes(":")) {
    const prefix = raw.split(":")[0];
    if (
      prefix === "nav" ||
      prefix === "footer" ||
      prefix === "home" ||
      prefix === "services" ||
      prefix === "book" ||
      prefix === "testimonials" ||
      prefix === "404"
    ) {
      return "pages";
    }
  }

  if (raw === "records" || raw === "record") {
    return "records";
  }

  if (raw === "invoices" || raw === "invoice") {
    return "invoices";
  }

  if (
    raw === "warranty" ||
    raw === "warranties" ||
    raw === "certificate"
  ) {
    return "warranty";
  }

  return raw;
};

const parseStoredUsage = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const extractImageSources = (value) =>
  Array.from(
    String(value || "").matchAll(
      /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi
    ),
    (match) => sanitizeText(match?.[1] || match?.[2] || match?.[3] || "", 2000)
  ).filter(Boolean);

const addUsage = (usageMap, url, module) => {
  const normalizedUrl = sanitizeText(url || "", 2000);
  const normalizedModule = normalizeUsageToken(module);

  if (!normalizedUrl || !normalizedModule) {
    return;
  }

  if (!usageMap.has(normalizedUrl)) {
    usageMap.set(normalizedUrl, new Set());
  }

  usageMap.get(normalizedUrl).add(normalizedModule);
};

const buildUsageLookup = async (env) => {
  const usageMap = new Map();

  const [
    galleryResult,
    productResult,
    blogResult,
    promotionResult,
    pageResult,
    seoResult,
  ] = await Promise.all([
    env.DB.prepare(
      `
        SELECT image_url, thumbnail_url
        FROM gallery
      `
    ).all(),
    env.DB.prepare(
      `
        SELECT image_url
        FROM products
        WHERE image_url IS NOT NULL AND TRIM(image_url) != ''
      `
    ).all(),
    env.DB.prepare(
      `
        SELECT featured_image_url, content
        FROM blog_posts
      `
    ).all(),
    env.DB.prepare(
      `
        SELECT image_url
        FROM promotions
        WHERE image_url IS NOT NULL AND TRIM(image_url) != ''
      `
    ).all(),
    env.DB.prepare(
      `
        SELECT content_type, content
        FROM pages
        WHERE content IS NOT NULL AND TRIM(content) != ''
      `
    ).all(),
    env.DB.prepare(
      `
        SELECT og_image_url
        FROM seo_settings
        WHERE og_image_url IS NOT NULL AND TRIM(og_image_url) != ''
      `
    ).all(),
  ]);

  for (const row of galleryResult.results || []) {
    addUsage(usageMap, row?.image_url, "gallery");
    addUsage(usageMap, row?.thumbnail_url, "gallery");
  }

  for (const row of productResult.results || []) {
    addUsage(usageMap, row?.image_url, "products");
  }

  for (const row of blogResult.results || []) {
    addUsage(usageMap, row?.featured_image_url, "blog");
    extractImageSources(row?.content).forEach((source) =>
      addUsage(usageMap, source, "blog")
    );
  }

  for (const row of promotionResult.results || []) {
    addUsage(usageMap, row?.image_url, "promotions");
  }

  for (const row of pageResult.results || []) {
    if (String(row?.content_type || "").toLowerCase() === "image") {
      addUsage(usageMap, row?.content, "pages");
      continue;
    }

    extractImageSources(row?.content).forEach((source) =>
      addUsage(usageMap, source, "pages")
    );
  }

  for (const row of seoResult.results || []) {
    addUsage(usageMap, row?.og_image_url, "seo");
  }

  return usageMap;
};

const normalizeMediaRow = (row, usageLookup) => {
  const cdnUrl = sanitizeText(row?.cdn_url || "", 2000);
  const liveUsage = Array.from(usageLookup.get(cdnUrl) || []);
  const storedFallbackUsage = parseStoredUsage(row?.used_in)
    .map(normalizeUsageToken)
    .filter(Boolean)
    .filter((module) => !DERIVABLE_MODULES.has(module));
  const usedIn = Array.from(new Set([...liveUsage, ...storedFallbackUsage])).sort();

  return {
    id: Number(row?.id || 0),
    filename: sanitizeText(row?.filename || "", 255),
    original_name: sanitizeText(row?.original_name || row?.filename || "", 255),
    cdn_url: cdnUrl,
    file_type: sanitizeText(row?.file_type || "", 120),
    file_size_kb:
      row?.file_size_kb === null || row?.file_size_kb === undefined
        ? null
        : Math.max(0, Number(row.file_size_kb) || 0),
    width_px:
      row?.width_px === null || row?.width_px === undefined
        ? null
        : Math.max(0, Number(row.width_px) || 0),
    height_px:
      row?.height_px === null || row?.height_px === undefined
        ? null
        : Math.max(0, Number(row.height_px) || 0),
    used_in: usedIn,
    is_orphan: usedIn.length === 0,
    uploaded_at: row?.uploaded_at || null,
  };
};

const getMedia = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const [result, usageLookup] = await Promise.all([
      env.DB.prepare(
        `
          SELECT
            id,
            filename,
            original_name,
            r2_key,
            cdn_url,
            file_type,
            file_size_kb,
            width_px,
            height_px,
            used_in,
            uploaded_at
          FROM media
          ORDER BY uploaded_at DESC, id DESC
        `
      ).all(),
      buildUsageLookup(env),
    ]);

    const files = (result.results || []).map((row) =>
      normalizeMediaRow(row, usageLookup)
    );
    const totalFileSizeKb = files.reduce(
      (sum, file) => sum + Math.max(0, Number(file.file_size_kb || 0)),
      0
    );

    return json(
      {
        files,
        totals: {
          files: files.length,
          images: files.filter((file) =>
            String(file.file_type || "").startsWith("image/")
          ).length,
          documents: files.filter(
            (file) => String(file.file_type || "").toLowerCase() === "application/pdf"
          ).length,
          orphaned: files.filter((file) => file.is_orphan).length,
          file_size_kb: totalFileSizeKb,
        },
      },
      { headers: FRESH_MEDIA_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch media library", error?.message);
    return serverError(request);
  }
};

const deleteMedia = async (request, env, mediaId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(mediaId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid media id is required." }, { status: 400 }, request);
  }

  try {
    const file = await env.DB.prepare(
      `
        SELECT id, r2_key, cdn_url
        FROM media
        WHERE id = ?
      `
    )
      .bind(id)
      .first();

    if (!file) {
      return json({ error: "File not found." }, { status: 404 }, request);
    }

    await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();

    try {
      const r2Key = sanitizeText(file.r2_key || "", 500);
      if (r2Key) {
        await env.MEDIA_BUCKET.delete(r2Key);
      }
    } catch (error) {
      console.error("R2 delete failed (non-fatal)", id, error?.message);
    }

    return json(
      { success: true, id, cdn_url: sanitizeText(file.cdn_url || "", 2000) },
      { headers: FRESH_MEDIA_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to delete media file", id, error?.message);
    return serverError(request);
  }
};

const uploadImage = async (request, env) => {
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

  const cmsKey = sanitizeText(formData.get("cms_key") || "", 180);
  const section = sanitizeText(formData.get("section") || "pages", 80);
  const extension = extensionFromType(file.type);
  const filename = generateSecureFilename("cms", extension);
  const r2Key = buildR2Key(section || "pages", filename);
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
        file.name || filename,
        r2Key,
        cdnUrl,
        file.type,
        fileSizeKb,
        JSON.stringify(cmsKey ? [cmsKey] : [])
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
      { headers: FRESH_MEDIA_HEADERS },
      request
    );
  } catch (error) {
    console.error("Image upload failed", error?.message);
    return serverError(request);
  }
};

export const handleMediaRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/media") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getMedia(request, env);
  }

  if (pathname === "/api/media/upload-image") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return uploadImage(request, env);
  }

  const mediaDetailMatch = pathname.match(/^\/api\/media\/(\d+)$/);
  if (mediaDetailMatch) {
    if (request.method !== "DELETE") {
      return methodNotAllowed(request, ["DELETE"]);
    }

    return deleteMedia(request, env, mediaDetailMatch[1]);
  }

  return json({ error: "Media route not found." }, { status: 404 }, request);
};
