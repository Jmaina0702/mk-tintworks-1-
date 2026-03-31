import { requireAuth } from "../middleware/auth.js";
import {
  triggerDeploy,
  resolveMediaPublicBaseUrl,
  resolvePublicSiteBaseUrl,
} from "../utils/catalog.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import {
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import { ALLOWED, sanitizeText, validateEnum } from "../utils/validate.js";

const MAX_GALLERY_UPLOAD_BYTES = 400 * 1024;
const FRESH_GALLERY_HEADERS = {
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

const normalizeGalleryUrl = (value, env) => {
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

const normalizeGalleryRow = (row, env) => {
  const imageUrl = normalizeGalleryUrl(row.image_url, env);
  const thumbnailUrl = normalizeGalleryUrl(row.thumbnail_url || row.image_url, env);

  return {
    id: Number(row.id || 0),
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl || imageUrl,
    caption: String(row.caption || "").trim(),
    category: String(row.category || "automotive").trim().toLowerCase(),
    alt_text: String(row.alt_text || "").trim(),
    display_order: Number(row.display_order || 0),
    file_size_kb:
      row.file_size_kb === null || row.file_size_kb === undefined
        ? null
        : Number(row.file_size_kb),
    original_name: String(row.original_name || "").trim(),
    is_placeholder: Number(row.is_placeholder || 0) === 1 ? 1 : 0,
    created_at: row.created_at || null,
  };
};

const readGalleryRows = async (env, category = "all") => {
  const normalizedCategory = String(category || "all").trim().toLowerCase();
  const hasCategoryFilter = normalizedCategory !== "all";

  const result = hasCategoryFilter
    ? await env.DB.prepare(
        `
          SELECT
            id,
            image_url,
            thumbnail_url,
            caption,
            category,
            alt_text,
            display_order,
            file_size_kb,
            original_name,
            is_placeholder,
            created_at
          FROM gallery
          WHERE category = ?
          ORDER BY display_order ASC, created_at ASC, id ASC
        `
      )
        .bind(normalizedCategory)
        .all()
    : await env.DB.prepare(
        `
          SELECT
            id,
            image_url,
            thumbnail_url,
            caption,
            category,
            alt_text,
            display_order,
            file_size_kb,
            original_name,
            is_placeholder,
            created_at
          FROM gallery
          ORDER BY display_order ASC, created_at ASC, id ASC
        `
      ).all();

  return (result.results || []).map((row) => normalizeGalleryRow(row, env));
};

const buildAltText = (caption, category) =>
  sanitizeText(
    caption || `${String(category || "automotive")} window tinting installation by MK Tintworks`,
    200
  );

const ensureCategory = (value, request) => {
  const category = sanitizeText(value || "automotive", 40).toLowerCase();
  if (!validateEnum(category, ALLOWED.category)) {
    return json(
      { error: `category must be one of: ${ALLOWED.category.join(", ")}` },
      { status: 400 },
      request
    );
  }

  return category;
};

const getNextDisplayOrder = async (env) => {
  const row = await env.DB.prepare(
    "SELECT COALESCE(MAX(display_order), -1) AS max_order FROM gallery"
  ).first();

  return Number(row?.max_order ?? -1) + 1;
};

const deleteManagedAsset = async (env, url) => {
  const normalized = String(url || "").trim();
  const mediaBase = resolveMediaPublicBaseUrl(env);

  if (!normalized || !normalized.startsWith(`${mediaBase}/`)) {
    return;
  }

  const key = normalized.slice(mediaBase.length + 1);
  if (!key) {
    return;
  }

  await env.MEDIA_BUCKET.delete(key);
};

const getGallery = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const images = await readGalleryRows(env);
    return json({ images }, { headers: FRESH_GALLERY_HEADERS }, request);
  } catch (error) {
    console.error("Failed to fetch gallery", error?.message);
    return serverError(request);
  }
};

const getPublicGallery = async (request, env) => {
  const url = new URL(request.url);
  const rawCategory = String(url.searchParams.get("category") || "all").trim().toLowerCase();

  if (rawCategory !== "all" && !validateEnum(rawCategory, ALLOWED.category)) {
    return json(
      { error: `category must be one of: all, ${ALLOWED.category.join(", ")}` },
      { status: 400 },
      request
    );
  }

  try {
    const images = await readGalleryRows(env, rawCategory);
    return json({ images }, { headers: FRESH_GALLERY_HEADERS }, request);
  } catch (error) {
    console.error("Failed to fetch public gallery", error?.message);
    return serverError(request);
  }
};

