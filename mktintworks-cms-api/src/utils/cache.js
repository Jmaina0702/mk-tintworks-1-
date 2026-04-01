export const CACHE_TTLS = {
  pages: 60 * 60,
  products: 60 * 60,
  blogPublished: 60 * 60,
  seo: 60 * 60,
  activePromotions: 60,
  activeDiscounts: 2 * 60,
};

export const CACHE_KEYS = {
  activeDiscounts: "active_discounts",
  activePromotions: "active_promotions",
  blogPublished: "blog:published",
  productsSiteData: "products:site-data",
};

const normalizeKeyPart = (value) =>
  String(value || "")
    .trim()
    .replace(/[\s"'`/\\]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildPageCacheKey = (slug) => `page:${normalizeKeyPart(slug)}`;

export const buildProductCacheKey = (productKey) =>
  `product:${normalizeKeyPart(productKey)}`;

export const buildSeoCacheKey = (slug) => `seo:${normalizeKeyPart(slug)}`;

export const readCacheJson = async (env, key) => {
  if (!env.CONTENT_CACHE || typeof env.CONTENT_CACHE.get !== "function" || !key) {
    return null;
  }

  try {
    return await env.CONTENT_CACHE.get(key, "json");
  } catch {
    return null;
  }
};

export const writeCacheJson = async (env, key, value, ttlSeconds = null) => {
  if (!env.CONTENT_CACHE || typeof env.CONTENT_CACHE.put !== "function" || !key) {
    return false;
  }

  const options =
    Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
      ? { expirationTtl: Number(ttlSeconds) }
      : undefined;

  try {
    await env.CONTENT_CACHE.put(key, JSON.stringify(value), options);
    return true;
  } catch {
    return false;
  }
};

export const deleteCacheKey = async (env, key) => {
  if (
    !env.CONTENT_CACHE ||
    typeof env.CONTENT_CACHE.delete !== "function" ||
    !key
  ) {
    return false;
  }

  try {
    await env.CONTENT_CACHE.delete(key);
    return true;
  } catch {
    return false;
  }
};

export const deleteCacheKeys = async (env, keys) => {
  await Promise.all((Array.isArray(keys) ? keys : []).map((key) => deleteCacheKey(env, key)));
};

export const triggerDeployHook = async (env) => {
  if (!env.DEPLOY_HOOK_URL) {
    return false;
  }

  try {
    await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    return true;
  } catch {
    return false;
  }
};
