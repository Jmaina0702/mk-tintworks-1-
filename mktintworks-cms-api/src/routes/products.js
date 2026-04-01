import { requireAuth } from "../middleware/auth.js";
import {
  buildProductsSiteData,
  fetchProductDetails,
  fetchProductsWithDiscounts,
  groupProductsByBrand,
  primeProductCaches,
  readProductSiteCache,
  resolveMediaPublicBaseUrl,
  syncProductCurrentPrices,
  triggerDeploy,
} from "../utils/catalog.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import {
  buildR2Key,
  generateSecureFilename,
  validateImageUpload,
} from "../utils/upload-security.js";
import {
  ALLOWED,
  sanitizeHTML,
  sanitizeText,
  validateEnum,
  validatePrice,
} from "../utils/validate.js";

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

const parseBenefitsInput = (value) => {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|•|;/)
        .map((item) => item.trim());

  return items
    .map((item) => sanitizeText(item, 220))
    .filter(Boolean);
};

const validateBenefits = (benefits) => {
  if (benefits.length < 3 || benefits.length > 10) {
    return "Benefits list must contain between 3 and 10 points.";
  }

  return null;
};

const isSafeProductImageReference = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("/assets/")) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".r2.dev") ||
        url.hostname === "mktintworks.com" ||
        url.hostname === "www.mktintworks.com" ||
        url.hostname.endsWith(".mktintworks.com") ||
        url.hostname.endsWith(".pages.dev"))
    );
  } catch {
    return false;
  }
};

const getProducts = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const products = await fetchProductsWithDiscounts(env, {
      includeExpiredDiscounts: true,
    });

    return json(
      {
        products,
        groups: groupProductsByBrand(products),
        totals: {
          total: products.length,
          active: products.filter((product) => product.is_active).length,
          discounted: products.filter(
            (product) =>
              product.discount &&
              ["scheduled", "active"].includes(product.discount.status)
          ).length,
        },
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to fetch products", error?.message);
    return serverError(request);
  }
};

const getProductById = async (request, env, productId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const detail = await fetchProductDetails(env, productId);
    if (!detail) {
      return json({ error: "Product not found." }, { status: 404 }, request);
    }

    return json(detail, {}, request);
  } catch (error) {
    console.error("Failed to fetch product detail", productId, error?.message);
    return serverError(request);
  }
};

const updateProduct = async (request, env) => {
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

  const productId = Number(body?.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return json({ error: "Valid product id is required." }, { status: 400 }, request);
  }

  const name = sanitizeText(body?.name, 180);
  const tagline = sanitizeText(body?.tagline, 180);
  const shortDescription = sanitizeText(body?.short_description, 1800);
  const extendedDescription = sanitizeHTML(body?.extended_description || "", 30000);
  const benefits = parseBenefitsInput(body?.benefits);
  const basePrice = Number(body?.base_price);
  const imageUrl = sanitizeText(body?.image_url || "", 500);
  const imageAlt = sanitizeText(body?.image_alt || "", 180);
  const tier = sanitizeText(body?.tier || "", 30).toLowerCase();
  const warrantyText = sanitizeText(body?.warranty_text || "", 240);
  const displayOrder = Number(body?.display_order);
  const isActive = body?.is_active ? 1 : 0;

  if (!name) {
    return json({ error: "Product name is required." }, { status: 400 }, request);
  }

  if (!shortDescription) {
    return json(
      { error: "Short description is required." },
      { status: 400 },
      request
    );
  }

  if (!validatePrice(basePrice)) {
    return json(
      { error: "Base price must be a valid positive amount." },
      { status: 400 },
      request
    );
  }

  if (!validateEnum(tier, ALLOWED.tier)) {
    return json(
      { error: `Tier must be one of: ${ALLOWED.tier.join(", ")}` },
      { status: 400 },
      request
    );
  }

  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100) {
    return json(
      { error: "Display order must be a whole number between 0 and 100." },
      { status: 400 },
      request
    );
  }

  const benefitsError = validateBenefits(benefits);
  if (benefitsError) {
    return json({ error: benefitsError }, { status: 400 }, request);
  }

  if (imageUrl && !isSafeProductImageReference(imageUrl)) {
    return json(
      {
        error:
          "Image URL must be an https:// URL from MK Tintworks, Pages, R2, or a /assets/ path.",
      },
      { status: 400 },
      request
    );
  }

  try {
    const result = await env.DB.prepare(
      `
        UPDATE products
        SET
          name = ?,
          tagline = ?,
          short_description = ?,
          extended_description = ?,
          benefits = ?,
          base_price = ?,
          tier = ?,
          warranty_text = ?,
          image_url = ?,
          image_alt = ?,
          display_order = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `
    )
      .bind(
        name,
        tagline,
        shortDescription,
        extendedDescription,
        JSON.stringify(benefits),
        basePrice,
        tier,
        warrantyText,
        imageUrl,
        imageAlt,
        displayOrder,
        isActive,
        productId
      )
      .run();

    if (!Number(result.meta?.changes || 0)) {
      return json({ error: "Product not found." }, { status: 404 }, request);
    }

    await syncProductCurrentPrices(env);
    await primeProductCaches(env);
    const detail = await fetchProductDetails(env, productId);
    await triggerDeploy(env);

    return json({ success: true, ...detail }, {}, request);
  } catch (error) {
    console.error("Failed to update product", productId, error?.message);
    return serverError(request);
  }
};

const uploadProductImage = async (request, env) => {
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

  const productId = Number(formData.get("product_id") || 0);
  const productKey = sanitizeText(formData.get("product_key") || "", 120);
  const extension = extensionFromType(file.type);
  const filename = generateSecureFilename("product", extension);
  const r2Key = buildR2Key("products", filename);
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
        JSON.stringify(
          [productKey || `product-${productId || "unknown"}`].filter(Boolean)
        )
      )
      .run();

    return json(
      {
        success: true,
        image_url: cdnUrl,
        r2_key: r2Key,
        filename,
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to upload product image", error?.message);
    return serverError(request);
  }
};

const getProductsSiteData = async (request, env) => {
  try {
    const cached = await readProductSiteCache(env);
    if (cached) {
      return json(
        {
          ...cached,
          source: "cache",
        },
        {},
        request
      );
    }

    const payload = await buildProductsSiteData(env);
    await primeProductCaches(env, payload);

    return json(
      {
        ...payload,
        source: "database",
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to fetch public product site data", error?.message);
    return serverError(request);
  }
};

export const handleProductsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/products/site-data") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }
    return getProductsSiteData(request, env);
  }

  if (pathname === "/api/products") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }
    return getProducts(request, env);
  }

  if (pathname === "/api/products/update") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }
    return updateProduct(request, env);
  }

  if (pathname === "/api/products/upload-image") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }
    return uploadProductImage(request, env);
  }

  const detailMatch = pathname.match(/^\/api\/products\/(\d+)$/);
  if (detailMatch) {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getProductById(request, env, Number(detailMatch[1]));
  }

  return json({ error: "Product route not found." }, { status: 404 }, request);
};
