import {
  ALLOWED,
  sanitizeText,
  validateEnum,
  validateSlug,
} from "../utils/validate.js";
import { invalidJson, json, methodNotAllowed } from "../utils/http.js";
import { createProtectedPlaceholderHandler } from "./protected.js";

export const handleAnalyticsRequest = createProtectedPlaceholderHandler(
  "Analytics dashboard",
  ["GET"]
);

export const submitAnalyticsEvent = async (request, env) => {
  if (request.method !== "POST") {
    return methodNotAllowed(request, ["POST"]);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return invalidJson(request);
  }

  const rawEventType = sanitizeText(
    body?.event_type ?? body?.eventName ?? "pageview",
    64
  ).toLowerCase();
  const eventType = rawEventType === "page_view" ? "pageview" : rawEventType;

  if (!validateEnum(eventType, ALLOWED.event_type)) {
    return json({ error: "Invalid event_type." }, { status: 400 }, request);
  }

  const page = sanitizeText(body?.page ?? body?.page_slug ?? "", 120) || null;
  const referrer =
    sanitizeText(body?.referrer ?? request.headers.get("Referer") ?? "", 500) ||
    null;

  let productKey =
    sanitizeText(body?.product_key ?? body?.target_key ?? "", 100)
      .toLowerCase()
      .trim() || null;

  if (productKey && !validateSlug(productKey)) {
    productKey = null;
  }

  const country =
    sanitizeText(
      body?.country ?? request.headers.get("CF-IPCountry") ?? request.cf?.country ?? "",
      32
    )
      .toUpperCase()
      .trim() || null;

  await env.DB.prepare(
    `INSERT INTO analytics_events (event_type, page, referrer, product_key, country)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(eventType, page, referrer, productKey, country)
    .run();

  return json({ success: true }, { status: 201 }, request);
};
