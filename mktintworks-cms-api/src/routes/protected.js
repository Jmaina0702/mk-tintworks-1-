import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed } from "../utils/http.js";

export const createProtectedPlaceholderHandler = (
  moduleName,
  allowedMethods = ["GET", "POST", "PUT", "DELETE"]
) =>
  async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) {
      return authError;
    }

    if (!allowedMethods.includes(request.method)) {
      return methodNotAllowed(request, allowedMethods);
    }

    return json(
      {
        success: false,
        module: moduleName,
        message: `${moduleName} endpoints are reserved for later PRD sections.`,
      },
      { status: 501 },
      request
    );
  };
