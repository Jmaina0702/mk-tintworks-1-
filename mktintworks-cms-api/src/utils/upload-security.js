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
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${random}.${extension}`;
};

export const buildR2Key = (bucketFolder, filename) => {
  const safeFolder = String(bucketFolder || "").replace(/[^a-z0-9-]/g, "");
  return `${safeFolder}/${filename}`;
};
