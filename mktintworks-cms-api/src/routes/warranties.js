import { requireAuth } from "../middleware/auth.js";
import { generateWarrantyPDF } from "../pdf/warranty-generator.js";
import { generateCertNumber } from "../utils/cert-number.js";
import { json, methodNotAllowed, serverError, withCommonHeaders } from "../utils/http.js";
import {
  normalizePhone,
  sanitizeText,
  validateEmail,
  validateKenyanPhone,
} from "../utils/validate.js";
import {
  findInvoiceRecordById,
  findInvoiceRecordByNumber,
  FRESH_HEADERS,
  formatPhoneForPdf,
  isIsoDate,
  resolveClient,
  resolveVehicle,
} from "./invoices.js";

const buildValidationError = (message, request, status = 400) =>
  json({ error: message }, { status, headers: FRESH_HEADERS }, request);

const normalizeWarrantyPayload = (body) => {
  const rawPhone = sanitizeText(body?.client_phone || "", 40);
  const invoiceId = Number.parseInt(String(body?.invoice_id || ""), 10);

  return {
    client_name: sanitizeText(body?.client_name || "", 120),
    client_phone: rawPhone ? normalizePhone(rawPhone) : "",
    client_phone_display: rawPhone ? formatPhoneForPdf(rawPhone) : "",
    client_email: sanitizeText(body?.client_email || "", 120).toLowerCase(),
    vehicle_make: sanitizeText(body?.vehicle_make || "", 100),
    vehicle_model: sanitizeText(body?.vehicle_model || "", 100),
    registration_no: sanitizeText(body?.registration_no || "", 40).toUpperCase(),
    film_installed: sanitizeText(body?.film_installed || "", 200),
    installation_date: sanitizeText(body?.installation_date || "", 20),
    invoice_ref: sanitizeText(body?.invoice_ref || "", 40),
    issue_date: sanitizeText(body?.issue_date || "", 20),
    warranty_period: sanitizeText(body?.warranty_period || "", 200),
    what_is_covered: sanitizeText(body?.what_is_covered || "", 2000),
    what_is_not_covered: sanitizeText(body?.what_is_not_covered || "", 2000),
    additional_notes: sanitizeText(body?.additional_notes || "", 1000),
    invoice_id:
      Number.isInteger(invoiceId) && invoiceId > 0 ? invoiceId : null,
  };
};

const validateWarrantyPayload = (payload) => {
  if (!payload.client_name) {
    return "Client name is required.";
  }

  if (!payload.film_installed) {
    return "Film installed is required.";
  }

  if (!payload.installation_date || !isIsoDate(payload.installation_date)) {
    return "Installation date must be a valid date.";
  }

  if (!payload.issue_date || !isIsoDate(payload.issue_date)) {
    return "Issue date must be a valid date.";
  }

  if (!payload.warranty_period) {
    return "Warranty period is required.";
  }

  if (!payload.what_is_covered) {
    return "What is covered is required.";
  }

  if (!payload.what_is_not_covered) {
    return "What is not covered is required.";
  }

  if (payload.client_phone && !validateKenyanPhone(payload.client_phone)) {
    return "Client phone must be a valid Kenyan phone number.";
  }

  if (payload.client_email && !validateEmail(payload.client_email)) {
    return "Client email must be a valid email address.";
  }

  return null;
};

const resolveLinkedInvoice = async (env, payload) => {
  if (payload.invoice_id) {
    return findInvoiceRecordById(env, payload.invoice_id);
  }

  if (payload.invoice_ref) {
    return findInvoiceRecordByNumber(env, payload.invoice_ref);
  }

  return null;
};

const findWarrantyByInvoiceId = async (env, invoiceId) => {
  if (!invoiceId) {
    return null;
  }

  return env.DB.prepare(
    `
      SELECT id, certificate_number
      FROM warranties
      WHERE invoice_id = ?
      LIMIT 1
    `
  )
    .bind(invoiceId)
    .first();
};