const uploadGalleryImage = async (request, env) => {
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

  if (file.size > MAX_GALLERY_UPLOAD_BYTES) {
    return json(
      {
        error:
          "Gallery uploads must be client-compressed before upload. Keep each file under 400KB after compression.",
      },
      { status: 400 },
      request
    );
  }

  const category = ensureCategory(formData.get("category"), request);
  if (typeof category !== "string") {
    return category;
  }

  const caption = sanitizeText(formData.get("caption") || "", 150);
  const extension = extensionFromType(file.type);
  const filename = generateSecureFilename("gallery", extension);
  const r2Key = buildR2Key("gallery", filename);
  const cdnUrl = `${resolveMediaPublicBaseUrl(env)}/${r2Key}`;
  const fileSizeKb = Math.max(1, Math.round(file.size / 1024));

  try {
    await env.MEDIA_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const displayOrder = await getNextDisplayOrder(env);

    const insertResult = await env.DB.prepare(
      `
        INSERT INTO gallery (
          image_url,
          thumbnail_url,
          caption,
          category,
          alt_text,
          display_order,
          file_size_kb,
          original_name,
          is_placeholder
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `
    )
      .bind(
        cdnUrl,
        cdnUrl,
        caption,
        category,
        buildAltText(caption, category),
        displayOrder,
        fileSizeKb,
        sanitizeText(file.name || filename, 255)
      )
      .run();

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
        JSON.stringify(["gallery"])
      )
      .run();

    await triggerDeploy(env);

    const inserted = await env.DB.prepare(
      `
        SELECT
          id,
          image_url,
          thumbnail_url,
          caption,
          category,
          alt_text,
          display_order,
          file_size_kb,
          original_name,
          is_placeholder,
          created_at
        FROM gallery
        WHERE id = ?
      `
    )
      .bind(Number(insertResult.meta?.last_row_id || 0))
      .first();

    return json(
      {
        success: true,
        image: normalizeGalleryRow(inserted || {}, env),
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to upload gallery image", error?.message);
    return serverError(request);
  }
};

const updateGalleryImage = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
      request
    );
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid image id is required." }, { status: 400 }, request);
  }

  const category = ensureCategory(body?.category, request);
  if (typeof category !== "string") {
    return category;
  }

  const caption = sanitizeText(body?.caption || "", 150);
  const isPlaceholder = body?.is_placeholder ? 1 : 0;

  try {
    const result = await env.DB.prepare(
      `
        UPDATE gallery
        SET
          caption = ?,
          category = ?,
          alt_text = ?,
          is_placeholder = ?
        WHERE id = ?
      `
    )
      .bind(caption, category, buildAltText(caption, category), isPlaceholder, id)
      .run();

    if (!Number(result.meta?.changes || 0)) {
      return json({ error: "Image not found." }, { status: 404 }, request);
    }

    await triggerDeploy(env);

    const updated = await env.DB.prepare(
      `
        SELECT
          id,
          image_url,
          thumbnail_url,
          caption,
          category,
          alt_text,
          display_order,
          file_size_kb,
          original_name,
          is_placeholder,
          created_at
        FROM gallery
        WHERE id = ?
      `
    )
      .bind(id)
      .first();

    return json(
      {
        success: true,
        image: normalizeGalleryRow(updated || {}, env),
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to update gallery image", id, error?.message);
    return serverError(request);
  }
};

const deleteGalleryImage = async (request, env, imageId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const id = Number(imageId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Valid image id is required." }, { status: 400 }, request);
  }

  try {
    const existing = await env.DB.prepare(
      `
        SELECT id, image_url, thumbnail_url
        FROM gallery
        WHERE id = ?
      `
    )
      .bind(id)
      .first();

    if (!existing) {
      return json({ error: "Image not found." }, { status: 404 }, request);
    }

    await env.DB.prepare("DELETE FROM gallery WHERE id = ?").bind(id).run();
    await env.DB.prepare(
      "DELETE FROM media WHERE cdn_url IN (?, ?)"
    )
      .bind(existing.image_url, existing.thumbnail_url || existing.image_url)
      .run();

    try {
      await deleteManagedAsset(env, existing.image_url);
      if (existing.thumbnail_url && existing.thumbnail_url !== existing.image_url) {
        await deleteManagedAsset(env, existing.thumbnail_url);
      }
    } catch (error) {
      console.error("Gallery asset cleanup failed", id, error?.message);
    }

    await triggerDeploy(env);

    return json({ success: true }, {}, request);
  } catch (error) {
    console.error("Failed to delete gallery image", id, error?.message);
    return serverError(request);
  }
};

const reorderGallery = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
      request
    );
  }

  const order = Array.isArray(body?.order) ? body.order : [];
  if (order.length === 0) {
    return json({ error: "order array required." }, { status: 400 }, request);
  }

  const normalizedOrder = order.map((item, index) => ({
    id: Number(item?.id),
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
  }));

  if (normalizedOrder.some((item) => !Number.isInteger(item.id) || item.id <= 0)) {
    return json(
      { error: "Every reorder item needs a valid id." },
      { status: 400 },
      request
    );
  }

  if (
    normalizedOrder.some(
      (item) => !Number.isInteger(item.order) || item.order < 0
    )
  ) {
    return json(
      { error: "Every reorder item needs a valid non-negative order value." },
      { status: 400 },
      request
    );
  }

  if (new Set(normalizedOrder.map((item) => item.id)).size !== normalizedOrder.length) {
    return json(
      { error: "Duplicate image ids are not allowed in reorder payloads." },
      { status: 400 },
      request
    );
  }

  try {
    const statement = env.DB.prepare(
      "UPDATE gallery SET display_order = ? WHERE id = ?"
    );
    const orderedUpdates = normalizedOrder
      .slice()
      .sort((left, right) => left.order - right.order || left.id - right.id)
      .map((item, index) => ({
        id: item.id,
        order: index,
      }));

    await env.DB.batch(
      orderedUpdates.map((item) => statement.bind(item.order, item.id))
    );

    await triggerDeploy(env);
    return json({ success: true }, {}, request);
  } catch (error) {
    console.error("Failed to reorder gallery", error?.message);
    return serverError(request);
  }
};

export const handleGalleryRequest = async (request, env) => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/gallery/public") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getPublicGallery(request, env);
  }

  if (pathname === "/api/gallery") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getGallery(request, env);
  }

  if (pathname === "/api/gallery/upload") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return uploadGalleryImage(request, env);
  }

  if (pathname === "/api/gallery/update") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return updateGalleryImage(request, env);
  }

  if (pathname === "/api/gallery/reorder") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return reorderGallery(request, env);
  }

  if (pathname.startsWith("/api/gallery/")) {
    if (request.method !== "DELETE") {
      return methodNotAllowed(request, ["DELETE"]);
    }

    return deleteGalleryImage(request, env, pathname.split("/").pop());
  }

  return json({ error: "Gallery route not found." }, { status: 404 }, request);
};
