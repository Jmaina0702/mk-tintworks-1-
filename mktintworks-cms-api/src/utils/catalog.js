import {
  buildProductCacheKey,
  CACHE_KEYS,
  CACHE_TTLS,
  readCacheJson,
  triggerDeployHook,
  writeCacheJson,
} from "./cache.js";

const DEFAULT_MEDIA_PUBLIC_BASE_URL =
  "https://pub-0252224d03e4472da062ccdc92c2482f.r2.dev";
const DEFAULT_PUBLIC_SITE_BASE_URL = "https://mk-tintworks-1.pages.dev";

const BRAND_GROUPS = ["3m", "llumar", "other"];

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value) => String(value || "").trim();

const normalizeBenefitsList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const raw = normalizeText(value);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to simple line parsing.
  }

  return raw
    .split(/\r?\n|•|;/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const normalizeDateValue = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveDiscountStatus = (row) => {
  const fallback = normalizeText(row?.status).toLowerCase() || "scheduled";
  const startDate = normalizeDateValue(row?.start_datetime);
  const endDate = normalizeDateValue(row?.end_datetime);

  if (!startDate || !endDate) {
    return fallback;
  }

  const now = Date.now();
  if (endDate.getTime() <= now) {
    return "expired";
  }

  if (startDate.getTime() <= now) {
    return "active";
  }

  return "scheduled";
};

const sortDiscountRows = (rows) =>
  rows.sort((left, right) => {
    const leftStatus = resolveDiscountStatus(left);
    const rightStatus = resolveDiscountStatus(right);
    const priority = { active: 0, scheduled: 1, expired: 2 };
    const leftPriority = priority[leftStatus] ?? 3;
    const rightPriority = priority[rightStatus] ?? 3;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftDate =
      leftStatus === "scheduled"
        ? normalizeDateValue(left.start_datetime)
        : normalizeDateValue(left.end_datetime) ||
          normalizeDateValue(left.start_datetime);
    const rightDate =
      rightStatus === "scheduled"
        ? normalizeDateValue(right.start_datetime)
        : normalizeDateValue(right.end_datetime) ||
          normalizeDateValue(right.start_datetime);

    const leftTime = leftDate ? leftDate.getTime() : 0;
    const rightTime = rightDate ? rightDate.getTime() : 0;

    if (leftStatus === "scheduled") {
      return leftTime - rightTime || asNumber(right.id) - asNumber(left.id);
    }

    return rightTime - leftTime || asNumber(right.id) - asNumber(left.id);
  });

export const resolveMediaPublicBaseUrl = (env) =>
  String(env.MEDIA_PUBLIC_BASE_URL || DEFAULT_MEDIA_PUBLIC_BASE_URL).replace(
    /\/$/,
    ""
  );

export const resolvePublicSiteBaseUrl = (env) =>
  String(env.PUBLIC_SITE_BASE_URL || DEFAULT_PUBLIC_SITE_BASE_URL).replace(
    /\/$/,
    ""
  );

export const normalizeProductImageUrl = (value, env) => {
  const raw = normalizeText(value);
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

export const parseBenefits = (value) => normalizeBenefitsList(value);

export const serializeBenefits = (items) =>
  JSON.stringify(normalizeBenefitsList(items));

export const normalizeDiscountRow = (row) => {
  if (!row) {
    return null;
  }

  const status = resolveDiscountStatus(row);
  const percentage = asNumber(row.percentage);
  const discountedPrice = asNumber(row.discounted_price);

  return {
    id: asNumber(row.id),
    product_id: asNumber(row.product_id),
    percentage,
    discounted_price: discountedPrice,
    start_datetime: row.start_datetime,
    end_datetime: row.end_datetime,
    label: normalizeText(row.label),
    status,
    status_label:
      status === "active"
        ? "Live"
        : status === "scheduled"
          ? "Coming Soon"
          : "Expired",
    countdown_target:
      status === "scheduled"
        ? row.start_datetime
        : status === "active"
          ? row.end_datetime
          : null,
    savings_amount: Math.max(0, asNumber(row.base_price) - discountedPrice),
  };
};

const pickRelevantDiscount = (rows) => {
  if (!rows || rows.length === 0) {
    return null;
  }

  return sortDiscountRows(rows)[0] || null;
};

const groupDiscountsByProduct = (rows) => {
  const grouped = new Map();

  for (const row of rows || []) {
    const productId = asNumber(row.product_id);
    if (!grouped.has(productId)) {
      grouped.set(productId, []);
    }

    grouped.get(productId).push(row);
  }

  return grouped;
};

export const mapProductRow = (row, env, discount = null) => {
  const basePrice = asNumber(row.base_price);
  const storedCurrentPrice = asNumber(row.current_price);
  const activeDiscount =
    discount && normalizeText(discount.status).toLowerCase() === "active"
      ? normalizeDiscountRow({ ...discount, base_price: basePrice })
      : discount
        ? normalizeDiscountRow({ ...discount, base_price: basePrice })
        : null;

  const currentPrice =
    activeDiscount?.status === "active"
      ? activeDiscount.discounted_price
      : storedCurrentPrice > 0
        ? storedCurrentPrice
        : basePrice;

  return {
    id: asNumber(row.id),
    brand: normalizeText(row.brand).toLowerCase(),
    product_key: normalizeText(row.product_key),
    name: normalizeText(row.name),
    tagline: normalizeText(row.tagline),
    short_description: normalizeText(row.short_description),
    extended_description: row.extended_description || "",
    benefits: parseBenefits(row.benefits),
    base_price: basePrice,
    current_price: currentPrice,
    tier: normalizeText(row.tier).toLowerCase() || "entry",
    warranty_text: normalizeText(row.warranty_text),
    image_url: normalizeProductImageUrl(row.image_url, env),
    raw_image_url: normalizeText(row.image_url),
    image_alt: normalizeText(row.image_alt) || normalizeText(row.name),
    display_order: asNumber(row.display_order),
    is_active: asNumber(row.is_active) === 1,
    updated_at: row.updated_at,
    discount: activeDiscount,
  };
};

export const fetchDiscountRows = async (
  env,
  { productId = null, includeExpired = false } = {}
) => {
  const clauses = [];
  const bindings = [];

  if (productId !== null && productId !== undefined) {
    clauses.push("product_id = ?");
    bindings.push(asNumber(productId));
  }

  if (!includeExpired) {
    clauses.push("status IN ('active', 'scheduled')");
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const statement = env.DB.prepare(
    `
      SELECT *
      FROM discounts
      ${whereClause}
      ORDER BY product_id ASC, start_datetime ASC, id DESC
    `
  );
  const result =
    bindings.length > 0 ? await statement.bind(...bindings).all() : await statement.all();

  return result.results || [];
};

export const fetchProductsWithDiscounts = async (
  env,
  { activeOnly = false, productId = null, includeExpiredDiscounts = false } = {}
) => {
  const clauses = [];
  const bindings = [];

  if (activeOnly) {
    clauses.push("is_active = 1");
  }

  if (productId !== null && productId !== undefined) {
    clauses.push("id = ?");
    bindings.push(asNumber(productId));
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const productQuery = `
    SELECT *
    FROM products
    ${whereClause}
    ORDER BY
      CASE brand
        WHEN '3m' THEN 0
        WHEN 'llumar' THEN 1
        ELSE 2
      END ASC,
      display_order ASC,
      id ASC
  `;
  const productStatement = env.DB.prepare(productQuery);
  const productResult =
    bindings.length > 0
      ? await productStatement.bind(...bindings).all()
      : await productStatement.all();
  const productRows = productResult.results || [];

  if (productRows.length === 0) {
    return [];
  }

  const discountRows = await fetchDiscountRows(env, {
    productId,
    includeExpired: includeExpiredDiscounts,
  });
  const discountsByProduct = groupDiscountsByProduct(discountRows);

  return productRows.map((row) => {
    const relevantDiscount = pickRelevantDiscount(
      discountsByProduct.get(asNumber(row.id)) || []
    );
    return mapProductRow(row, env, relevantDiscount);
  });
};

export const fetchProductDetails = async (env, productId) => {
  const products = await fetchProductsWithDiscounts(env, {
    productId,
    includeExpiredDiscounts: true,
  });
  const product = products[0] || null;

  if (!product) {
    return null;
  }

  const discountRows = await fetchDiscountRows(env, {
    productId,
    includeExpired: true,
  });

  return {
    product,
    discounts: sortDiscountRows(discountRows).map((row) =>
      normalizeDiscountRow({ ...row, base_price: product.base_price })
    ),
  };
};

export const groupProductsByBrand = (products) => {
  const grouped = {
    "3m": [],
    llumar: [],
    other: [],
  };

  for (const product of products || []) {
    const brand = BRAND_GROUPS.includes(product.brand) ? product.brand : "other";
    grouped[brand].push(product);
  }

  return grouped;
};

export const buildProductsSiteData = async (env) => {
  const products = await fetchProductsWithDiscounts(env, { activeOnly: true });
  return {
    generated_at: new Date().toISOString(),
    server_time: new Date().toISOString(),
    groups: groupProductsByBrand(products),
    products,
  };
};

export const readProductSiteCache = async (env) =>
  readCacheJson(env, CACHE_KEYS.productsSiteData);

export const primeProductCaches = async (env, siteData = null) => {
  const payload = siteData || (await buildProductsSiteData(env));

  await writeCacheJson(
    env,
    CACHE_KEYS.productsSiteData,
    payload,
    CACHE_TTLS.products
  );

  await Promise.all(
    (payload.products || []).map((product) =>
      writeCacheJson(
        env,
        buildProductCacheKey(product.product_key),
        product,
        CACHE_TTLS.products
      )
    )
  );

  return payload;
};

export const syncProductCurrentPrices = async (env) => {
  await env.DB.prepare(
    `
      UPDATE products
      SET current_price = base_price
    `
  ).run();

  await env.DB.prepare(
    `
      UPDATE products
      SET current_price = (
        SELECT discounted_price
        FROM discounts
        WHERE discounts.product_id = products.id
          AND discounts.status = 'active'
        ORDER BY start_datetime DESC, id DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1
        FROM discounts
        WHERE discounts.product_id = products.id
          AND discounts.status = 'active'
      )
    `
  ).run();
};

export const primeActiveDiscountsCache = async (env) => {
  const result = await env.DB.prepare(
    `
      SELECT
        d.*,
        p.base_price,
        p.product_key
      FROM discounts d
      INNER JOIN products p
        ON p.id = d.product_id
      WHERE d.status = 'active'
      ORDER BY d.start_datetime ASC, d.id ASC
    `
  ).all();

  const discounts = (result.results || []).map((row) => ({
    ...normalizeDiscountRow(row),
    product_key: normalizeText(row?.product_key),
  }));

  const payload = {
    generated_at: new Date().toISOString(),
    discounts,
  };

  await writeCacheJson(
    env,
    CACHE_KEYS.activeDiscounts,
    payload,
    CACHE_TTLS.activeDiscounts
  );

  return payload;
};

export const triggerDeploy = triggerDeployHook;
