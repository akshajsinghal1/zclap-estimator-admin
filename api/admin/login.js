const {
  createSessionToken,
  sessionCookieHeader,
  validateCredentials,
} = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const email = body.email || "";
  const password = body.password || "";

  if (!validateCredentials(email, password)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = createSessionToken(String(email).trim().toLowerCase());
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  res.status(200).json({ ok: true });
};