export const generateWarranty = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return buildValidationError("Request body must be valid JSON.", request);
  }

  const payload = normalizeWarrantyPayload(body);
  const validationError = validateWarrantyPayload(payload);
  if (validationError) {
    return buildValidationError(validationError, request);
  }

  let warrantyId = null;
  let linkedInvoiceId = null;
  let invoiceLinked = false;
  let pdfKey = "";
  let pdfStored = false;

  try {
    const linkedInvoice = await resolveLinkedInvoice(env, payload);
    if (payload.invoice_id && !linkedInvoice) {
      return buildValidationError("Referenced invoice was not found.", request, 404);
    }

    if (linkedInvoice?.warranty_id) {
      return buildValidationError(
        `Invoice ${linkedInvoice.invoice_number} already has a warranty certificate.`,
        request,
        409
      );
    }

    linkedInvoiceId = linkedInvoice?.id || null;

    const existingWarranty = await findWarrantyByInvoiceId(env, linkedInvoiceId);
    if (existingWarranty) {
      return buildValidationError(
        `Invoice ${linkedInvoice.invoice_number} already maps to warranty ${existingWarranty.certificate_number}.`,
        request,
        409
      );
    }

    const clientId = await resolveClient(env, payload);
    const vehicleId = payload.registration_no
      ? await resolveVehicle(env, clientId, payload)
      : null;
    const certificateNumber = await generateCertNumber(env);
    pdfKey = `documents/warranty-${certificateNumber}.pdf`;

    const pdfBytes = await generateWarrantyPDF({
      ...payload,
      certificate_number: certificateNumber,
      invoice_ref: payload.invoice_ref || linkedInvoice?.invoice_number || "",
    });

    await env.DOCUMENTS_BUCKET.put(pdfKey, pdfBytes, {
      httpMetadata: {
        contentType: "application/pdf",
      },
    });
    pdfStored = true;

    const insert = await env.DB.prepare(
      `
        INSERT INTO warranties (
          certificate_number,
          invoice_id,
          client_id,
          vehicle_id,
          film_installed,
          installation_date,
          warranty_period,
          what_is_covered,
          what_is_not_covered,
          additional_notes,
          issue_date,
          pdf_r2_key,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `
    )
      .bind(
        certificateNumber,
        linkedInvoiceId,
        clientId || null,
        vehicleId || null,
        payload.film_installed,
        payload.installation_date,
        payload.warranty_period,
        payload.what_is_covered,
        payload.what_is_not_covered,
        payload.additional_notes || null,
        payload.issue_date,
        pdfKey
      )
      .run();

    warrantyId = Number(insert.meta?.last_row_id || 0);

    if (linkedInvoiceId) {
      await env.DB.prepare(
        `
          UPDATE invoices
          SET warranty_id = ?
          WHERE id = ?
        `
      )
        .bind(warrantyId, linkedInvoiceId)
        .run();
      invoiceLinked = true;
    }

    const response = new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="MK-Warranty-${certificateNumber}.pdf"`,
        "Cache-Control": "no-store",
        "X-Certificate-Number": certificateNumber,
        "X-Warranty-Id": String(warrantyId),
      },
    });

    return withCommonHeaders(response, request);
  } catch (error) {
    console.error("Failed to generate warranty", error?.message);

    if (pdfKey) {
      env.DOCUMENTS_BUCKET.delete(pdfKey).catch(() => {});
    }

    if (invoiceLinked && linkedInvoiceId && warrantyId) {
      env.DB.prepare(
        `
          UPDATE invoices
          SET warranty_id = NULL
          WHERE id = ?
            AND warranty_id = ?
        `
      )
        .bind(linkedInvoiceId, warrantyId)
        .run()
        .catch(() => {});
    }

    if (pdfStored && !warrantyId && pdfKey) {
      env.DOCUMENTS_BUCKET.delete(pdfKey).catch(() => {});
    }

    return serverError(request);
  }
};

const downloadWarrantyPdf = async (request, env, certificateNumber) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const normalizedCertificateNumber = sanitizeText(
    decodeURIComponent(certificateNumber || ""),
    20
  ).toUpperCase();

  const warranty = await env.DB.prepare(
    `
      SELECT certificate_number, pdf_r2_key
      FROM warranties
      WHERE certificate_number = ?
      LIMIT 1
    `
  )
    .bind(normalizedCertificateNumber)
    .first();

  if (!warranty?.pdf_r2_key) {
    return json(
      { error: "Warranty PDF not found." },
      { status: 404, headers: FRESH_HEADERS },
      request
    );
  }

  const pdfObject = await env.DOCUMENTS_BUCKET.get(warranty.pdf_r2_key);
  if (!pdfObject) {
    return json(
      { error: "Warranty PDF is missing from storage." },
      { status: 404, headers: FRESH_HEADERS },
      request
    );
  }

  const response = new Response(pdfObject.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="MK-Warranty-${warranty.certificate_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });

  return withCommonHeaders(response, request);
};

export const handleWarrantiesRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  const warrantyPdfMatch = pathname.match(/^\/api\/warranties\/pdf\/([^/]+)$/);
  if (warrantyPdfMatch) {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return downloadWarrantyPdf(request, env, warrantyPdfMatch[1]);
  }

  if (pathname === "/api/warranties/generate") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return generateWarranty(request, env);
  }

  return json({ error: "Warranty route not found." }, { status: 404 }, request);
};
