import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COLORS = {
  wine: rgb(0.478, 0.047, 0.118),
  wineSoft: rgb(0.62, 0.14, 0.22),
  gold: rgb(0.788, 0.659, 0.298),
  charcoal: rgb(0.102, 0.102, 0.102),
  muted: rgb(0.45, 0.45, 0.45),
  ivory: rgb(0.97, 0.96, 0.94),
  white: rgb(1, 1, 1),
  line: rgb(0.87, 0.84, 0.8),
  success: rgb(0.07, 0.42, 0.24),
  warning: rgb(0.72, 0.43, 0.06),
};

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatKsh = (value) => `KSh ${currencyFormatter.format(Number(value || 0))}`;

const normalizeText = (value) => String(value || "").trim();

const titleCase = (value) =>
  normalizeText(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const wrapText = (font, text, size, maxWidth) => {
  const content = normalizeText(text);
  if (!content) {
    return [];
  }

  const paragraphs = content.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let currentLine = words.shift();

    words.forEach((word) => {
      const testLine = `${currentLine} ${word}`;
      if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      lines.push("");
    }
  });

  return lines;
};

const drawWrapped = ({
  page,
  font,
  text,
  x,
  y,
  size,
  maxWidth,
  color,
  lineHeight = 1.35,
}) => {
  const lines = wrapText(font, text, size, maxWidth);
  let cursorY = y;

  lines.forEach((line) => {
    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
    }
    cursorY -= size * lineHeight;
  });

  return cursorY;
};

const drawKeyValue = ({
  page,
  label,
  value,
  x,
  y,
  labelFont,
  valueFont,
  labelSize = 8,
  valueSize = 10,
}) => {
  page.drawText(label, {
    x,
    y,
    size: labelSize,
    font: labelFont,
    color: COLORS.wine,
  });

  return drawWrapped({
    page,
    font: valueFont,
    text: value || "—",
    x,
    y: y - 14,
    size: valueSize,
    maxWidth: 210,
    color: COLORS.charcoal,
    lineHeight: 1.25,
  });
};

const drawStatusBadge = ({ page, label, x, y }) => {
  const normalized = normalizeText(label).toLowerCase();
  const badgeColor =
    normalized === "paid"
      ? COLORS.success
      : normalized === "partial"
        ? COLORS.warning
        : COLORS.wineSoft;

  page.drawRectangle({
    x,
    y,
    width: 82,
    height: 20,
    color: badgeColor,
  });

  page.drawText((label || "unpaid").toUpperCase(), {
    x: x + 12,
    y: y + 6.5,
    size: 8,
    font: page.docFonts.bold,
    color: COLORS.white,
  });
};

const drawAmountRow = ({ page, label, value, x, y, bold = false, highlight = false }) => {
  page.drawText(label, {
    x,
    y,
    size: bold ? 10 : 9,
    font: bold ? page.docFonts.bold : page.docFonts.regular,
    color: bold ? COLORS.charcoal : COLORS.muted,
  });

  page.drawText(value, {
    x: x + 118,
    y,
    size: bold ? 11 : 9,
    font: bold ? page.docFonts.bold : page.docFonts.regular,
    color: highlight ? COLORS.wine : COLORS.charcoal,
  });
};

