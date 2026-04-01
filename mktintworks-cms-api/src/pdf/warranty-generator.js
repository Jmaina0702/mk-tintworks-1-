import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COLORS = {
  wine: rgb(0.478, 0.047, 0.118),
  wineSoft: rgb(0.62, 0.14, 0.22),
  gold: rgb(0.788, 0.659, 0.298),
  ivory: rgb(0.985, 0.978, 0.968),
  charcoal: rgb(0.102, 0.102, 0.102),
  muted: rgb(0.46, 0.46, 0.46),
  line: rgb(0.87, 0.84, 0.8),
  white: rgb(1, 1, 1),
};

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const normalizeText = (value) => String(value || "").trim();

const formatDisplayDate = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return "—";
  }

  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? raw : dateFormatter.format(date);
};

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

const clipLines = (lines, maxLines) => {
  if (!maxLines || lines.length <= maxLines) {
    return lines;
  }

  const clipped = lines.slice(0, maxLines);
  const lastLine = clipped[maxLines - 1] || "";
  clipped[maxLines - 1] = `${lastLine.replace(/[ .,:;]+$/g, "")}…`;
  return clipped;
};

const drawWrappedLines = ({
  page,
  font,
  lines,
  x,
  y,
  size,
  lineHeight = 1.3,
  color,
}) => {
  let cursorY = y;

  lines.forEach((line) => {
    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
    }
    cursorY -= size * lineHeight;
  });

  return cursorY;
};

const drawWrappedText = ({
  page,
  font,
  text,
  x,
  y,
  size,
  maxWidth,
  maxLines,
  lineHeight = 1.3,
  color,
}) => {
  const lines = clipLines(wrapText(font, text, size, maxWidth), maxLines);
  return drawWrappedLines({ page, font, lines, x, y, size, lineHeight, color });
};

const drawDetailBlock = ({
  page,
  label,
  value,
  x,
  y,
  width,
  labelFont,
  valueFont,
}) => {
  page.drawText(label, {
    x,
    y,
    size: 8,
    font: labelFont,
    color: COLORS.wineSoft,
  });

  drawWrappedText({
    page,
    font: valueFont,
    text: value || "—",
    x,
    y: y - 14,
    size: 10,
    maxWidth: width,
    maxLines: 2,
    lineHeight: 1.2,
    color: COLORS.charcoal,
  });
};

const drawContentBox = ({
  page,
  title,
  text,
  x,
  y,
  width,
  height,
  titleFont,
  bodyFont,
}) => {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.ivory,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  page.drawText(title, {
    x: x + 14,
    y: y + height - 18,
    size: 9,
    font: titleFont,
    color: COLORS.wine,
  });

  drawWrappedText({
    page,
    font: bodyFont,
    text: text || "—",
    x: x + 14,
    y: y + height - 36,
    size: 9,
    maxWidth: width - 28,
    maxLines: 6,
    lineHeight: 1.28,
    color: COLORS.charcoal,
  });
};

