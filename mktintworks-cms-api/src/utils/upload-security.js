const SAFE_EXTENSIONS = /^[a-z0-9]+$/i;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
export const MAX_PDF_SIZE = 10 * 1024 * 1024;

export const validateImageUpload = (file) => {
  if (!file) {
    return "No file was provided.";
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "File type not allowed. Upload JPG, PNG, WebP, or GIF images only.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "File is too large. Maximum size is 15MB. Compress the image before uploading.";
  }

  const filename = file.name || "";
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return "Invalid filename.";
  }

  return null;
};

export const validatePdfUpload = (file) => {
  if (!file) {
    return "No file was provided.";
  }

  if (file.type !== "application/pdf") {
    return "File type not allowed. Upload PDF documents only.";
  }

  if (file.size > MAX_PDF_SIZE) {
    return "File is too large. Maximum size is 10MB.";
  }

  const filename = file.name || "";
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return "Invalid filename.";
  }

  return null;
};

export const generateSecureFilename = (prefix = "file", extension = "webp") => {
  const timestamp = Date.now();
  const safePrefix = String(prefix || "file")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
  const safeExtension = SAFE_EXTENSIONS.test(String(extension || ""))
    ? String(extension).toLowerCase()
    : "bin";
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 8);

  return `${safePrefix}-${timestamp}-${random}.${safeExtension}`;
};

export const buildR2Key = (bucketFolder, filename) => {
  const safeFolder = String(bucketFolder || "uploads")
    .split("/")
    .map((segment) =>
      String(segment || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("/");

  return `${safeFolder || "uploads"}/${filename}`;
};
