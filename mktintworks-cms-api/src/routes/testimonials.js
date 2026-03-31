import { requireAuth } from "../middleware/auth.js";
import { triggerDeploy } from "../utils/catalog.js";
import {
  invalidJson,
  json,
  methodNotAllowed,
  serverError,
} from "../utils/http.js";
import {
  ALLOWED,
  isBot,
  sanitizeText,
  validateEnum,
  validateRating,
} from "../utils/validate.js";

const FRESH_TESTIMONIAL_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const TESTIMONIAL_RATE_LIMIT_SECONDS = 120;
const TESTIMONIAL_RATE_LIMIT_PREFIX = "testimonial-submit";
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_REVIEW_LENGTH = 1000;
const APPROVE_PATH = "https://admin.mktintworks.com/pages/testimonials.html";

const normalizeTestimonial = (row) => ({
  id: Number(row?.id || 0),
  client_name: sanitizeText(row?.client_name || "", MAX_CLIENT_NAME_LENGTH),
  service_type: sanitizeText(row?.service_type || "", 32).toLowerCase(),
  rating: Number(row?.rating || 0),
  review_text: sanitizeText(row?.review_text || "", MAX_REVIEW_LENGTH),
  status: sanitizeText(row?.status || "pending", 20).toLowerCase(),
  display_order: Number(row?.display_order || 0),
  submitted_at: row?.submitted_at || null,
  approved_at: row?.approved_at || null,
});

const getClientIp = (request) => {
  const forwarded = request.headers.get("CF-Connecting-IP");
  if (forwarded) {
    return sanitizeText(forwarded, 64);
  }

  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (!xForwardedFor) {
    return "";
  }

  return sanitizeText(xForwardedFor.split(",")[0] || "", 64);
};

const buildRateLimitKey = (request) => {
  const ip = getClientIp(request);
  return ip ? `${TESTIMONIAL_RATE_LIMIT_PREFIX}:${ip}` : "";
};

const isSubmissionThrottled = async (request, env) => {
  if (!env.SESSIONS) {
    return false;
  }

  const key = buildRateLimitKey(request);
  if (!key) {
    return false;
  }

  const existing = await env.SESSIONS.get(key);
  return Boolean(existing);
};

const recordSubmissionThrottle = async (request, env) => {
  if (!env.SESSIONS) {
    return;
  }

  const key = buildRateLimitKey(request);
  if (!key) {
    return;
  }

  await env.SESSIONS.put(key, String(Date.now()), {
    expirationTtl: TESTIMONIAL_RATE_LIMIT_SECONDS,
  });
};

const notifyBusinessOwner = async (env, testimonial) => {
  if (!env.WEB3FORMS_KEY) {
    return;
  }

  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_key: env.WEB3FORMS_KEY,
      subject: "New Review Pending Approval - MK Tintworks",
      from_name: testimonial.client_name,
      message: [
        `New ${testimonial.rating}-star review from ${testimonial.client_name}`,
        `Service: ${testimonial.service_type}`,
        `Review: "${testimonial.review_text}"`,
        "",
        `Approve or reject at: ${APPROVE_PATH}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Web3Forms ${response.status}: ${body}`.trim());
  }
};

const parseIdFromBody = async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: invalidJson(request) };
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      error: json({ error: "Valid testimonial id is required." }, { status: 400 }, request),
    };
  }

  return { id };
};

const getTestimonials = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const result = await env.DB.prepare(
      `
        SELECT
          id,
          client_name,
          service_type,
          rating,
          review_text,
          status,
          display_order,
          submitted_at,
          approved_at
        FROM testimonials
        ORDER BY
          CASE status
            WHEN 'pending' THEN 0
            WHEN 'approved' THEN 1
            ELSE 2
          END ASC,
          CASE
            WHEN status = 'approved' THEN display_order
            ELSE 0
          END ASC,
          submitted_at DESC,
          id DESC
      `
    ).all();

    return json(
      {
        testimonials: (result.results || []).map(normalizeTestimonial),
      },
      { headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch testimonials", error?.message);
    return serverError(request);
  }
};

const getPendingCount = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM testimonials WHERE status = 'pending'"
    ).first();

    return json(
      {
        count: Number(row?.count || 0),
      },
      { headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch testimonial pending count", error?.message);
    return serverError(request);
  }
};

