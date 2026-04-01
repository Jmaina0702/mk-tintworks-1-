import { requireAuth } from "../middleware/auth.js";
import {
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
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import { ALLOWED, sanitizeText, validateDateRange, validateEnum } from "../utils/validate.js";

const ACTIVE_PROMOTIONS_CACHE_KEY = "promotions:active";
const MAX_PROMOTION_UPLOAD_BYTES = 800 * 1024;
const FRESH_PROMOTIONS_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const extensionFromType = (type) => {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/gif") {
    return "gif";
  }
  if (type === "image/webp") {
    return "webp";
  }
  return "jpg";
};

const normalizePromotionUrl = (value, env) => {
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

const ensureAnimationType = (value, request) => {
  const animationType = sanitizeText(value || "fade", 30).toLowerCase();
  if (!validateEnum(animationType, ALLOWED.animation_type)) {
    return json(
      {
        error: `animation_type must be one of: ${ALLOWED.animation_type.join(", ")}`,
      },
      { status: 400 },
      request
    );
  }

  return animationType;
};

const ensureSeason = (value, request) => {
  const season = sanitizeText(value || "", 30).toLowerCase();
  if (!season) {
    return null;
  }

  if (!validateEnum(season, ALLOWED.season)) {
    return json(
      { error: `season must be one of: ${ALLOWED.season.join(", ")}` },
      { status: 400 },
      request
    );
  }

  return season;
};

const ensureDisplayDuration = (value, request) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 30000) {
    return json(
      { error: "display_duration must be between 2000 and 30000 milliseconds." },
      { status: 400 },
      request
    );
  }

  return parsed;
};

const ensureLinkUrl = (value, request) => {
  const linkUrl = sanitizeText(value || "", 1000);
  if (!linkUrl) {
    return null;
  }

  if (linkUrl.startsWith("/")) {
    return linkUrl;
  }

  try {
    const url = new URL(linkUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid protocol");
    }

    return url.toString();
  } catch {
    return json(
      {
        error:
          "link_url must be an absolute http(s) URL or a site-relative path such as /services.html.",
      },
      { status: 400 },
      request
    );
  }
};

const isSafeImageValue = (value, env) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
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

const ensureImageUrl = (value, env, request) => {
  const imageUrl = sanitizeText(value || "", 2000);
  if (!imageUrl) {
    return null;
  }

  if (!isSafeImageValue(imageUrl, env)) {
    return json(
      {
        error:
          "image_url must be a public MK Tintworks asset path, Pages URL, or public R2 URL.",
      },
      { status: 400 },
      request
    );
  }

  return imageUrl;
};

const parsePromotionState = (row) => {
  const now = Date.now();
  const startTime = new Date(row?.start_datetime || "").getTime();
  const endTime = new Date(row?.end_datetime || "").getTime();
  const isActive = Number(row?.is_active || 0) === 1;

  if (Number.isFinite(endTime) && endTime <= now) {
    return "expired";
  }

  if (!isActive) {
    return "paused";
  }

  if (Number.isFinite(startTime) && startTime > now) {
    return "scheduled";
  }

  return "live";
};

const normalizePromotionRow = (row, env) => ({
  id: Number(row?.id || 0),
  title: sanitizeText(row?.title || "", 100),
  image_url: normalizePromotionUrl(row?.image_url, env),
  link_url: sanitizeText(row?.link_url || "", 1000),
  animation_type: sanitizeText(row?.animation_type || "fade", 30).toLowerCase(),
  display_duration: Math.max(2000, Number(row?.display_duration || 5000)),
  season: sanitizeText(row?.season || "", 30).toLowerCase() || null,
  custom_label: sanitizeText(row?.custom_label || "", 100),
  start_datetime: row?.start_datetime || null,
  end_datetime: row?.end_datetime || null,
  display_order: Number(row?.display_order || 0),
  is_active: Number(row?.is_active || 0) === 1 ? 1 : 0,
  created_at: row?.created_at || null,
  state: parsePromotionState(row),
});

const getPromotionById = async (env, id) =>
  env.DB.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();

const getNextDisplayOrder = async (env) => {
  const row = await env.DB.prepare(
    "SELECT COALESCE(MAX(display_order), -1) AS max_order FROM promotions"
  ).first();

  return Number(row?.max_order ?? -1) + 1;
};

