import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed } from "../utils/http.js";

export const login = async (request, env) => {
  if (request.method !== "POST") {
    return methodNotAllowed(request, ["POST"]);
  }

  return json(
    {
      error: "Use the protected CMS Pages host for login exchange.",
    },
    {
      status: 403,
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
