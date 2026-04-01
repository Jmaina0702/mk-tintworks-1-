import { requireAuth } from "../middleware/auth.js";
import { generateInvoicePDF } from "../pdf/invoice-generator.js";
import {
  json,
  methodNotAllowed,
  serverError,
  withCommonHeaders,
} from "../utils/http.js";
import {
  ALLOWED,
  normalizePhone,
  sanitizeText,
  validateEmail,
  validateEnum,
  validateKenyanPhone,
  validatePrice,
} from "../utils/validate.js";

const VAT_RATE = 0.16;
const MAX_INVOICE_INSERT_RETRIES = 5;
export const FRESH_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const roundCurrency = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampPositiveInt = (value, fallback = 1) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const isIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
};

const formatInvoiceNumber = (year, sequence) =>
  `MKT-${year}-${String(sequence).padStart(3, "0")}`;

export const formatPhoneForPdf = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("254") && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+254 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
};

const escapeLike = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

const buildValidationError = (message, request) =>
  json({ error: message }, { status: 400, headers: FRESH_HEADERS }, request);

const getCurrentInvoiceYear = () => new Date().getFullYear();

const getCurrentMaxSequence = async (env, year) => {
  const row = await env.DB.prepare(
    `
      SELECT MAX(CAST(substr(invoice_number, 10) AS INTEGER)) AS max_sequence
      FROM invoices
      WHERE invoice_number LIKE ?
    `
  )
    .bind(`MKT-${year}-%`)
    .first();

  return Math.max(0, Number(row?.max_sequence || 0));
};

const getNextInvoiceNumber = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const year = getCurrentInvoiceYear();
    const nextSequence = (await getCurrentMaxSequence(env, year)) + 1;

    return json(
      {
        number: formatInvoiceNumber(year, nextSequence),
        vat_rate: VAT_RATE,
      },
      { headers: FRESH_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to compute next invoice number", error?.message);
    return serverError(request);
  }
};

const normalizeInvoicePayload = (body) => {
  const clientName = sanitizeText(body?.client_name || "", 120);
  const rawPhone = sanitizeText(body?.client_phone || "", 40);
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  const email = sanitizeText(body?.client_email || "", 120).toLowerCase();
  const serviceDate = sanitizeText(body?.service_date || "", 20);
  const vehicleMake = sanitizeText(body?.vehicle_make || "", 100);
  const vehicleModel = sanitizeText(body?.vehicle_model || "", 100);
  const registrationNo = sanitizeText(body?.registration_no || "", 40).toUpperCase();
  const vehicleType = sanitizeText(body?.vehicle_type || "", 30).toLowerCase();
  const serviceType = sanitizeText(body?.service_type || "", 30).toLowerCase();
  const filmUsed = sanitizeText(body?.film_used || "", 200);
  const windowsCount = clampPositiveInt(body?.windows_count, 1);
  const unitPrice = roundCurrency(body?.unit_price);
  const paymentMethod = sanitizeText(body?.payment_method || "mpesa", 20).toLowerCase();
  const paymentReference = sanitizeText(body?.payment_reference || "", 100);
  const paymentStatus = sanitizeText(body?.payment_status || "unpaid", 20).toLowerCase();
  const notes = sanitizeText(body?.notes || "", 1000);

  const subtotal = roundCurrency(windowsCount * unitPrice);
  const vatAmount = roundCurrency(subtotal * VAT_RATE);
  const totalAmount = roundCurrency(subtotal + vatAmount);

  return {
    client_name: clientName,
    client_phone: phone,
    client_phone_display: formatPhoneForPdf(phone),
    client_email: email,
    service_date: serviceDate,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    registration_no: registrationNo,
    vehicle_type: vehicleType,
    service_type: serviceType,
    film_used: filmUsed,
    windows_count: windowsCount,
    unit_price: unitPrice,
    subtotal,
    vat_rate: VAT_RATE,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    payment_status: paymentStatus,
    notes,
  };
};

