import { json, methodNotAllowed } from "../utils/http.js";
import { searchClientsForRecords } from "./invoices.js";

export const handleRecordsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/records/clients") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return searchClientsForRecords(request, env);
  }

  return json({ error: "Records route not found." }, { status: 404 }, request);
};