const invalidateActivePromotionsCache = async (env) => {
  if (!env.CONTENT_CACHE || typeof env.CONTENT_CACHE.delete !== "function") {
    return;
  }

  await env.CONTENT_CACHE.delete(ACTIVE_PROMOTIONS_CACHE_KEY).catch(() => {});
};

const getPromotions = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const result = await env.DB.prepare(
      `
        SELECT *
        FROM promotions
        ORDER BY start_datetime DESC, id DESC
      `
    ).all();

    const promotions = (result.results || []).map((row) =>
      normalizePromotionRow(row, env)
    );

    return json({ promotions }, { headers: FRESH_PROMOTIONS_HEADERS }, request);
  } catch (error) {
    console.error("Failed to fetch promotions", error?.message);
    return serverError(request);
  }
};

const getPromotion = async (request, env, promotionId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(promotionId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid promotion id is required." }, { status: 400 }, request);
  }

  try {
    const row = await getPromotionById(env, id);
    if (!row) {
      return json({ error: "Promotion not found." }, { status: 404 }, request);
    }

    return json(
      { promotion: normalizePromotionRow(row, env) },
      { headers: FRESH_PROMOTIONS_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch promotion", id, error?.message);
    return serverError(request);
  }
};

const savePromotion = async (request, env) => {
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
    return json({ error: "Promotion id must be a positive integer." }, { status: 400 }, request);
  }

  const title = sanitizeText(body?.title || "", 100);
  if (!title) {
    return json({ error: "Title is required." }, { status: 400 }, request);
  }

  const imageUrl = ensureImageUrl(body?.image_url, env, request);
  if (imageUrl instanceof Response) {
    return imageUrl;
  }

  const linkUrl = ensureLinkUrl(body?.link_url, request);
  if (linkUrl instanceof Response) {
    return linkUrl;
  }

  const animationType = ensureAnimationType(body?.animation_type, request);
  if (animationType instanceof Response) {
    return animationType;
  }

  const displayDuration = ensureDisplayDuration(body?.display_duration, request);
  if (displayDuration instanceof Response) {
    return displayDuration;
  }

  const season = ensureSeason(body?.season, request);
  if (season instanceof Response) {
    return season;
  }

  const customLabel = sanitizeText(body?.custom_label || "", 100) || null;
  if (season === "custom" && !customLabel) {
    return json(
      { error: "custom_label is required when season is custom." },
      { status: 400 },
      request
    );
  }

  const startDateTime = String(body?.start_datetime || "").trim();
  const endDateTime = String(body?.end_datetime || "").trim();
  if (!validateDateRange(startDateTime, endDateTime)) {
    return json(
      { error: "Start date must be earlier than end date." },
      { status: 400 },
      request
    );
  }

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return json(
      { error: "Start and end dates must be valid date values." },
      { status: 400 },
      request
    );
  }

  const isActive = body?.is_active ? 1 : 0;

  try {
    const existing = id ? await getPromotionById(env, id) : null;
    if (id && !existing) {
      return json({ error: "Promotion not found." }, { status: 404 }, request);
    }

    if (!existing && !imageUrl) {
      return json(
        { error: "image_url is required when creating a new banner." },
        { status: 400 },
        request
      );
    }

    if (existing) {
      await env.DB.prepare(
        `
          UPDATE promotions
          SET
            title = ?,
            image_url = COALESCE(?, image_url),
            link_url = ?,
            animation_type = ?,
            display_duration = ?,
            season = ?,
            custom_label = ?,
            start_datetime = ?,
            end_datetime = ?,
            is_active = ?
          WHERE id = ?
        `
      )
        .bind(
          title,
          imageUrl || null,
          linkUrl,
          animationType,
          displayDuration,
          season,
          season === "custom" ? customLabel : customLabel,
          startDate.toISOString(),
          endDate.toISOString(),
          isActive,
          id
        )
        .run();
    } else {
      const displayOrder = await getNextDisplayOrder(env);

      await env.DB.prepare(
        `
          INSERT INTO promotions (
            title,
            image_url,
            link_url,
            animation_type,
            display_duration,
            season,
            custom_label,
            start_datetime,
            end_datetime,
            display_order,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
        .bind(
          title,
          imageUrl,
          linkUrl,
          animationType,
          displayDuration,
          season,
          season === "custom" ? customLabel : customLabel,
          startDate.toISOString(),
          endDate.toISOString(),
          displayOrder,
          isActive
        )
        .run();
    }

    await invalidateActivePromotionsCache(env);
    return json({ success: true }, { headers: FRESH_PROMOTIONS_HEADERS }, request);
  } catch (error) {
    console.error("Failed to save promotion", id || "new", error?.message);
    return serverError(request);
  }
};

const uploadPromotionImage = async (request, env) => {
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

  if (file.size > MAX_PROMOTION_UPLOAD_BYTES) {
    return json(
      {
        error:
          "Banner uploads must be compressed before upload. Keep each file under 800KB after compression.",
      },
      { status: 400 },
      request
    );
  }

  const extension = extensionFromType(file.type);
  const filename = generateSecureFilename("promotion", extension);
  const r2Key = buildR2Key("promotions", filename);
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
        JSON.stringify(["promotions"])
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
      { headers: FRESH_PROMOTIONS_HEADERS },
      request
    );
  } catch (error) {
    console.error("Promotion image upload failed", error?.message);
    return serverError(request);
  }
};

const deletePromotion = async (request, env, promotionId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(promotionId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid promotion id is required." }, { status: 400 }, request);
  }

  try {
    const existing = await getPromotionById(env, id);
    if (!existing) {
      return json({ error: "Promotion not found." }, { status: 404 }, request);
    }

    await env.DB.prepare("DELETE FROM promotions WHERE id = ?").bind(id).run();
    await invalidateActivePromotionsCache(env);

    return json({ success: true }, { headers: FRESH_PROMOTIONS_HEADERS }, request);
  } catch (error) {
    console.error("Failed to delete promotion", id, error?.message);
    return serverError(request);
  }
};

const getActivePromotions = async (request, env) => {
  try {
    if (env.CONTENT_CACHE && typeof env.CONTENT_CACHE.get === "function") {
      const cached = await env.CONTENT_CACHE.get(
        ACTIVE_PROMOTIONS_CACHE_KEY,
        "json"
      );

      if (Array.isArray(cached)) {
        return json(
          { promotions: cached },
          { headers: FRESH_PROMOTIONS_HEADERS },
          request
        );
      }
    }

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `
        SELECT
          id,
          title,
          image_url,
          link_url,
          animation_type,
          display_duration,
          season,
          custom_label,
          start_datetime,
          end_datetime,
          display_order,
          is_active,
          created_at
        FROM promotions
        WHERE is_active = 1
          AND start_datetime <= ?
          AND end_datetime > ?
        ORDER BY display_order ASC, start_datetime ASC, id ASC
      `
    )
      .bind(now, now)
      .all();

    const promotions = (result.results || [])
      .map((row) => normalizePromotionRow(row, env))
      .filter((promotion) => promotion.image_url);

    if (env.CONTENT_CACHE && typeof env.CONTENT_CACHE.put === "function") {
      await env.CONTENT_CACHE.put(
        ACTIVE_PROMOTIONS_CACHE_KEY,
        JSON.stringify(promotions),
        { expirationTtl: 60 }
      ).catch(() => {});
    }

    return json(
      { promotions },
      { headers: FRESH_PROMOTIONS_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch active promotions", error?.message);
    return serverError(request);
  }
};

export const handlePromotionsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/promotions/active") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getActivePromotions(request, env);
  }

  if (pathname === "/api/promotions") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getPromotions(request, env);
  }

  if (pathname === "/api/promotions/save") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return savePromotion(request, env);
  }

  if (pathname === "/api/promotions/upload-image") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return uploadPromotionImage(request, env);
  }

  if (pathname.startsWith("/api/promotions/")) {
    const promotionId = pathname.split("/").pop();

    if (request.method === "GET") {
      return getPromotion(request, env, promotionId);
    }

    if (request.method === "DELETE") {
      return deletePromotion(request, env, promotionId);
    }

    return methodNotAllowed(request, ["GET", "DELETE"]);
  }

  return json({ error: "Promotions route not found." }, { status: 404 }, request);
};
