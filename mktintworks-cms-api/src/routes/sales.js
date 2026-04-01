import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed } from "../utils/http.js";
import { sanitizeText } from "../utils/validate.js";

const SALES_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const ALLOWED_PERIODS = new Set(["30", "90", "365", "all"]);

const normalizePeriod = (value) => {
  const raw = String(value || "365").trim().toLowerCase();
  return ALLOWED_PERIODS.has(raw) ? raw : "365";
};

const formatDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getSinceDate = (period) => {
  if (period === "all") {
    return null;
  }

  const days = Number.parseInt(period, 10) || 365;
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return formatDateKey(date);
};

const buildPeriodWhereClause = (period, alias = "i") => {
  const since = getSinceDate(period);
  if (!since) {
    return {
      clause: "",
      bindings: [],
      since: null,
    };
  }

  return {
    clause: `WHERE ${alias}.service_date >= ?`,
    bindings: [since],
    since,
  };
};

const buildRecentMonthKeys = (count = 6) => {
  const months = [];
  const currentMonthStart = new Date();
  currentMonthStart.setUTCHours(0, 0, 0, 0);
  currentMonthStart.setUTCDate(1);

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(
      Date.UTC(
        currentMonthStart.getUTCFullYear(),
        currentMonthStart.getUTCMonth() - index,
        1
      )
    );
    months.push(formatMonthKey(date));
  }

  return months;
};

const toMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toCount = (value) => Math.max(0, Number.parseInt(String(value || 0), 10) || 0);

const mapTotals = (row) => ({
  collected: toMoney(row?.collected),
  outstanding: toMoney(row?.outstanding),
  total_jobs: toCount(row?.total_jobs),
  paid_jobs: toCount(row?.paid_jobs),
  unpaid_jobs: toCount(row?.unpaid_jobs),
});

const mapMonthlyRows = (rows) => {
  const months = buildRecentMonthKeys(6);
  const byMonth = new Map(
    (rows?.results || []).map((row) => [
      String(row?.month || "").trim(),
      {
        collected: toMoney(row?.collected),
        outstanding: toMoney(row?.outstanding),
      },
    ])
  );

  return months.map((month) => ({
    month,
    collected: byMonth.get(month)?.collected || 0,
    outstanding: byMonth.get(month)?.outstanding || 0,
  }));
};

const mapProductRows = (rows) =>
  (rows?.results || []).map((row) => ({
    film_used: sanitizeText(row?.film_used || "Not specified", 200),
    job_count: toCount(row?.job_count),
    revenue: toMoney(row?.revenue),
  }));

const mapPaymentRows = (rows) =>
  (rows?.results || []).map((row) => ({
    payment_method: sanitizeText(row?.payment_method || "unknown", 40).toLowerCase(),
    count: toCount(row?.count),
  }));

const mapServiceRows = (rows) =>
  (rows?.results || []).map((row) => ({
    service_type: sanitizeText(row?.service_type || "unknown", 40).toLowerCase(),
    count: toCount(row?.count),
  }));

const mapOutstandingRows = (rows) =>
  (rows?.results || []).map((row) => ({
    invoice_number: sanitizeText(row?.invoice_number || "", 40),
    client_name: sanitizeText(row?.client_name || "", 120),
    total_amount: toMoney(row?.total_amount),
    payment_status: sanitizeText(row?.payment_status || "", 20).toLowerCase(),
    service_date: sanitizeText(row?.service_date || "", 20),
  }));

const mapTopClients = (rows) =>
  (rows?.results || []).map((row) => ({
    full_name: sanitizeText(row?.full_name || "Unknown client", 120),
    phone: sanitizeText(row?.phone || "", 40),
    job_count: toCount(row?.job_count),
    total_spent: toMoney(row?.total_spent),
  }));

