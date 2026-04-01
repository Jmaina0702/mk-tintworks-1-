import { requireAuth } from "../middleware/auth.js";
import { json, methodNotAllowed, serverError } from "../utils/http.js";
import { sanitizeText } from "../utils/validate.js";
import { FRESH_HEADERS, formatPhoneForPdf, searchClientsForRecords } from "./invoices.js";

const mapInvoiceRow = (row) => ({
  id: Number(row?.id || 0),
  invoice_number: sanitizeText(row?.invoice_number || "", 40),
  service_type: sanitizeText(row?.service_type || "", 30).toLowerCase(),
  film_used: sanitizeText(row?.film_used || "", 200),
  subtotal: Number(row?.subtotal || 0),
  vat_amount: Number(row?.vat_amount || 0),
  total_amount: Number(row?.total_amount || 0),
  payment_method: sanitizeText(row?.payment_method || "", 20).toLowerCase(),
  payment_status: sanitizeText(row?.payment_status || "", 20).toLowerCase(),
  service_date: sanitizeText(row?.service_date || "", 20),
  pdf_r2_key: sanitizeText(row?.pdf_r2_key || "", 255),
  client_name: sanitizeText(row?.client_name || "", 120),
  client_phone: sanitizeText(row?.client_phone || "", 40),
  client_phone_display: formatPhoneForPdf(row?.client_phone || ""),
  registration_no: sanitizeText(row?.registration_no || "", 40).toUpperCase(),
});

const mapWarrantyRow = (row) => ({
  id: Number(row?.id || 0),
  certificate_number: sanitizeText(row?.certificate_number || "", 20).toUpperCase(),
  film_installed: sanitizeText(row?.film_installed || "", 200),
  warranty_period: sanitizeText(row?.warranty_period || "", 200),
  installation_date: sanitizeText(row?.installation_date || "", 20),
  issue_date: sanitizeText(row?.issue_date || "", 20),
  pdf_r2_key: sanitizeText(row?.pdf_r2_key || "", 255),
  client_name: sanitizeText(row?.client_name || "", 120),
  registration_no: sanitizeText(row?.registration_no || "", 40).toUpperCase(),
  vehicle_make: sanitizeText(row?.vehicle_make || "", 100),
  vehicle_model: sanitizeText(row?.vehicle_model || "", 100),
});

export const getInvoices = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const rows = await env.DB.prepare(
      `
        SELECT
          i.id,
          i.invoice_number,
          i.service_type,
          i.film_used,
          i.subtotal,
          i.vat_amount,
          i.total_amount,
          i.payment_method,
          i.payment_status,
          i.service_date,
          i.pdf_r2_key,
          c.full_name AS client_name,
          c.phone AS client_phone,
          v.registration_no
        FROM invoices i
        LEFT JOIN clients c
          ON c.id = i.client_id
        LEFT JOIN vehicles v
          ON v.id = i.vehicle_id
        ORDER BY datetime(i.created_at) DESC, i.id DESC
      `
    ).all();

    return json(
      {
        invoices: (rows.results || []).map(mapInvoiceRow),
      },
      { headers: FRESH_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to load invoice records", error?.message);
    return serverError(request);
  }
};

export const getWarranties = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const rows = await env.DB.prepare(
      `
        SELECT
          w.id,
          w.certificate_number,
          w.film_installed,
          w.warranty_period,
          w.installation_date,
          w.issue_date,
          w.pdf_r2_key,
          c.full_name AS client_name,
          v.registration_no,
          v.make AS vehicle_make,
          v.model AS vehicle_model
        FROM warranties w
        LEFT JOIN clients c
          ON c.id = w.client_id
        LEFT JOIN vehicles v
          ON v.id = w.vehicle_id
        ORDER BY datetime(w.created_at) DESC, w.id DESC
      `
    ).all();

    return json(
      {
        warranties: (rows.results || []).map(mapWarrantyRow),
      },
      { headers: FRESH_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to load warranty records", error?.message);
    return serverError(request);
  }
};

export const handleRecordsRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/records/invoices") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getInvoices(request, env);
  }

  if (pathname === "/api/records/warranties") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getWarranties(request, env);
  }

  if (pathname === "/api/records/clients") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return searchClientsForRecords(request, env);
  }

  return json({ error: "Records route not found." }, { status: 404 }, request);
};
