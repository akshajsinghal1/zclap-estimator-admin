/**
 * _email.js — Sends the approved estimate PDF to the client via Postmark.
 *
 * Requires POSTMARK_API_KEY environment variable.
 * If the key is not set, the function logs a warning and returns without sending.
 */

const postmark = require("postmark");

const FROM_ADDRESS = process.env.POSTMARK_FROM_ADDRESS || "hello@zclap.com";
const FROM_NAME = "ZCLAP";

/**
 * Send the estimate PDF to the client.
 *
 * @param {object} record - Full Supabase record
 * @param {Buffer} pdfBuffer - Generated PDF buffer
 * @returns {{ sent: boolean, error?: string }}
 */
async function sendEstimateEmail(record, pdfBuffer) {
  const apiKey = process.env.POSTMARK_API_KEY;

  if (!apiKey) {
    console.warn("[email] POSTMARK_API_KEY not set — skipping email send.");
    return { sent: false, error: "POSTMARK_API_KEY not configured" };
  }

  const client = new postmark.ServerClient(apiKey);

  const firstName = record.first_name || "there";
  const estimatorType =
    record.estimator_type
      ? record.estimator_type.charAt(0).toUpperCase() + record.estimator_type.slice(1)
      : "Implementation";

  // Build cost range string for email body
  const out = record.reviewed_outputs || record.outputs || {};
  const finalLow = record.final_low;
  const finalHigh = record.final_high;

  let costLine = "";
  if (finalLow != null && finalHigh != null) {
    costLine = `Fixed-price quote: $${Number(finalLow).toLocaleString()} – $${Number(finalHigh).toLocaleString()}`;
  } else if (out.lowFmt && out.highFmt) {
    costLine = `Indicative range: ${out.lowFmt} – ${out.highFmt}`;
  }

  const subject = `Your MDM ${estimatorType} Estimate from ZCLAP`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
  <img src="https://zclap.com/logo/zclap-logo.svg" alt="ZCLAP" style="height:36px;margin-bottom:28px;" />

  <h2 style="font-size:22px;margin:0 0 12px;">Hi ${firstName},</h2>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px;">
    Thank you for your interest in ZCLAP's MDM services. Please find your
    <strong>${estimatorType} estimate</strong> attached as a PDF.
  </p>

  ${costLine ? `<p style="font-size:16px;font-weight:600;margin:0 0 20px;">${costLine}</p>` : ""}

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px;">
    This estimate is based on the scope you provided and has been reviewed by our team.
    If you have any questions or would like to discuss next steps, reply to this email or
    reach us at <a href="mailto:hello@zclap.com">hello@zclap.com</a>.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 32px;">
    We look forward to working with you.
  </p>

  <p style="font-size:14px;color:#888;border-top:1px solid #eee;padding-top:20px;margin:0;">
    ZCLAP · <a href="https://zclap.com" style="color:#888;">zclap.com</a>
  </p>
</body>
</html>`;

  const textBody = `Hi ${firstName},\n\nThank you for your interest in ZCLAP's MDM services. Please find your ${estimatorType} estimate attached.\n\n${costLine}\n\nIf you have any questions, reply to this email or reach us at hello@zclap.com.\n\nZCLAP · zclap.com`;

  try {
    const result = await client.sendEmail({
      From: `${FROM_NAME} <${FROM_ADDRESS}>`,
      To: record.email,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      Attachments: [
        {
          Name: `ZCLAP-MDM-Estimate.pdf`,
          Content: pdfBuffer.toString("base64"),
          ContentType: "application/pdf",
        },
      ],
    });

    console.log(`[email] Sent to ${record.email}, MessageID: ${result.MessageID}`);
    return { sent: true, messageId: result.MessageID };
  } catch (err) {
    console.error("[email] Postmark error:", err);
    return { sent: false, error: String(err.message || err) };
  }
}

module.exports = { sendEstimateEmail };