const validateInvoicePayload = (payload) => {
  if (!payload.client_name) {
    return "Client name is required.";
  }

  if (!payload.service_date || !isIsoDate(payload.service_date)) {
    return "Service date must be a valid date.";
  }

  if (!validateEnum(payload.service_type, ALLOWED.service_type)) {
    return `Service type must be one of: ${ALLOWED.service_type.join(", ")}.`;
  }

  if (!validatePrice(payload.unit_price) || payload.unit_price <= 0) {
    return "Unit price must be a valid amount greater than zero.";
  }

  if (!Number.isInteger(payload.windows_count) || payload.windows_count <= 0) {
    return "Windows / units must be a whole number greater than zero.";
  }

  if (payload.client_phone && !validateKenyanPhone(payload.client_phone)) {
    return "Client phone must be a valid Kenyan phone number.";
  }

  if (payload.client_email && !validateEmail(payload.client_email)) {
    return "Client email must be a valid email address.";
  }

  if (
    payload.vehicle_type &&
    !validateEnum(payload.vehicle_type, ALLOWED.vehicle_type)
  ) {
    return `Vehicle type must be one of: ${ALLOWED.vehicle_type.join(", ")}.`;
  }

  if (!validateEnum(payload.payment_method, ALLOWED.payment_method)) {
    return `Payment method must be one of: ${ALLOWED.payment_method.join(", ")}.`;
  }

  if (!validateEnum(payload.payment_status, ALLOWED.payment_status)) {
    return `Payment status must be one of: ${ALLOWED.payment_status.join(", ")}.`;
  }

  return null;
};

const findExistingClient = async (env, payload) => {
  if (payload.client_phone) {
    const byPhone = await env.DB.prepare(
      `
        SELECT id, full_name, phone, email
        FROM clients
        WHERE phone = ?
        LIMIT 1
      `
    )
      .bind(payload.client_phone)
      .first();

    if (byPhone) {
      return byPhone;
    }
  }

  if (payload.client_email) {
    const byEmail = await env.DB.prepare(
      `
        SELECT id, full_name, phone, email
        FROM clients
        WHERE lower(email) = lower(?)
        LIMIT 1
      `
    )
      .bind(payload.client_email)
      .first();

    if (byEmail) {
      return byEmail;
    }
  }

  return env.DB.prepare(
    `
      SELECT id, full_name, phone, email
      FROM clients
      WHERE lower(full_name) = lower(?)
      LIMIT 1
    `
  )
    .bind(payload.client_name)
    .first();
};

export const resolveClient = async (env, payload) => {
  const existing = await findExistingClient(env, payload);

  if (existing) {
    await env.DB.prepare(
      `
        UPDATE clients
        SET
          full_name = ?,
          phone = COALESCE(NULLIF(?, ''), phone),
          email = COALESCE(NULLIF(?, ''), email),
          updated_at = datetime('now')
        WHERE id = ?
      `
    )
      .bind(
        payload.client_name,
        payload.client_phone || "",
        payload.client_email || "",
        existing.id
      )
      .run();

    return Number(existing.id);
  }

  const insert = await env.DB.prepare(
    `
      INSERT INTO clients (
        full_name,
        phone,
        email,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `
  )
    .bind(
      payload.client_name,
      payload.client_phone || null,
      payload.client_email || null
    )
    .run();

  return Number(insert.meta?.last_row_id || 0);
};

export const resolveVehicle = async (env, clientId, payload) => {
  if (!clientId || !payload.registration_no) {
    return null;
  }

  const existing = await env.DB.prepare(
    `
      SELECT id
      FROM vehicles
      WHERE upper(registration_no) = ?
      LIMIT 1
    `
  )
    .bind(payload.registration_no)
    .first();

  if (existing) {
    await env.DB.prepare(
      `
        UPDATE vehicles
        SET
          client_id = ?,
          make = COALESCE(NULLIF(?, ''), make),
          model = COALESCE(NULLIF(?, ''), model),
          vehicle_type = COALESCE(NULLIF(?, ''), vehicle_type)
        WHERE id = ?
      `
    )
      .bind(
        clientId,
        payload.vehicle_make || "",
        payload.vehicle_model || "",
        payload.vehicle_type || "",
        existing.id
      )
      .run();

    return Number(existing.id);
  }

  const insert = await env.DB.prepare(
    `
      INSERT INTO vehicles (
        client_id,
        registration_no,
        make,
        model,
        vehicle_type,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `
  )
    .bind(
      clientId,
      payload.registration_no,
      payload.vehicle_make || null,
      payload.vehicle_model || null,
      payload.vehicle_type || null
    )
    .run();

  return Number(insert.meta?.last_row_id || 0);
};