export const generateWarrantyPDF = async (data) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    color: COLORS.white,
    borderColor: COLORS.gold,
    borderWidth: 2,
  });

  page.drawRectangle({
    x: 26,
    y: 26,
    width: width - 52,
    height: height - 52,
    borderColor: COLORS.wine,
    borderWidth: 0.8,
  });

  page.drawRectangle({
    x: 26,
    y: height - 102,
    width: width - 52,
    height: 76,
    color: COLORS.wine,
  });

  page.drawRectangle({
    x: 26,
    y: height - 106,
    width: width - 52,
    height: 4,
    color: COLORS.gold,
  });

  page.drawText("MK TINTWORKS", {
    x: 44,
    y: height - 63,
    size: 22,
    font: bold,
    color: COLORS.white,
  });

  page.drawText("Tint with Precision, Drive with Confidence.", {
    x: 44,
    y: height - 81,
    size: 9,
    font: regular,
    color: rgb(0.92, 0.89, 0.86),
  });

  page.drawText("mktintworks.co@gmail.com  |  +254 703 900 575  |  +254 705 567 956", {
    x: 44,
    y: height - 95,
    size: 8,
    font: regular,
    color: rgb(0.88, 0.85, 0.82),
  });

  const title = "CERTIFICATE OF WARRANTY";
  const titleSize = 18;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  const titleX = (width - titleWidth) / 2;

  page.drawText(title, {
    x: titleX,
    y: height - 144,
    size: titleSize,
    font: bold,
    color: COLORS.wine,
  });

  page.drawLine({
    start: { x: titleX, y: height - 150 },
    end: { x: titleX + titleWidth, y: height - 150 },
    thickness: 1.5,
    color: COLORS.gold,
  });

  page.drawText("Certificate No.", {
    x: width / 2 - 39,
    y: height - 180,
    size: 8,
    font: regular,
    color: COLORS.muted,
  });

  page.drawRectangle({
    x: width / 2 - 95,
    y: height - 220,
    width: 190,
    height: 32,
    color: COLORS.ivory,
    borderColor: COLORS.gold,
    borderWidth: 1,
  });

  const certNumber = normalizeText(data.certificate_number);
  const certSize = 18;
  const certWidth = bold.widthOfTextAtSize(certNumber, certSize);

  page.drawText(certNumber, {
    x: (width - certWidth) / 2,
    y: height - 208,
    size: certSize,
    font: bold,
    color: COLORS.wine,
  });

  let y = height - 262;
  const leftX = 46;
  const rightX = 310;
  const detailWidth = 215;

  drawDetailBlock({
    page,
    label: "Client Name",
    value: data.client_name,
    x: leftX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: bold,
  });
  drawDetailBlock({
    page,
    label: "Vehicle",
    value:
      normalizeText(`${data.vehicle_make || ""} ${data.vehicle_model || ""}`) || "—",
    x: rightX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: bold,
  });

  y -= 48;
  drawDetailBlock({
    page,
    label: "Registration No.",
    value: data.registration_no || "—",
    x: leftX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: regular,
  });
  drawDetailBlock({
    page,
    label: "Film Installed",
    value: data.film_installed || "—",
    x: rightX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: regular,
  });

  y -= 48;
  drawDetailBlock({
    page,
    label: "Installation Date",
    value: formatDisplayDate(data.installation_date),
    x: leftX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: regular,
  });
  drawDetailBlock({
    page,
    label: "Invoice Reference",
    value: data.invoice_ref || "—",
    x: rightX,
    y,
    width: detailWidth,
    labelFont: bold,
    valueFont: regular,
  });

  y -= 52;
  page.drawRectangle({
    x: 46,
    y: y - 10,
    width: width - 92,
    height: 34,
    color: COLORS.wine,
  });

  page.drawText("WARRANTY PERIOD", {
    x: 58,
    y: y + 9,
    size: 8,
    font: bold,
    color: COLORS.gold,
  });

  drawWrappedText({
    page,
    font: bold,
    text: data.warranty_period || "—",
    x: 198,
    y: y + 9,
    size: 13,
    maxWidth: width - 252,
    maxLines: 1,
    lineHeight: 1.1,
    color: COLORS.white,
  });

  y -= 72;
  drawContentBox({
    page,
    title: "WHAT IS COVERED",
    text: data.what_is_covered,
    x: 46,
    y,
    width: width - 92,
    height: 108,
    titleFont: bold,
    bodyFont: regular,
  });

  y -= 124;
  drawContentBox({
    page,
    title: "WHAT IS NOT COVERED",
    text: data.what_is_not_covered,
    x: 46,
    y,
    width: width - 92,
    height: 108,
    titleFont: bold,
    bodyFont: regular,
  });

  const additionalNotes = normalizeText(data.additional_notes);
  if (additionalNotes) {
    y -= 78;
    drawContentBox({
      page,
      title: "ADDITIONAL NOTES",
      text: additionalNotes,
      x: 46,
      y,
      width: width - 92,
      height: 62,
      titleFont: bold,
      bodyFont: regular,
    });
  }

  page.drawText("Authorized by:", {
    x: 46,
    y: 144,
    size: 8,
    font: regular,
    color: COLORS.muted,
  });

  page.drawText("MK Tintworks", {
    x: 46,
    y: 118,
    size: 20,
    font: bold,
    color: COLORS.wine,
  });

  page.drawLine({
    start: { x: 46, y: 112 },
    end: { x: 228, y: 112 },
    thickness: 1,
    color: COLORS.wine,
  });

  page.drawText(`Issue Date: ${formatDisplayDate(data.issue_date)}`, {
    x: 46,
    y: 96,
    size: 8,
    font: regular,
    color: COLORS.muted,
  });

  page.drawText(
    "This warranty is issued by MK Tintworks and is non-transferable.",
    {
      x: 46,
      y: 54,
      size: 8,
      font: italic,
      color: COLORS.muted,
    }
  );

  page.drawText(
    "For warranty claims, present this certificate with your vehicle registration.",
    {
      x: 46,
      y: 41,
      size: 8,
      font: regular,
      color: COLORS.muted,
    }
  );

  page.drawText("mktintworks.co@gmail.com  |  +254 703 900 575  |  +254 705 567 956", {
    x: 46,
    y: 28,
    size: 8,
    font: regular,
    color: COLORS.wine,
  });

  return pdfDoc.save();
};
