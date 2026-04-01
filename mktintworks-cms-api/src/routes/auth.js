import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed } from "../utils/http.js";
import { decodeJwtPayloadSegment, generateJWT } from "../utils/jwt.js";

export const login = async (request, env) => {
  if (request.method !== "POST") {
    return methodNotAllowed(request, ["POST"]);
  }

  const cfAccessJwt = request.headers.get("CF-Access-Jwt-Assertion");
  if (!cfAccessJwt) {
    return json(
      { error: "Access denied. Use the admin portal." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
      request
    );
  }

  let email;
  try {
    const payloadB64 = cfAccessJwt.split(".")[1];
    const payload = decodeJwtPayloadSegment(payloadB64);
    email = payload.email;
  } catch {
    return json(
      { error: "Invalid access token" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
      request
    );
  }

  if (email !== env.ADMIN_EMAIL) {
    return json(
      { error: "Unauthorized" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
      request
    );
  }

  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const token = await generateJWT(email, env.JWT_SECRET);

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
    },
    request
  );
};

export const verifyAuth = async (request, env) => {
  if (request.method !== "GET") {
    return methodNotAllowed(request, ["GET"]);
  }

  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  return json(
    {
      valid: true,
      verified_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
    request
  );
};
