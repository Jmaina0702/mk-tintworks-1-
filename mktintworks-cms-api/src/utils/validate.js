export const sanitizeText = (value, maxLength = 5000) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    value = String(value);
  }

  return value
    .trim()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .substring(0, maxLength);
};

export const sanitizeHTML = (value, maxLength = 50000) => {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .substring(0, maxLength);
};

export const validatePrice = (value) => {
  const parsed = parseFloat(value);
  return !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10000000;
};

export const validateDiscount = (value) => {
  const parsed = parseFloat(value);
  return !Number.isNaN(parsed) && parsed > 0 && parsed < 100;
};

export const validateRating = (value) => {
  const parsed = parseInt(value, 10);
  return !Number.isNaN(parsed) && parsed >= 1 && parsed <= 5;
};

export const validateKenyanPhone = (value) => {
  if (!value) {
    return false;
  }

  const normalized = String(value).replace(/[\s()\-+]/g, "");
  return /^(?:254|0)?[71]\d{8}$/.test(normalized);
};

export const normalizePhone = (value) => {
  const cleaned = String(value).replace(/[\s()\-+]/g, "");
  if (cleaned.startsWith("254")) {
    return cleaned;
  }
  if (cleaned.startsWith("0")) {
    return `254${cleaned.slice(1)}`;
  }
  return `254${cleaned}`;
};

export const validateEmail = (value) => {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
};

export const validateFutureDateTime = (value) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
};

export const validateDateRange = (start, end) => {
  if (!start || !end) {
    return false;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  return (
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime()) &&
    startDate < endDate
  );
};

export const validateSlug = (value) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value));

export const generateSlug = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);

export const validateRequired = (requiredFields, data) => {
  const missing = requiredFields.filter((field) => {
    const value = data[field];
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === "string" && value.trim() === "") {
      return true;
    }
    return false;
  });

  if (missing.length === 0) {
    return null;
  }

  return `Missing required fields: ${missing.join(", ")}`;
};

export const validateEnum = (value, allowed) => allowed.includes(value);

export const isBot = (data) =>
  data?.website !== undefined && String(data.website).trim() !== "";

export const ALLOWED = {
  brand: ["3m", "llumar", "other"],
  tier: ["premium", "high", "mid", "entry", "specialty"],
  content_type: ["text", "html", "image", "link", "price"],
  category: ["automotive", "residential", "commercial"],
  blog_category: [
    "automotive",
    "residential",
    "commercial",
    "maintenance",
    "general",
  ],
  blog_status: ["draft", "published", "unpublished"],
  testimonial_status: ["pending", "approved", "rejected"],
  animation_type: ["fade", "slide-down", "bounce", "zoom", "slide-right"],
  season: ["easter", "christmas", "eid", "custom"],
  service_type: ["automotive", "residential", "commercial"],
  payment_method: ["mpesa", "bank", "cash"],
  payment_status: ["paid", "unpaid", "partial"],
  vehicle_type: ["sedan", "suv", "truck", "specialty"],
  event_type: ["pageview", "product_click", "cta_click", "blog_read"],
  page_content_type: ["text", "html", "image", "link", "price"],
};
