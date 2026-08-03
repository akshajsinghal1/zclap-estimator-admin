const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || "info@zclap.com";
const FROM_NAME = "ZCLAP";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendEstimateEmail(record, pdfBuffer) {
  const transporter = createTransport();

  if (!transporter) {
    console.warn("[email] SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set — skipping email send.");
    return { sent: false, error: "SMTP not configured" };
  }

  const firstName = record.first_name || "there";
  const estimatorType = record.estimator_type
    ? record.estimator_type.charAt(0).toUpperCase() + record.estimator_type.slice(1)
    : "Implementation";

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
  <img src="cid:logo" alt="ZCLAP" style="height:36px;margin-bottom:28px;" />

  <h2 style="font-size:22px;margin:0 0 12px;">Hi ${firstName},</h2>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px;">
    Thank you for your interest in ZCLAP's MDM services. Please find your
    <strong>${estimatorType} estimate</strong> attached as a PDF.
  </p>

  ${costLine ? `<p style="font-size:16px;font-weight:600;margin:0 0 20px;">${costLine}</p>` : ""}

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px;">
    This estimate is based on the scope you provided and has been reviewed by our team.
    If you have any questions or would like to discuss next steps, reply to this email or
    reach us at <a href="mailto:info@zclap.com">info@zclap.com</a>.
  </p>

  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 32px;">
    We look forward to working with you.
  </p>

  <p style="font-size:14px;color:#888;border-top:1px solid #eee;padding-top:20px;margin:0;">
    ZCLAP · <a href="https://zclap.com" style="color:#888;">zclap.com</a>
  </p>
</body>
</html>`;

  const textBody = `Hi ${firstName},\n\nThank you for your interest in ZCLAP's MDM services. Please find your ${estimatorType} estimate attached.\n\n${costLine}\n\nIf you have any questions, reply to this email or reach us at info@zclap.com.\n\nZCLAP · zclap.com`;

  try {
    const info = await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: record.email,
      subject,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename: "ZCLAP-MDM-Estimate.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
        {
          filename: "logo.png",
          path: path.join(__dirname, "../public/logo.png"),
          cid: "logo",
        },
      ],
    });

    console.log(`[email] Sent to ${record.email}, messageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] SMTP error:", err);
    return { sent: false, error: String(err.message || err) };
  }
}

module.exports = { sendEstimateEmail };
