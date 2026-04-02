const WORKER_API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
const DEFAULT_ADMIN_EMAIL = "mktintworks.co@gmail.com";

const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
};

const base64UrlEncode = (value) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

const bytesToBinary = (bytes) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
};

const generateJWT = async (email, secret) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "admin",
      email,
      iat: now,
      exp: now + 8 * 60 * 60,
    })
  );

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${header}.${payload}`)
  );
  const signature = base64UrlEncode(
    bytesToBinary(new Uint8Array(signatureBuffer))
  );

  return `${header}.${payload}.${signature}`;
};

const buildTargetUrl = (requestUrl) => {
  const source = new URL(requestUrl);
  return new URL(`${source.pathname}${source.search}`, WORKER_API_BASE);
};

const buildProxyRequest = (request, targetUrl) => {
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", new URL(request.url).protocol.replace(":", ""));

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
};

const handleLogin = async (context) => {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed. Use POST." },
      {
        status: 405,
        headers: {
          Allow: "POST",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const email = String(
    request.headers.get("cf-access-authenticated-user-email") || ""
  )
    .trim()
    .toLowerCase();
  const adminEmail = String(env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase();
  const jwtSecret = String(env.JWT_SECRET || "").trim();

  if (!email) {
    return json(
      { error: "Cloudflare Access did not attach the authenticated user email." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (email !== adminEmail) {
    return json(
      { error: "Unauthorized" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!jwtSecret) {
    return json(
      { error: "CMS JWT secret is not configured on the Pages project." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const token = await generateJWT(email, jwtSecret);

  return json(
    {
      success: true,
      token,
      expires,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
};

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname === "/api/auth/login") {
    return handleLogin(context);
  }

  const targetUrl = buildTargetUrl(context.request.url);
  const upstreamRequest = buildProxyRequest(context.request, targetUrl);
  return fetch(upstreamRequest);
}
