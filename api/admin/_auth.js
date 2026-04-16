const crypto = require("crypto");

const SESSION_COOKIE = "zclap_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const cookies = {};
  raw.split(";").forEach((item) => {
    const idx = item.indexOf("=");
    if (idx === -1) return;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev-only-change-me";
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function createSessionToken(email) {
  const issuedAt = Date.now();
  const payload = `${email}|${issuedAt}`;
  const signature = sign(payload, getSessionSecret());
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

function verifySessionToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;
    const [email, issuedAtRaw, signature] = parts;
    const issuedAt = Number(issuedAtRaw);
    if (!email || !issuedAt || Number.isNaN(issuedAt)) return null;

    const payload = `${email}|${issuedAt}`;
    const expectedSig = sign(payload, getSessionSecret());
    if (signature !== expectedSig) return null;
    if (Date.now() - issuedAt > SESSION_TTL_SECONDS * 1000) return null;
    return { email, issuedAt };
  } catch (err) {
    return null;
  }
}

function sessionCookieHeader(token) {
  const securePart = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS};${securePart}`;
}

function clearSessionCookieHeader() {
  const securePart = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${securePart}`;
}

function getAuthorizedUsers() {
  const usersJson = process.env.ADMIN_USERS_JSON;
  if (usersJson) {
    try {
      const users = JSON.parse(usersJson);
      if (Array.isArray(users)) {
        return users
          .filter((u) => u && u.email && u.password)
          .map((u) => ({ email: String(u.email).trim().toLowerCase(), password: String(u.password) }));
      }
    } catch (err) {
      // fall through to single-user env vars
    }
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    return [{ email: process.env.ADMIN_EMAIL.trim().toLowerCase(), password: process.env.ADMIN_PASSWORD }];
  }

  if (process.env.NODE_ENV !== "production") {
    return [{ email: "admin@zclap.local", password: "admin123" }];
  }

  return [];
}

function validateCredentials(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  if (!normalizedEmail || !normalizedPassword) return false;
  return getAuthorizedUsers().some((u) => u.email === normalizedEmail && u.password === normalizedPassword);
}

function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const parsed = verifySessionToken(token);
  return parsed ? parsed.email : null;
}

module.exports = {
  createSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  validateCredentials,
  getAuthenticatedUser,
};