const isInvoiceNumberConflict = (error) =>
  /UNIQUE constraint failed: invoices\.invoice_number/i.test(
    String(error?.message || "")
  );

const reserveInvoiceRow = async (env, payload, clientId, vehicleId) => {
  const year = getCurrentInvoiceYear();

  for (let attempt = 0; attempt < MAX_INVOICE_INSERT_RETRIES; attempt += 1) {
    const nextSequence = (await getCurrentMaxSequence(env, year)) + 1;
    const invoiceNumber = formatInvoiceNumber(year, nextSequence);

    try {
      const insert = await env.DB.prepare(
        `
          INSERT INTO invoices (
            invoice_number,
            client_id,
            vehicle_id,
            service_type,
            film_used,
            vehicle_type,
            windows_count,
            unit_price,
            subtotal,
            vat_rate,
            vat_amount,
            total_amount,
            payment_method,
            payment_reference,
            payment_status,
            notes,
            service_date,
            pdf_r2_key,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
        `
      )
        .bind(
          invoiceNumber,
          clientId || null,
          vehicleId || null,
          payload.service_type,
          payload.film_used || null,
          payload.vehicle_type || null,
          payload.windows_count,
          payload.unit_price,
          payload.subtotal,
          payload.vat_rate,
          payload.vat_amount,
          payload.total_amount,
          payload.payment_method,
          payload.payment_reference || null,
          payload.payment_status,
          payload.notes || null,
          payload.service_date
        )
        .run();

      return {
        id: Number(insert.meta?.last_row_id || 0),
        invoiceNumber,
      };
    } catch (error) {
      if (isInvoiceNumberConflict(error) && attempt < MAX_INVOICE_INSERT_RETRIES - 1) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not reserve a unique invoice number.");
};

const deleteInvoiceRow = async (env, invoiceId) => {
  if (!invoiceId) {
    return;
  }

  try {
    await env.DB.prepare("DELETE FROM invoices WHERE id = ?").bind(invoiceId).run();
  } catch (error) {
    console.error("Failed to clean up invoice row", invoiceId, error?.message);
  }
};

const mapInvoiceRecord = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: Number(row?.id || 0),
    invoice_number: sanitizeText(row?.invoice_number || "", 40),
    client_id: row?.client_id ? Number(row.client_id) : null,
    vehicle_id: row?.vehicle_id ? Number(row.vehicle_id) : null,
    warranty_id: row?.warranty_id ? Number(row.warranty_id) : null,
    client_name: sanitizeText(row?.client_name || "", 120),
    client_phone: sanitizeText(row?.client_phone || "", 40),
    client_phone_display: formatPhoneForPdf(row?.client_phone || ""),
    client_email: sanitizeText(row?.client_email || "", 120),
    vehicle_make: sanitizeText(row?.vehicle_make || "", 100),
    vehicle_model: sanitizeText(row?.vehicle_model || "", 100),
    registration_no: sanitizeText(row?.registration_no || "", 40).toUpperCase(),
    vehicle_type: sanitizeText(row?.vehicle_type || "", 30).toLowerCase(),
    service_type: sanitizeText(row?.service_type || "", 30).toLowerCase(),
    film_used: sanitizeText(row?.film_used || "", 200),
    windows_count: Number(row?.windows_count || 0),
    unit_price: roundCurrency(row?.unit_price),
    subtotal: roundCurrency(row?.subtotal),
    vat_rate: Number(row?.vat_rate || 0),
    vat_amount: roundCurrency(row?.vat_amount),
    total_amount: roundCurrency(row?.total_amount),
    payment_method: sanitizeText(row?.payment_method || "", 20).toLowerCase(),
    payment_reference: sanitizeText(row?.payment_reference || "", 100),
    payment_status: sanitizeText(row?.payment_status || "", 20).toLowerCase(),
    notes: sanitizeText(row?.notes || "", 1000),
    service_date: sanitizeText(row?.service_date || "", 20),
    pdf_r2_key: sanitizeText(row?.pdf_r2_key || "", 255),
    created_at: row?.created_at || null,
  };
};

