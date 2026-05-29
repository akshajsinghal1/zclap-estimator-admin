/**
 * GET /api/admin/pdf?id=<requestId>
 * Admin-only endpoint — generates and downloads the estimate PDF for any request.
 */

const { getAuthenticatedUser } = require("./_auth");
const { getSupabaseAdminClient } = require("../_supabase");
const { generateEstimatePDF } = require("../_pdf");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requestId = String(req.query.id || "").trim();
  if (!requestId) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: record, error } = await supabase
      .from("estimator_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error || !record) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const pdfBuffer = await generateEstimatePDF(record);

    const filename = `ZCLAP-MDM-Estimate-${record.first_name || "client"}.pdf`
      .replace(/[^a-zA-Z0-9._-]/g, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).end(pdfBuffer);
  } catch (err) {
    console.error("PDF download error:", err);
    res.status(500).json({ error: "Failed to generate PDF", detail: String(err.message || err) });
  }
};