export const generateInvoicePDF = async (data) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.docFonts = { regular, bold };

  page.drawRectangle({
    x: 0,
    y: height - 122,
    width,
    height: 122,
    color: COLORS.wine,
  });

  page.drawRectangle({
    x: 0,
    y: height - 126,
    width,
    height: 4,
    color: COLORS.gold,
  });

  page.drawText("MK TINTWORKS", {
    x: 38,
    y: height - 50,
    size: 23,
    font: bold,
    color: COLORS.white,
  });

  page.drawText("Tint with Precision, Drive with Confidence.", {
    x: 38,
    y: height - 71,
    size: 9,
    font: regular,
    color: rgb(0.93, 0.9, 0.88),
  });

  page.drawText("mktintworks.co@gmail.com  |  +254 703 900 575  |  +254 705 567 956", {
    x: 38,
    y: height - 88,
    size: 8,
    font: regular,
    color: rgb(0.88, 0.85, 0.82),
  });

  page.drawText("INVOICE", {
    x: width - 156,
    y: height - 53,
    size: 28,
    font: bold,
    color: COLORS.white,
  });

  page.drawText(normalizeText(data.invoice_number), {
    x: width - 156,
    y: height - 77,
    size: 12,
    font: bold,
    color: COLORS.gold,
  });

  page.drawText(normalizeText(data.service_date), {
    x: width - 156,
    y: height - 93,
    size: 9,
    font: regular,
    color: rgb(0.88, 0.85, 0.82),
  });

  let leftY = height - 156;
  leftY = drawKeyValue({
    page,
    label: "BILL TO",
    value: data.client_name,
    x: 40,
    y: leftY,
    labelFont: bold,
    valueFont: bold,
    valueSize: 12,
  });

  if (data.client_phone_display) {
    leftY = drawWrapped({
      page,
      font: regular,
      text: data.client_phone_display,
      x: 40,
      y: leftY - 2,
      size: 9,
      maxWidth: 210,
      color: COLORS.muted,
    });
  }

  if (data.client_email) {
    leftY = drawWrapped({
      page,
      font: regular,
      text: data.client_email,
      x: 40,
      y: leftY - 1,
      size: 9,
      maxWidth: 210,
      color: COLORS.muted,
    });
  }

  const vehicleBlock = [
    normalizeText(`${data.vehicle_make || ""} ${data.vehicle_model || ""}`),
    data.registration_no ? `Reg: ${data.registration_no}` : "",
    data.vehicle_type ? `Type: ${titleCase(data.vehicle_type)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  drawKeyValue({
    page,
    label: "VEHICLE",
    value: vehicleBlock || "No vehicle details captured",
    x: width - 218,
    y: height - 156,
    labelFont: bold,
    valueFont: bold,
    valueSize: 11,
  });

  const tableTop = height - 288;
  const tableX = 36;
  const tableWidth = width - 72;
  const rowHeight = 48;

  page.drawRectangle({
    x: tableX,
    y: tableTop,
    width: tableWidth,
    height: 24,
    color: COLORS.wine,
  });

  const columns = [
    { label: "Service", x: tableX + 10, width: 88 },
    { label: "Film Used", x: tableX + 96, width: 164 },
    { label: "Vehicle", x: tableX + 262, width: 70 },
    { label: "Units", x: tableX + 334, width: 44 },
    { label: "Unit Price", x: tableX + 388, width: 72 },
    { label: "Amount", x: tableX + 468, width: 78 },
  ];

  columns.forEach((column) => {
    page.drawText(column.label, {
      x: column.x,
      y: tableTop + 8,
      size: 8,
      font: bold,
      color: COLORS.white,
    });
  });

  page.drawRectangle({
    x: tableX,
    y: tableTop - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: COLORS.ivory,
  });

  const serviceText = titleCase(data.service_type);
  const filmText = normalizeText(data.film_used) || "Custom pricing";
  const vehicleText = titleCase(data.vehicle_type) || "—";

  drawWrapped({
    page,
    font: regular,
    text: serviceText,
    x: columns[0].x,
    y: tableTop - 15,
    size: 8,
    maxWidth: columns[0].width,
    color: COLORS.charcoal,
    lineHeight: 1.15,
  });

  drawWrapped({
    page,
    font: regular,
    text: filmText,
    x: columns[1].x,
    y: tableTop - 15,
    size: 8,
    maxWidth: columns[1].width,
    color: COLORS.charcoal,
    lineHeight: 1.15,
  });

  drawWrapped({
    page,
    font: regular,
    text: vehicleText,
    x: columns[2].x,
    y: tableTop - 15,
    size: 8,
    maxWidth: columns[2].width,
    color: COLORS.charcoal,
    lineHeight: 1.15,
  });

  page.drawText(String(data.windows_count || 1), {
    x: columns[3].x + 10,
    y: tableTop - 15,
    size: 8,
    font: regular,
    color: COLORS.charcoal,
  });

  page.drawText(formatKsh(data.unit_price), {
    x: columns[4].x,
    y: tableTop - 15,
    size: 8,
    font: regular,
    color: COLORS.charcoal,
  });

  page.drawText(formatKsh(data.subtotal), {
    x: columns[5].x,
    y: tableTop - 15,
    size: 8,
    font: regular,
    color: COLORS.charcoal,
  });

  let y = tableTop - 94;
  const totalsX = width - 202;
  drawAmountRow({
    page,
    label: "Subtotal",
    value: formatKsh(data.subtotal),
    x: totalsX,
    y,
  });

  y -= 18;
  drawAmountRow({
    page,
    label: `VAT (${Math.round(Number(data.vat_rate || 0) * 100)}%)`,
    value: formatKsh(data.vat_amount),
    x: totalsX,
    y,
  });

  y -= 10;
  page.drawLine({
    start: { x: totalsX, y },
    end: { x: width - 40, y },
    thickness: 1,
    color: COLORS.gold,
  });

  y -= 22;
  drawAmountRow({
    page,
    label: "TOTAL",
    value: formatKsh(data.total_amount),
    x: totalsX,
    y,
    bold: true,
    highlight: true,
  });

  y -= 62;
  page.drawText("PAYMENT", {
    x: 40,
    y,
    size: 8,
    font: bold,
    color: COLORS.wine,
  });

  y -= 18;
  page.drawText(
    data.payment_method === "mpesa"
      ? "M-Pesa"
      : data.payment_method === "bank"
        ? "Bank Transfer"
        : "Cash",
    {
      x: 40,
      y,
      size: 10,
      font: bold,
      color: COLORS.charcoal,
    }
  );

  if (data.payment_reference) {
    y -= 14;
    page.drawText(`Reference: ${data.payment_reference}`, {
      x: 40,
      y,
      size: 9,
      font: regular,
      color: COLORS.muted,
    });
  }

  drawStatusBadge({
    page,
    label: data.payment_status || "unpaid",
    x: 182,
    y: y - 6,
  });

  if (normalizeText(data.notes)) {
    y -= 52;
    page.drawText("NOTES", {
      x: 40,
      y,
      size: 8,
      font: bold,
      color: COLORS.wine,
    });

    drawWrapped({
      page,
      font: regular,
      text: normalizeText(data.notes),
      x: 40,
      y: y - 16,
      size: 9,
      maxWidth: width - 80,
      color: COLORS.muted,
      lineHeight: 1.3,
    });
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 54,
    color: COLORS.wine,
  });

  page.drawRectangle({
    x: 0,
    y: 54,
    width,
    height: 3,
    color: COLORS.gold,
  });

  page.drawText("Thank you for choosing MK Tintworks", {
    x: 40,
    y: 30,
    size: 10,
    font: bold,
    color: COLORS.white,
  });

  page.drawText("Professional tinting for automotive, residential, and commercial spaces.", {
    x: 40,
    y: 14,
    size: 8,
    font: regular,
    color: rgb(0.88, 0.85, 0.82),
  });

  return pdfDoc.save();
};