export const findInvoiceRecordById = async (env, invoiceId) => {
  const numericInvoiceId = Number.parseInt(String(invoiceId || ""), 10);
  if (!Number.isInteger(numericInvoiceId) || numericInvoiceId <= 0) {
    return null;
  }

  const row = await env.DB.prepare(
    `
      SELECT
        i.id,
        i.invoice_number,
        i.client_id,
        i.vehicle_id,
        i.service_type,
        i.film_used,
        i.vehicle_type,
        i.windows_count,
        i.unit_price,
        i.subtotal,
        i.vat_rate,
        i.vat_amount,
        i.total_amount,
        i.payment_method,
        i.payment_reference,
        i.payment_status,
        i.notes,
        i.service_date,
        i.pdf_r2_key,
        i.warranty_id,
        i.created_at,
        c.full_name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,
        v.make AS vehicle_make,
        v.model AS vehicle_model,
        v.registration_no,
        v.vehicle_type AS vehicle_vehicle_type
      FROM invoices i
      LEFT JOIN clients c
        ON c.id = i.client_id
      LEFT JOIN vehicles v
        ON v.id = i.vehicle_id
      WHERE i.id = ?
      LIMIT 1
    `
  )
    .bind(numericInvoiceId)
    .first();

  if (!row) {
    return null;
  }

  return mapInvoiceRecord({
    ...row,
    vehicle_type: row?.vehicle_vehicle_type || row?.vehicle_type,
  });
};

export const findInvoiceRecordByNumber = async (env, invoiceNumber) => {
  const normalizedInvoiceNumber = sanitizeText(invoiceNumber || "", 40);
  if (!normalizedInvoiceNumber) {
    return null;
  }

  const row = await env.DB.prepare(
    `
      SELECT id
      FROM invoices
      WHERE invoice_number = ?
      LIMIT 1
    `
  )
    .bind(normalizedInvoiceNumber)
    .first();

  if (!row?.id) {
    return null;
  }

  return findInvoiceRecordById(env, row.id);
};

const getInvoiceById = async (request, env, invoiceId) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  const invoice = await findInvoiceRecordById(env, invoiceId);
  if (!invoice) {
    return json(
      { error: "Invoice not found." },
      { status: 404, headers: FRESH_HEADERS },
      request
    );
  }

  return json({ invoice }, { headers: FRESH_HEADERS }, request);
};

