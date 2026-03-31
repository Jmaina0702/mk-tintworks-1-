import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import {
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import { sanitizeText } from "../utils/validate.js";

const DEFAULT_MEDIA_PUBLIC_BASE_URL =
  "https://pub-0252224d03e4472da062ccdc92c2482f.r2.dev";

const resolveMediaPublicBaseUrl = (env) =>
  String(env.MEDIA_PUBLIC_BASE_URL || DEFAULT_MEDIA_PUBLIC_BASE_URL).replace(
    /\/$/,
    ""
  );

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
      {},
      request
    );
  } catch (error) {
    console.error("Image upload failed", error?.message);
    return serverError(request);
  }
};

export const handleMediaRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/media/upload-image") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return uploadImage(request, env);
  }

  return json({ error: "Media route not found." }, { status: 404 }, request);
};
