import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed } from "../utils/http.js";
import { sanitizeText, validateSlug } from "../utils/validate.js";

const ANALYTICS_EVENT_TYPES = new Set([
  "pageview",
  "product_click",
  "cta_click",
  "blog_read",
]);

const ANALYTICS_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const clampDays = (value) => {
  const parsed = Number.parseInt(String(value || "30"), 10);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.min(365, Math.max(1, parsed));
};

const normalizeEventType = (value) => {
  const raw = sanitizeText(value || "pageview", 64).toLowerCase();
  return raw === "page_view" ? "pageview" : raw;
};

const normalizePagePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "/";
  }

  try {
    const url = new URL(raw);
    return `${url.pathname || "/"}${url.search || ""}`.substring(0, 200);
  } catch {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return path.substring(0, 200);
  }
};

const normalizeReferrer = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "direct";
  }

  if (raw === "direct" || raw === "unknown") {
    return raw;
  }

  try {
    return String(new URL(raw).hostname || "")
      .replace(/^www\./i, "")
      .toLowerCase()
      .substring(0, 200);
  } catch {
    return sanitizeText(raw, 200).toLowerCase() || "unknown";
  }
};

const normalizeProductKey = (value) => {
  const raw = sanitizeText(value || "", 100).toLowerCase();
  return raw && validateSlug(raw) ? raw : null;
};

const normalizeLabel = (value) => {
  const raw = sanitizeText(value || "", 64)
    .toLowerCase()
    .replace(/\s+/g, "_");
  return raw || null;
};

const normalizeCountry = (value) => {
  const raw = sanitizeText(value || "", 16).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : null;
};

const buildDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDailySeries = (rows, days) => {
  const counts = new Map(
    (rows?.results || []).map((row) => [
      String(row?.date || "").trim(),
      Number(row?.count || 0),
    ])
  );
  const series = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    const key = buildDateKey(current);
    series.push({
      date: key,
      count: counts.get(key) || 0,
    });
  }

  return series;
};

const sumCount = (rows) =>
  (rows?.results || []).reduce(
    (total, row) => total + Math.max(0, Number(row?.count || 0)),
    0
  );

