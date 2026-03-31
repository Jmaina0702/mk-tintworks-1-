const base64UrlEncode = (value) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

const base64UrlToBase64 = (value) => {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
};

const bytesToBinary = (bytes) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
};

export const decodeBase64Url = (value) => atob(base64UrlToBase64(value));

export const decodeJwtPayloadSegment = (segment) =>
  JSON.parse(decodeBase64Url(segment));

export const generateJWT = async (email, secret) => {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "admin",
      email,
      iat: now,
      exp: now + 8 * 60 * 60,
    })
  );

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${header}.${payload}`)
  );
  const signature = base64UrlEncode(
    bytesToBinary(new Uint8Array(signatureBuffer))
  );

  return `${header}.${payload}.${signature}`;
};

export const verifyJWT = async (token, secret) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format" };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();

  let key;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    return { valid: false, error: "Token verification failed" };
  }

  let signatureBytes;
  try {
    signatureBytes = Uint8Array.from(
      decodeBase64Url(signatureB64),
      (char) => char.charCodeAt(0)
    );
  } catch {
    return { valid: false, error: "Token signature is invalid" };
  }

  let isValid = false;
  try {
    isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
  } catch {
    return { valid: false, error: "Token verification failed" };
  }

  if (!isValid) {
    return { valid: false, error: "Token signature is invalid" };
  }

  let payload;
  try {
    payload = decodeJwtPayloadSegment(payloadB64);
  } catch {
    return { valid: false, error: "Token payload is malformed" };
  }

  return { valid: true, payload };
};
