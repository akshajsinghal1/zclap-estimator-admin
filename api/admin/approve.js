const { getAuthenticatedUser } = require("./_auth");
const { getSupabaseAdminClient } = require("../_supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const approverEmail = getAuthenticatedUser(req);
  if (!approverEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requestId = String((req.body && req.body.requestId) || "").trim();
  if (!requestId) {
    res.status(400).json({ error: "Missing requestId" });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const approvedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("estimator_requests")
      .update({
        status: "done",
        approved_by: approverEmail,
        approved_at: approvedAt,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id,status,approved_by,approved_at")
      .maybeSingle();

    if (error) {
      console.error("Approve request error:", error);
      res.status(500).json({ error: "Failed to approve request" });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Pending request not found" });
      return;
    }

    res.status(200).json({
      ok: true,
      request: {
        ...data,
        email_status: "not_sent",
      },
    });
  } catch (err) {
    console.error("Approve API error:", err);
    res.status(500).json({ error: "Failed to approve request" });
  }
};
