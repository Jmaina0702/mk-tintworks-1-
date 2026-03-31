import {
  ALLOWED,
  isBot,
  sanitizeText,
  validateEnum,
  validateRating,
  validateRequired,
} from "../utils/validate.js";
import { invalidJson, json, methodNotAllowed } from "../utils/http.js";
import { createProtectedPlaceholderHandler } from "./protected.js";

export const handleTestimonialsRequest = createProtectedPlaceholderHandler(
  "Testimonials moderation"
);

export const submitTestimonial = async (request, env) => {
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

  const requiredError = validateRequired(
    ["client_name", "rating", "review_text"],
    body
  );
  if (requiredError) {
    return json({ error: requiredError }, { status: 400 }, request);
  }

  const clientName = sanitizeText(body.client_name, 120);
  const reviewText = sanitizeText(body.review_text, 3000);
  const rating = parseInt(body.rating, 10);
  const serviceType = body.service_type
    ? sanitizeText(body.service_type, 32).toLowerCase()
    : null;

  if (!validateRating(rating)) {
    return json(
      { error: "Rating must be an integer between 1 and 5." },
      { status: 400 },
      request
    );
  }

  if (serviceType && !validateEnum(serviceType, ALLOWED.service_type)) {
    return json({ error: "Invalid service_type." }, { status: 400 }, request);
  }

  await env.DB.prepare(
    `INSERT INTO testimonials (client_name, service_type, rating, review_text, status)
     VALUES (?, ?, ?, ?, 'pending')`
  )
    .bind(clientName, serviceType, rating, reviewText)
    .run();

  return json(
    {
      success: true,
      status: "pending",
      message: "Thank you. Your review has been received for approval.",
    },
    { status: 201 },
    request
  );
};
