const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || "info@zclap.com";
const FROM_NAME = "Lynn Weishaupt";
const REPLY_TO = "lynn.weishaupt@zclap.com";

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

function getComplexityParagraph(risk) {
  const r = String(risk || "medium").toLowerCase();
  if (r === "low") {
    return "I assessed your project as low complexity, which means this estimate is going to be close to spot on given the scope you’ve shared. Based on more than 20 years doing MDM and dozens of MDM projects, my experience says projects like yours tend to go smoothly with a minimum of surprises.";
  }
  if (r === "high") {
    return "I assessed your project as high complexity. But don’t we worried – complex does not mean risky! Highly complex MDM projects are often complex because they are delivering the greatest value. I’ve been doing MDM for more than 20 years with literally dozens of super complex implementations for some of the largest companies n the world. We mitigate complexity by working together to document a solid understanding of your requirements and business outcomes to make sure we get the scope right, and the collaborate hand-in-hand during the implementation to address the inevitable questions that come up.";
  }
  return "I assessed your project as medium complexity. These means our estimate is a solid starting point but we should schedule a call to discuss any unique requirements of your project. Based on more than 20 years doing MDM and dozens of MDM projects, medium complexity does not mean risky; what is does mean is it is important to have a solid understanding of your requirements and business outcomes to make sure we get the scope right.";
}

async function sendEstimateEmail(record, pdfBuffer) {
  const transporter = createTransport();

  if (!transporter) {
    console.warn("[email] SMTP_HOST / SMTP_USER / SMTP_PASSWORD not set — skipping email send.");
    return { sent: false, error: "SMTP not configured" };
  }

  const firstName = record.first_name || "there";
  const compSlug = String(record.company || "ZCLAP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ZCLAP";
  let seq = record.quote_seq || record.sequence_no;
  if (!seq) {
    const digits = String(record.id || "").replace(/[^0-9]/g, "");
    seq = digits ? digits.slice(-3) : "1";
  }
  const quoteNumber = record.quote_id || `${compSlug}-${seq}`;

  const out = record.reviewed_outputs || record.outputs || {};
  const finalLow = record.final_low;
  const finalHigh = record.final_high;

  let priceRange = "TBD";
  if (finalLow != null && finalHigh != null) {
    priceRange = `$${Number(finalLow).toLocaleString("en-US")} – $${Number(finalHigh).toLocaleString("en-US")}`;
  } else if (out.lowFmt && out.highFmt) {
    priceRange = `${out.lowFmt} – ${out.highFmt}`;
  } else if (out.low != null && out.high != null) {
    priceRange = `$${Number(out.low).toLocaleString("en-US")} – $${Number(out.high).toLocaleString("en-US")}`;
  }

  const timelineWks = out.totalWks || record.timeline_weeks || "12";
  const timelineStr = typeof timelineWks === "number" ? `${timelineWks} weeks` : String(timelineWks).includes("week") ? String(timelineWks) : `${timelineWks} weeks`;
  const complexityLevel = String(out.risk || record.complexity || "medium").toLowerCase();

  const complexityParagraph = getComplexityParagraph(complexityLevel);
  const subject = `Your fixed-price MDM estimate from ZCLAP`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:32px 24px;line-height:1.6;">
  <p style="font-size:15px;margin:0 0 16px;color:#111827;">Hi ${firstName},</p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    Thanks for running your project through our estimator &mdash; the full breakdown is attached (Quote ${quoteNumber}).
  </p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    Based on what you told us, we'd deliver this as a fixed-price engagement in the range of <strong>${priceRange}</strong>, over roughly <strong>${timelineStr}</strong>, at <strong>${complexityLevel}</strong> complexity. The PDF lays out the scope and the assumptions behind the number.
  </p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    ${complexityParagraph}
  </p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    A quick word on why that number is fixed. Most MDM work gets quoted time-and-materials, which quietly puts the risk of overruns on you. We do the opposite &mdash; we scope tightly up front and commit to a price, so the estimate you're holding is the start of the conversation, not a moving target. It's indicative for now; a short scoping call is all it takes to turn it into a firm proposal.
  </p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    Any chance you'd be up for 30 minutes next week to walk through it?
  </p>

  <p style="font-size:15px;margin:0 0 16px;color:#374151;">
    Happy to dig into scope, timeline, or where we'd start.
  </p>

  <p style="font-size:15px;margin:0 0 24px;color:#374151;">
    <a href="https://outlook.office.com/bookwithme/user/0f3b381a5df0473d9850870ece3a240e@zclap.com/meetingtype/qsk6DdJyc0C4On90cFntmg2?anonymous&amp;ismsaljsauthenabled&amp;ep=mCardFromTile" style="color:#c9531f;text-decoration:underline;font-weight:600;" target="_blank">Book time with Lynn Weishaupt: Fixed Price Estimate Review</a>
  </p>

  <p style="font-size:15px;margin:0 0 4px;color:#111827;">Best,</p>
  <p style="font-size:16px;font-weight:700;margin:0 0 2px;color:#17324d;">Lynn Weishaupt</p>
  <p style="font-size:14px;color:#4b5563;margin:0 0 2px;">Managing Director, MDM</p>
  <p style="font-size:14px;color:#4b5563;margin:0 0 4px;">ZCLAP &mdash; Data tells the story</p>
  <p style="font-size:14px;margin:0 0 28px;"><a href="mailto:lynn.weishaupt@zclap.com" style="color:#c9531f;text-decoration:none;font-weight:600;">lynn.weishaupt@zclap.com</a></p>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:20px;">
    <tr>
      <td align="left" valign="middle">
        <img src="cid:logo" alt="ZCLAP" style="height:48px;width:auto;display:block;border:0;" />
      </td>
      <td align="right" valign="middle" style="font-size:14px;color:#6b7280;">
        ZCLAP &middot; <a href="https://zclap.com" style="color:#6b7280;text-decoration:none;">zclap.com</a>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBody = `Hi ${firstName},\n\nThanks for running your project through our estimator — the full breakdown is attached (Quote ${quoteNumber}).\n\nBased on what you told us, we'd deliver this as a fixed-price engagement in the range of ${priceRange}, over roughly ${timelineStr}, at ${complexityLevel} complexity. The PDF lays out the scope and the assumptions behind the number.\n\n${complexityParagraph}\n\nA quick word on why that number is fixed. Most MDM work gets quoted time-and-materials, which quietly puts the risk of overruns on you. We do the opposite — we scope tightly up front and commit to a price, so the estimate you're holding is the start of the conversation, not a moving target. It's indicative for now; a short scoping call is all it takes to turn it into a firm proposal.\n\nAny chance you'd be up for 30 minutes next week to walk through it?\n\nHappy to dig into scope, timeline, or where we'd start.\n\nBook time with Lynn Weishaupt: Fixed Price Estimate Review (https://outlook.office.com/bookwithme/user/0f3b381a5df0473d9850870ece3a240e@zclap.com/meetingtype/qsk6DdJyc0C4On90cFntmg2?anonymous&ismsaljsauthenabled&ep=mCardFromTile)\n\nBest,\nLynn Weishaupt\nManaging Director, MDM\nZCLAP — Data tells the story\nlynn.weishaupt@zclap.com`;

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      replyTo: REPLY_TO,
      to: record.email,
      subject,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename: `ZCLAP-MDM-Estimate-${quoteNumber}.pdf`,
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
