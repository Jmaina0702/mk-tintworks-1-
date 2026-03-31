import { json } from "../utils/http.js";
import { verifyJWT } from "../utils/jwt.js";

export const requireAuth = async (request, env) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return json(
      { error: "Authorization header missing" },
      { status: 401 },
      request
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    return json(
      { error: "Authorization header must use Bearer scheme" },
      { status: 401 },
      request
    );
  }

  const token = authHeader.slice(7);
  if (!token || token.trim() === "") {
    return json({ error: "Token is empty" }, { status: 401 }, request);
  }

  const verification = await verifyJWT(token, env.JWT_SECRET);
  if (!verification.valid) {
    return json({ error: verification.error }, { status: 401 }, request);
  }

  const now = Math.floor(Date.now() / 1000);
  const { payload } = verification;

  if (!payload.exp || payload.exp < now) {
    return json(
      { error: "Token has expired. Please log in again." },
      { status: 401 },
      request
    );
  }

  if (payload.sub !== "admin") {
    return json(
      { error: "Token subject is not authorized" },
      { status: 401 },
      request
    );
  }

  if (payload.email !== env.ADMIN_EMAIL) {
    return json({ error: "Unauthorized" }, { status: 401 }, request);
  }

  return null;
};