export const submitAnalyticsEvent = async (request, env) => {
  if (request.method !== "POST") {
    return methodNotAllowed(request, ["POST"]);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: true }, { headers: ANALYTICS_HEADERS }, request);
  }

  const eventType = normalizeEventType(body?.event_type ?? body?.eventName);
  if (!ANALYTICS_EVENT_TYPES.has(eventType)) {
    return json({ ok: true }, { headers: ANALYTICS_HEADERS }, request);
  }

  const page = normalizePagePath(body?.page ?? body?.page_slug);
  const referrer = normalizeReferrer(
    body?.referrer ?? request.headers.get("Referer") ?? ""
  );
  const productKey = normalizeProductKey(
    body?.product_key ?? body?.target_key ?? ""
  );
  const label = normalizeLabel(body?.label ?? "");
  const country = normalizeCountry(
    request.headers.get("CF-IPCountry") ?? request.cf?.country ?? body?.country
  );

  try {
    await env.DB.prepare(
      `
        INSERT INTO analytics_events (
          event_type,
          page,
          referrer,
          product_key,
          label,
          country
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(eventType, page, referrer, productKey, label, country)
      .run();
  } catch (error) {
    console.error("Failed to record analytics event", eventType, error?.message);
  }

  return json({ ok: true }, { headers: ANALYTICS_HEADERS }, request);
};

const getAnalyticsSummary = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const currentModifier = `-${days - 1} days`;
  const previousStartModifier = `-${(days * 2) - 1} days`;
  const previousEndModifier = `-${days} days`;

  try {
    const [
      dailyRows,
      pagesRows,
      sourcesRows,
      productsRows,
      countriesRows,
      totals,
      previousTotals,
    ] = await Promise.all([
      env.DB.prepare(
        `
          SELECT
            substr(created_at, 1, 10) AS date,
            COUNT(*) AS count
          FROM analytics_events
          WHERE event_type = 'pageview'
            AND created_at >= datetime('now', ?)
          GROUP BY substr(created_at, 1, 10)
          ORDER BY date ASC
        `
      )
        .bind(currentModifier)
        .all(),
      env.DB.prepare(
        `
          SELECT page, COUNT(*) AS count
          FROM analytics_events
          WHERE event_type = 'pageview'
            AND created_at >= datetime('now', ?)
          GROUP BY page
          ORDER BY count DESC, page ASC
          LIMIT 10
        `
      )
        .bind(currentModifier)
        .all(),
      env.DB.prepare(
        `
          SELECT referrer, COUNT(*) AS count
          FROM analytics_events
          WHERE event_type = 'pageview'
            AND created_at >= datetime('now', ?)
          GROUP BY referrer
          ORDER BY count DESC, referrer ASC
          LIMIT 8
        `
      )
        .bind(currentModifier)
        .all(),
      env.DB.prepare(
        `
          SELECT product_key, COUNT(*) AS count
          FROM analytics_events
          WHERE event_type = 'product_click'
            AND created_at >= datetime('now', ?)
            AND product_key IS NOT NULL
          GROUP BY product_key
          ORDER BY count DESC, product_key ASC
        `
      )
        .bind(currentModifier)
        .all(),
      env.DB.prepare(
        `
          SELECT country, COUNT(*) AS count
          FROM analytics_events
          WHERE event_type = 'pageview'
            AND created_at >= datetime('now', ?)
            AND country IS NOT NULL
          GROUP BY country
          ORDER BY count DESC, country ASC
          LIMIT 5
        `
      )
        .bind(currentModifier)
        .all(),
      env.DB.prepare(
        `
          SELECT
            SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS total_pageviews,
            SUM(CASE WHEN event_type = 'product_click' THEN 1 ELSE 0 END) AS total_product_clicks,
            SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS total_cta_clicks,
            SUM(CASE WHEN event_type = 'blog_read' THEN 1 ELSE 0 END) AS total_blog_reads
          FROM analytics_events
          WHERE created_at >= datetime('now', ?)
        `
      )
        .bind(currentModifier)
        .first(),
      env.DB.prepare(
        `
          SELECT
            SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS total_pageviews,
            SUM(CASE WHEN event_type = 'product_click' THEN 1 ELSE 0 END) AS total_product_clicks,
            SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS total_cta_clicks,
            SUM(CASE WHEN event_type = 'blog_read' THEN 1 ELSE 0 END) AS total_blog_reads
          FROM analytics_events
          WHERE created_at >= datetime('now', ?)
            AND created_at < datetime('now', ?)
        `
      )
        .bind(previousStartModifier, previousEndModifier)
        .first(),
    ]);

    const safeTotals = {
      total_pageviews: Number(totals?.total_pageviews || 0),
      total_product_clicks: Number(totals?.total_product_clicks || 0),
      total_cta_clicks: Number(totals?.total_cta_clicks || 0),
      total_blog_reads: Number(totals?.total_blog_reads || 0),
    };
    const safePreviousTotals = {
      total_pageviews: Number(previousTotals?.total_pageviews || 0),
      total_product_clicks: Number(previousTotals?.total_product_clicks || 0),
      total_cta_clicks: Number(previousTotals?.total_cta_clicks || 0),
      total_blog_reads: Number(previousTotals?.total_blog_reads || 0),
    };

    return json(
      {
        period_days: days,
        generated_at: new Date().toISOString(),
        daily: buildDailySeries(dailyRows, days),
        top_pages: pagesRows.results || [],
        sources: sourcesRows.results || [],
        products: productsRows.results || [],
        countries: countriesRows.results || [],
        totals: safeTotals,
        previous_totals: safePreviousTotals,
        meta: {
          pageview_total_from_series: sumCount(dailyRows),
        },
      },
      { headers: ANALYTICS_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to build analytics summary", error?.message);
    return json(
      { error: "Failed to load analytics summary." },
      { status: 500, headers: ANALYTICS_HEADERS },
      request
    );
  }
};

export const handleAnalyticsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/analytics/summary") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getAnalyticsSummary(request, env);
  }

  return json(
    { error: "Analytics route not found." },
    { status: 404, headers: ANALYTICS_HEADERS },
    request
  );
};
