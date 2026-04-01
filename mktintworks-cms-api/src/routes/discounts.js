import { requireAuth } from "../middleware/auth.js";
import {
  fetchProductDetails,
  primeActiveDiscountsCache,
  primeProductCaches,
  syncProductCurrentPrices,
  triggerDeploy,
} from "../utils/catalog.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import {
  sanitizeText,
  validateDateRange,
  validateDiscount,
} from "../utils/validate.js";

const isoNow = () => new Date().toISOString();

const getDiscountStatus = (startDate, endDate) => {
  const now = Date.now();
  if (endDate.getTime() <= now) {
    return "expired";
  }
  if (startDate.getTime() <= now) {
    return "active";
  }
  return "scheduled";
};

const createDiscount = async (request, env) => {
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

  const productId = Number(body?.product_id);
  const percentage = Number(body?.percentage);
  const startDateTime = String(body?.start_datetime || "").trim();
  const endDateTime = String(body?.end_datetime || "").trim();
  const label = sanitizeText(body?.label || "", 80);

  if (!Number.isInteger(productId) || productId <= 0) {
    return json({ error: "Valid product_id is required." }, { status: 400 }, request);
  }

  if (!validateDiscount(percentage)) {
    return json(
      { error: "Discount percentage must be between 0 and 100." },
      { status: 400 },
      request
    );
  }

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

  if (endDate.getTime() <= Date.now()) {
    return json(
      { error: "Discount end time must be in the future." },
      { status: 400 },
      request
    );
  }

  try {
    const detail = await fetchProductDetails(env, productId);
    if (!detail?.product) {
      return json({ error: "Product not found." }, { status: 404 }, request);
    }

    const discountedPrice = Math.round(
      detail.product.base_price * (1 - percentage / 100)
    );
    const status = getDiscountStatus(startDate, endDate);

    await env.DB.prepare(
      `
        DELETE FROM discounts
        WHERE product_id = ?
          AND status IN ('scheduled', 'active')
      `
    )
      .bind(productId)
      .run();

    const insertResult = await env.DB.prepare(
      `
        INSERT INTO discounts (
          product_id,
          percentage,
          discounted_price,
          start_datetime,
          end_datetime,
          label,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `
    )
      .bind(
        productId,
        percentage,
        discountedPrice,
        startDate.toISOString(),
        endDate.toISOString(),
        label,
        status
      )
      .run();

    await syncProductCurrentPrices(env);
    await Promise.all([primeProductCaches(env), primeActiveDiscountsCache(env)]);
    const nextDetail = await fetchProductDetails(env, productId);
    await triggerDeploy(env);

    return json(
      {
        success: true,
        discount_id: insertResult.meta?.last_row_id || null,
        product: nextDetail?.product || detail.product,
        discounts: nextDetail?.discounts || [],
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to create discount", productId, error?.message);
    return serverError(request);
  }
};

const removeDiscount = async (request, env) => {
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

  const discountId = Number(body?.discount_id || 0);
  const productId = Number(body?.product_id || 0);

  if (!discountId && !productId) {
    return json(
      { error: "discount_id or product_id is required." },
      { status: 400 },
      request
    );
  }

  try {
    let resolvedProductId = productId;

    if (discountId) {
      const row = await env.DB.prepare(
        `
          SELECT product_id
          FROM discounts
          WHERE id = ?
          LIMIT 1
        `
      )
        .bind(discountId)
        .first();

      if (!row) {
        return json({ error: "Discount not found." }, { status: 404 }, request);
      }

      resolvedProductId = Number(row.product_id);

      await env.DB.prepare(`DELETE FROM discounts WHERE id = ?`)
        .bind(discountId)
        .run();
    } else {
      await env.DB.prepare(
        `
          DELETE FROM discounts
          WHERE product_id = ?
            AND status IN ('scheduled', 'active')
        `
      )
        .bind(productId)
        .run();
    }

    await syncProductCurrentPrices(env);
    await Promise.all([primeProductCaches(env), primeActiveDiscountsCache(env)]);
    const detail = await fetchProductDetails(env, resolvedProductId);
    await triggerDeploy(env);

    return json(
      {
        success: true,
        product: detail?.product || null,
        discounts: detail?.discounts || [],
      },
      {},
      request
    );
  } catch (error) {
    console.error("Failed to remove discount", discountId || productId, error?.message);
    return serverError(request);
  }
};

export const checkDiscountTimers = async (env) => {
  const now = isoNow();
  let shouldDeploy = false;

  try {
    const activateResult = await env.DB.prepare(
      `
        UPDATE discounts
        SET status = 'active'
        WHERE status = 'scheduled'
          AND start_datetime <= ?
          AND end_datetime > ?
      `
    )
      .bind(now, now)
      .run();

    const expireScheduledResult = await env.DB.prepare(
      `
        UPDATE discounts
        SET status = 'expired'
        WHERE status = 'scheduled'
          AND end_datetime <= ?
      `
    )
      .bind(now)
      .run();

    const expireActiveResult = await env.DB.prepare(
      `
        UPDATE discounts
        SET status = 'expired'
        WHERE status = 'active'
          AND end_datetime <= ?
      `
    )
      .bind(now)
      .run();

    const changedRows =
      Number(activateResult.meta?.changes || 0) +
      Number(expireScheduledResult.meta?.changes || 0) +
      Number(expireActiveResult.meta?.changes || 0);

    if (changedRows > 0) {
      shouldDeploy = true;
      await syncProductCurrentPrices(env);
      await Promise.all([primeProductCaches(env), primeActiveDiscountsCache(env)]);
      await triggerDeploy(env);
    } else {
      await syncProductCurrentPrices(env);
      await Promise.all([primeProductCaches(env), primeActiveDiscountsCache(env)]);
    }

    return {
      success: true,
      changed_rows: changedRows,
      deployed: shouldDeploy,
    };
  } catch (error) {
    console.error("Discount timer check failed", error?.message);
    return {
      success: false,
      changed_rows: 0,
      deployed: false,
      error: error?.message || "Unknown error",
    };
  }
};

export const handleDiscountsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/discounts/create") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return createDiscount(request, env);
  }

  if (pathname === "/api/discounts/remove") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return removeDiscount(request, env);
  }

  return json({ error: "Discount route not found." }, { status: 404 }, request);
};
