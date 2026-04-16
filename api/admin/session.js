const { getAuthenticatedUser } = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = getAuthenticatedUser(req);
  if (!email) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.status(200).json({ authenticated: true, user: { email } });
};
