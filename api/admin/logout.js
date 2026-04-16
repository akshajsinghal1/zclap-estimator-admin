const { clearSessionCookieHeader } = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.status(200).json({ ok: true });
};