const approveTestimonial = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const parsed = await parseIdFromBody(request);
  if (parsed.error) {
    return parsed.error;
  }

  try {
    const existing = await env.DB.prepare(
      `
        SELECT id, status, display_order
        FROM testimonials
        WHERE id = ?
      `
    )
      .bind(parsed.id)
      .first();

    if (!existing) {
      return json({ error: "Testimonial not found." }, { status: 404 }, request);
    }

    let displayOrder = Number(existing.display_order || 0);
    if (String(existing.status || "").toLowerCase() !== "approved" || displayOrder <= 0) {
      const maxOrder = await env.DB.prepare(
        `
          SELECT COALESCE(MAX(display_order), 0) AS max_order
          FROM testimonials
          WHERE status = 'approved'
        `
      ).first();
      displayOrder = Number(maxOrder?.max_order || 0) + 1;
    }

    await env.DB.prepare(
      `
        UPDATE testimonials
        SET
          status = 'approved',
          approved_at = datetime('now'),
          display_order = ?
        WHERE id = ?
      `
    )
      .bind(displayOrder, parsed.id)
      .run();

    await triggerDeploy(env);

    return json(
      { success: true, id: parsed.id, status: "approved", display_order: displayOrder },
      { headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to approve testimonial", parsed.id, error?.message);
    return serverError(request);
  }
};

const rejectTestimonial = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const parsed = await parseIdFromBody(request);
  if (parsed.error) {
    return parsed.error;
  }

  try {
    const existing = await env.DB.prepare(
      `
        SELECT id, status
        FROM testimonials
        WHERE id = ?
      `
    )
      .bind(parsed.id)
      .first();

    if (!existing) {
      return json({ error: "Testimonial not found." }, { status: 404 }, request);
    }

    const wasApproved = String(existing.status || "").toLowerCase() === "approved";

    await env.DB.prepare(
      `
        UPDATE testimonials
        SET
          status = 'rejected',
          display_order = 0,
          approved_at = NULL
        WHERE id = ?
      `
    )
      .bind(parsed.id)
      .run();

    if (wasApproved) {
      await triggerDeploy(env);
    }

    return json(
      { success: true, id: parsed.id, status: "rejected" },
      { headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to reject testimonial", parsed.id, error?.message);
    return serverError(request);
  }
};

const getPublicTestimonials = async (request, env) => {
  try {
    const result = await env.DB.prepare(
      `
        SELECT
          id,
          client_name,
          service_type,
          rating,
          review_text,
          status,
          display_order,
          submitted_at,
          approved_at
        FROM testimonials
        WHERE status = 'approved'
        ORDER BY display_order ASC, approved_at DESC, id DESC
      `
    ).all();

    return json(
      {
        testimonials: (result.results || []).map(normalizeTestimonial),
      },
      { headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to fetch public testimonials", error?.message);
    return serverError(request);
  }
};

export const submitTestimonial = async (request, env, ctx) => {
  if (request.method !== "POST") {
    return methodNotAllowed(request, ["POST"]);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return invalidJson(request);
  }

  if (isBot(body)) {
    return json({ success: true }, { status: 200 }, request);
  }

  const clientName = sanitizeText(body?.client_name, MAX_CLIENT_NAME_LENGTH);
  const serviceType = sanitizeText(body?.service_type, 32).toLowerCase();
  const rating = parseInt(body?.rating, 10);
  const reviewText = sanitizeText(body?.review_text, MAX_REVIEW_LENGTH);

  const errors = [];

  if (clientName.length < 2) {
    errors.push("Name is required.");
  }

  if (!validateEnum(serviceType, ALLOWED.service_type)) {
    errors.push("Valid service type is required.");
  }

  if (!validateRating(rating)) {
    errors.push("Rating must be between 1 and 5.");
  }

  if (reviewText.length < 20) {
    errors.push("Review must be at least 20 characters.");
  }

  if (String(body?.review_text || "").trim().length > MAX_REVIEW_LENGTH) {
    errors.push(`Review must be under ${MAX_REVIEW_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    return json({ error: errors.join(" ") }, { status: 400 }, request);
  }

  try {
    if (await isSubmissionThrottled(request, env)) {
      return json(
        {
          error: "Too many review submissions. Please wait a short while and try again.",
        },
        { status: 429, headers: FRESH_TESTIMONIAL_HEADERS },
        request
      );
    }

    await env.DB.prepare(
      `
        INSERT INTO testimonials (
          client_name,
          service_type,
          rating,
          review_text,
          status
        )
        VALUES (?, ?, ?, ?, 'pending')
      `
    )
      .bind(clientName, serviceType, rating, reviewText)
      .run();

    await recordSubmissionThrottle(request, env);

    const testimonial = {
      client_name: clientName,
      service_type: serviceType,
      rating,
      review_text: reviewText,
    };

    ctx?.waitUntil(
      notifyBusinessOwner(env, testimonial).catch((error) => {
        console.error("Testimonial notification failed", error?.message);
      })
    );

    return json(
      {
        success: true,
        status: "pending",
        message: "Thank you for your review. It will appear after moderation.",
      },
      { status: 201, headers: FRESH_TESTIMONIAL_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to submit testimonial", error?.message);
    return serverError(request);
  }
};

export const handleTestimonialsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/testimonials") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getTestimonials(request, env);
  }

  if (pathname === "/api/testimonials/pending-count") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getPendingCount(request, env);
  }

  if (pathname === "/api/testimonials/approve") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return approveTestimonial(request, env);
  }

  if (pathname === "/api/testimonials/reject") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return rejectTestimonial(request, env);
  }

  if (pathname === "/api/testimonials/public") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getPublicTestimonials(request, env);
  }

  return json({ error: "Testimonials route not found." }, { status: 404 }, request);
};
