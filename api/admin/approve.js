const { getAuthenticatedUser } = require("./_auth");
const { getSupabaseAdminClient } = require("../_supabase");
const { generateEstimatePDF } = require("../_pdf");
const { sendEstimateEmail } = require("../_email");

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

  const body = req.body || {};
  const requestId = String(body.requestId || "").trim();
  if (!requestId) {
    res.status(400).json({ error: "Missing requestId" });
    return;
  }

  // Optional reviewed fields from admin panel
  const reviewedInputs  = body.reviewedInputs  || null;
  const reviewedOutputs = body.reviewedOutputs || null;
  const contingencyPct  = body.contingencyPct  != null ? Number(body.contingencyPct)  : null;
  const finalLow        = body.finalLow        != null ? Number(body.finalLow)        : null;
  const finalHigh       = body.finalHigh       != null ? Number(body.finalHigh)       : null;

  try {
    const supabase = getSupabaseAdminClient();
    const approvedAt = new Date().toISOString();

    const updatePayload = {
      status:      "done",
      approved_by: approverEmail,
      approved_at: approvedAt,
    };
    if (reviewedInputs  !== null) updatePayload.reviewed_inputs  = reviewedInputs;
    if (reviewedOutputs !== null) updatePayload.reviewed_outputs = reviewedOutputs;
    if (contingencyPct  !== null) updatePayload.contingency_pct  = contingencyPct;
    if (finalLow        !== null) updatePayload.final_low        = finalLow;
    if (finalHigh       !== null) updatePayload.final_high       = finalHigh;

    // Update the record and fetch it back with all fields needed for the PDF
    const { data: approved, error: updateError } = await supabase
      .from("estimator_requests")
      .update(updatePayload)
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id,status,approved_by,approved_at,estimator_type,first_name,last_name,email,company,role,inputs,outputs,reviewed_inputs,reviewed_outputs,contingency_pct,final_low,final_high")
      .maybeSingle();

    if (updateError) {
      console.error("Approve request error:", updateError);
      res.status(500).json({ error: "Failed to approve request" });
      return;
    }

    if (!approved) {
      res.status(404).json({ error: "Pending request not found" });
      return;
    }

    // --- Generate PDF + send email (non-blocking — don't fail the approval if this errors) ---
    let emailStatus = "not_sent";
    let emailError = null;

    try {
      const pdfBuffer = await generateEstimatePDF(approved);

      const emailResult = await sendEstimateEmail(approved, pdfBuffer);
      emailStatus = emailResult.sent ? "sent" : "not_sent";
      emailError = emailResult.error || null;

      // Update email status in DB
      await supabase
        .from("estimator_requests")
        .update({
          email_status: emailStatus,
          email_error: emailError,
          sent_at: emailResult.sent ? new Date().toISOString() : null,
        })
        .eq("id", requestId);

    } catch (pdfErr) {
      console.error("PDF/email error (non-fatal):", pdfErr);
      emailStatus = "not_sent";
      emailError = String(pdfErr.message || pdfErr);

      await supabase
        .from("estimator_requests")
        .update({ email_status: "not_sent", email_error: emailError })
        .eq("id", requestId);
    }

    res.status(200).json({
      ok: true,
      request: {
        id: approved.id,
        status: approved.status,
        approved_by: approved.approved_by,
        approved_at: approved.approved_at,
        email_status: emailStatus,
      },
    });
  } catch (err) {
    console.error("Approve API error:", err);
    res.status(500).json({ error: "Failed to approve request" });
  }
};
