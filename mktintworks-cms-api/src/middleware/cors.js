const EXACT_ALLOWED_ORIGINS = new Set([
  "https://admin.mktintworks.com",
  "https://mktintworks.com",
  "https://www.mktintworks.com",
  "https://mktintworks-cms.pages.dev",
  "https://admin.mktintworks-cms.pages.dev",
  "https://mk-tintworks-1.pages.dev",
  "http://localhost:3000",
  "http://localhost:8788",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8788",
]);

const PREVIEW_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.mktintworks-cms\.pages\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.mk-tintworks-1\.pages\.dev$/i,
];

const normalizeOrigin = (value) => {
  const origin = String(value || "").trim();
  if (!origin) {
    return "";
  }

  try {
    return new URL(origin).origin;
  } catch {
    return "";
  }
};

export const isAllowedOrigin = (value) => {
  const origin = normalizeOrigin(value);
  if (!origin) {
    return false;
  }

  if (EXACT_ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  return PREVIEW_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
};

export const corsHeaders = (request) => {
  if (!request) {
    return {};
  }

  const origin = normalizeOrigin(request.headers.get("Origin"));
  if (!origin || !isAllowedOrigin(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cache-Control",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const handleCORS = (request) => {
  const headers = corsHeaders(request);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new Response(null, {
      status: 403,
      headers: { Vary: "Origin" },
    });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
};
