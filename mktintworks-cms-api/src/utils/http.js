import { corsHeaders, handleCORS } from "../middleware/cors.js";

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://embed.tawk.to https://va.tawk.to https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.web3forms.com https://va.tawk.to https://mktintworks-cms-api.workers.dev; frame-src https://tawk.to; object-src 'none'; base-uri 'self'; form-action 'self' https://api.web3forms.com; upgrade-insecure-requests;",
};

export const withCommonHeaders = (
  response,
  request,
  { includeCors = true } = {}
) => {
  const headers = new Headers(response.headers);

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (includeCors) {
    Object.entries(corsHeaders(request)).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const json = (data, init = {}, request, options) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  const response = new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });

  return withCommonHeaders(response, request, options);
};

export const empty = (status = 204, request, options) =>
  withCommonHeaders(new Response(null, { status }), request, options);

export const methodNotAllowed = (request, allowedMethods) =>
  json(
    { error: `Method not allowed. Use ${allowedMethods.join(", ")}.` },
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
      },
    },
    request
  );

export const invalidJson = (request) =>
  json({ error: "Request body must be valid JSON." }, { status: 400 }, request);

export const notFound = (request) =>
  json({ error: "Endpoint not found." }, { status: 404 }, request);

export const serverError = (request) =>
  json(
    { error: "Internal server error." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
    request
  );

export const handlePreflight = (request) => {
  return withCommonHeaders(handleCORS(request), request, {
    includeCors: false,
  });
};
