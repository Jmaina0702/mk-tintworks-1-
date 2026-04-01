export const CERT_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CERT_PREFIX = "MK";
const CERT_SUFFIX_LENGTH = 8;
const MAX_ATTEMPTS = 20;

const randomSuffix = () => {
  const bytes = new Uint8Array(CERT_SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);

  let suffix = "";
  for (let index = 0; index < bytes.length; index += 1) {
    suffix += CERT_CHARSET[bytes[index] % CERT_CHARSET.length];
  }

  return suffix;
};

export const generateCertNumber = async (env) => {
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const certificateNumber = `${CERT_PREFIX}${randomSuffix()}`;
    const existing = await env.DB.prepare(
      `
        SELECT id
        FROM warranties
        WHERE certificate_number = ?
        LIMIT 1
      `
    )
      .bind(certificateNumber)
      .first();

    if (!existing) {
      return certificateNumber;
    }
  }

  throw new Error(
    `Failed to generate a unique certificate number after ${MAX_ATTEMPTS} attempts.`
  );
};