const generateInvoice = async (request, env) => {
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

  const payload = normalizeInvoicePayload(body);
  const validationError = validateInvoicePayload(payload);
  if (validationError) {
    return buildValidationError(validationError, request);
  }

  let invoiceId = null;
  let pdfKey = "";

  try {
    const clientId = await resolveClient(env, payload);
    const vehicleId = await resolveVehicle(env, clientId, payload);
    const reserved = await reserveInvoiceRow(env, payload, clientId, vehicleId);

    invoiceId = reserved.id;
    payload.invoice_number = reserved.invoiceNumber;
    pdfKey = `documents/invoice-${payload.invoice_number}.pdf`;

    const pdfBytes = await generateInvoicePDF(payload);

    await env.DOCUMENTS_BUCKET.put(pdfKey, pdfBytes, {
      httpMetadata: {
        contentType: "application/pdf",
      },
    });

    await env.DB.prepare(
      `
        UPDATE invoices
        SET pdf_r2_key = ?
        WHERE id = ?
      `
    )
      .bind(pdfKey, invoiceId)
      .run();

    const response = new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="MKT-Invoice-${payload.invoice_number}.pdf"`,
        "Cache-Control": "no-store",
        "X-MKT-Invoice-Number": payload.invoice_number,
        "X-MKT-Invoice-Id": String(invoiceId),
      },
    });

    return withCommonHeaders(response, request);
  } catch (error) {
    console.error("Failed to generate invoice", error?.message);

    if (pdfKey) {
      env.DOCUMENTS_BUCKET.delete(pdfKey).catch(() => {});
    }

    await deleteInvoiceRow(env, invoiceId);
    return serverError(request);
  }
};

export const handleInvoicesRequest = async (request, env) => {
  const { pathname } = new URL(request.url);

  const invoiceMatch = pathname.match(/^\/api\/invoices\/(\d+)$/);
  if (invoiceMatch) {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getInvoiceById(request, env, invoiceMatch[1]);
  }

  if (pathname === "/api/invoices/next-number") {
    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET"]);
    }

    return getNextInvoiceNumber(request, env);
  }

  if (pathname === "/api/invoices/generate") {
    if (request.method !== "POST") {
      return methodNotAllowed(request, ["POST"]);
    }

    return generateInvoice(request, env);
  }

  return json({ error: "Invoice route not found." }, { status: 404 }, request);
};

export const searchClientsForRecords = async (request, env) => {
  const authError = await requireAuth(request, env);
  if (authError) {
    return authError;
  }

  try {
    const url = new URL(request.url);
    const query = sanitizeText(url.searchParams.get("q") || "", 80);
    const limit = Math.max(
      1,
      Math.min(250, Number.parseInt(url.searchParams.get("limit") || "120", 10) || 120)
    );

    const bindings = [];
    let whereClause = "";
    if (query) {
      const like = `%${escapeLike(query.toLowerCase())}%`;
      whereClause = `
        WHERE
          lower(full_name) LIKE ? ESCAPE '\\'
          OR lower(COALESCE(email, '')) LIKE ? ESCAPE '\\'
          OR replace(COALESCE(phone, ''), ' ', '') LIKE ? ESCAPE '\\'
      `;
      bindings.push(like, like, `%${escapeLike(query.replace(/\s+/g, ""))}%`);
    }

    const clientResult = await env.DB.prepare(
      `
        SELECT
          id,
          full_name,
          phone,
          email,
          created_at,
          updated_at
        FROM clients
        ${whereClause}
        ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, full_name ASC
        LIMIT ?
      `
    )
      .bind(...bindings, limit)
      .all();

    const clients = (clientResult.results || []).map((row) => ({
      id: Number(row?.id || 0),
      full_name: sanitizeText(row?.full_name || "", 120),
      phone: sanitizeText(row?.phone || "", 40),
      phone_display: formatPhoneForPdf(row?.phone || ""),
      email: sanitizeText(row?.email || "", 120),
      created_at: row?.created_at || null,
      updated_at: row?.updated_at || null,
      vehicles: [],
    }));

    const clientIds = clients.map((client) => client.id).filter(Boolean);
    if (clientIds.length) {
      const placeholders = clientIds.map(() => "?").join(", ");
      const vehicleResult = await env.DB.prepare(
        `
          SELECT
            id,
            client_id,
            registration_no,
            make,
            model,
            vehicle_type,
            created_at
          FROM vehicles
          WHERE client_id IN (${placeholders})
          ORDER BY datetime(created_at) DESC, id DESC
        `
      )
        .bind(...clientIds)
        .all();

      const vehiclesByClient = new Map();
      for (const row of vehicleResult.results || []) {
        const clientId = Number(row?.client_id || 0);
        if (!vehiclesByClient.has(clientId)) {
          vehiclesByClient.set(clientId, []);
        }

        vehiclesByClient.get(clientId).push({
          id: Number(row?.id || 0),
          registration_no: sanitizeText(row?.registration_no || "", 40).toUpperCase(),
          make: sanitizeText(row?.make || "", 100),
          model: sanitizeText(row?.model || "", 100),
          vehicle_type: sanitizeText(row?.vehicle_type || "", 30).toLowerCase(),
          created_at: row?.created_at || null,
        });
      }

      clients.forEach((client) => {
        client.vehicles = vehiclesByClient.get(client.id) || [];
      });
    }

    return json(
      {
        clients,
        totals: {
          clients: clients.length,
        },
      },
      { headers: FRESH_HEADERS },
      request
    );
  } catch (error) {
    console.error("Failed to search clients", error?.message);
    return serverError(request);
  }
};
