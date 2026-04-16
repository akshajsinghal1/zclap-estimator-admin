const { getAuthenticatedUser } = require("./_auth");
const { getSupabaseAdminClient } = require("../_supabase");

function mapRequest(row) {
  const emailStatus = row.email_status || (row.sent_at ? "sent" : (row.status === "done" ? "not_sent" : "queued"));
  return {
    id: row.id,
    status: row.status,
    estimatorType: row.estimator_type,
    createdAt: row.created_at,
    source: row.source || {},
    user: {
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
      company: row.company || "",
      role: row.role || "",
    },
    inputs: row.inputs || {},
    estimateText: row.estimate_text || "Estimate available in request details.",
    emailStatus,
    emailError: row.email_error || null,
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    sentAt: row.sent_at || null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = getAuthenticatedUser(req);
  if (!email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("estimator_requests")
      .select("*")
      .in("status", ["pending", "done"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Supabase fetch error:", error);
      res.status(500).json({ error: "Failed to load requests" });
      return;
    }

    const pending = [];
    const done = [];
    (data || []).forEach((row) => {
      const mapped = mapRequest(row);
      if (mapped.status === "done") done.push(mapped);
      else pending.push(mapped);
    });

    res.status(200).json({ pending, done });
  } catch (err) {
    console.error("Requests API error:", err);
    res.status(500).json({ error: "Failed to load requests" });
  }
};