const getSalesSummary = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const period = normalizePeriod(url.searchParams.get("period"));
  const currentPeriod = buildPeriodWhereClause(period, "i");
  const topClientPeriod = buildPeriodWhereClause(period, "i");
  const recentMonths = buildRecentMonthKeys(6);
  const recentMonthsSince = `${recentMonths[0]}-01`;

  try {
    const [totals, monthlyRows, productRows, paymentRows, serviceRows, unpaidRows, clientRows] =
      await Promise.all([
        env.DB.prepare(
          `
            SELECT
              COALESCE(SUM(CASE WHEN i.payment_status = 'paid' THEN i.total_amount ELSE 0 END), 0) AS collected,
              COALESCE(SUM(CASE WHEN i.payment_status IN ('unpaid', 'partial') THEN i.total_amount ELSE 0 END), 0) AS outstanding,
              COUNT(*) AS total_jobs,
              SUM(CASE WHEN i.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_jobs,
              SUM(CASE WHEN i.payment_status IN ('unpaid', 'partial') THEN 1 ELSE 0 END) AS unpaid_jobs
            FROM invoices i
            ${currentPeriod.clause}
          `
        )
          .bind(...currentPeriod.bindings)
          .first(),
        env.DB.prepare(
          `
            SELECT
              substr(service_date, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS collected,
              COALESCE(SUM(CASE WHEN payment_status IN ('unpaid', 'partial') THEN total_amount ELSE 0 END), 0) AS outstanding
            FROM invoices
            WHERE service_date >= ?
            GROUP BY substr(service_date, 1, 7)
            ORDER BY month ASC
          `
        )
          .bind(recentMonthsSince)
          .all(),
        env.DB.prepare(
          `
            SELECT
              COALESCE(NULLIF(trim(i.film_used), ''), 'Not specified') AS film_used,
              COUNT(*) AS job_count,
              COALESCE(SUM(i.total_amount), 0) AS revenue
            FROM invoices i
            ${currentPeriod.clause}
            GROUP BY COALESCE(NULLIF(trim(i.film_used), ''), 'Not specified')
            ORDER BY revenue DESC, job_count DESC, film_used ASC
          `
        )
          .bind(...currentPeriod.bindings)
          .all(),
        env.DB.prepare(
          `
            SELECT
              COALESCE(NULLIF(lower(trim(i.payment_method)), ''), 'unknown') AS payment_method,
              COUNT(*) AS count
            FROM invoices i
            ${currentPeriod.clause}
            GROUP BY COALESCE(NULLIF(lower(trim(i.payment_method)), ''), 'unknown')
            ORDER BY count DESC, payment_method ASC
          `
        )
          .bind(...currentPeriod.bindings)
          .all(),
        env.DB.prepare(
          `
            SELECT
              COALESCE(NULLIF(lower(trim(i.service_type)), ''), 'unknown') AS service_type,
              COUNT(*) AS count
            FROM invoices i
            ${currentPeriod.clause}
            GROUP BY COALESCE(NULLIF(lower(trim(i.service_type)), ''), 'unknown')
            ORDER BY count DESC, service_type ASC
          `
        )
          .bind(...currentPeriod.bindings)
          .all(),
        env.DB.prepare(
          `
            SELECT
              i.invoice_number,
              i.total_amount,
              i.payment_status,
              i.service_date,
              c.full_name AS client_name
            FROM invoices i
            LEFT JOIN clients c
              ON c.id = i.client_id
            WHERE i.payment_status IN ('unpaid', 'partial')
            ORDER BY i.service_date ASC, i.id ASC
          `
        ).all(),
        env.DB.prepare(
          `
            SELECT
              COALESCE(NULLIF(trim(c.full_name), ''), 'Unknown client') AS full_name,
              COALESCE(NULLIF(trim(c.phone), ''), '') AS phone,
              COUNT(i.id) AS job_count,
              COALESCE(SUM(i.total_amount), 0) AS total_spent
            FROM invoices i
            LEFT JOIN clients c
              ON c.id = i.client_id
            ${topClientPeriod.clause}
            GROUP BY
              COALESCE(i.client_id, 0),
              COALESCE(NULLIF(trim(c.full_name), ''), 'Unknown client'),
              COALESCE(NULLIF(trim(c.phone), ''), '')
            HAVING COUNT(i.id) > 0
            ORDER BY total_spent DESC, job_count DESC, full_name ASC
            LIMIT 10
          `
        )
          .bind(...topClientPeriod.bindings)
          .all(),
      ]);

    return json(
      {
        period,
        generated_at: new Date().toISOString(),
        totals: mapTotals(totals),
        monthly_revenue: mapMonthlyRows(monthlyRows),
        product_performance: mapProductRows(productRows),
        payment_split: mapPaymentRows(paymentRows),
        service_split: mapServiceRows(serviceRows),
        unpaid_invoices: mapOutstandingRows(unpaidRows),
        top_clients: mapTopClients(clientRows),
        meta: {
          since: currentPeriod.since,
          monthly_trend_since: recentMonthsSince,
        },
      },
      { headers: SALES_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to build sales summary", error?.message);
    return json(
      { error: "Failed to load sales summary." },
      { status: 500, headers: SALES_HEADERS },
      request
    );
  }
};

export const handleSalesRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/sales/summary") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getSalesSummary(request, env);
  }

  return json(
    { error: "Sales route not found." },
    { status: 404, headers: SALES_HEADERS },
    request
  );
};
