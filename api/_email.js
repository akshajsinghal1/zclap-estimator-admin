const nodemailer = require("nodemailer");

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
  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNTAgODYuOCI+CjwhLS0gU1ZHIGNyZWF0ZWQgd2l0aCBBcnJvdywgYnkgUXVpdmVyQUkgKGh0dHBzOi8vcXVpdmVyLmFpKSAtLT4KICA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPi5jbHMtMCB7ZmlsbDojRjE1QjI1O30KLmNscy0xIHtmaWxsOiNEMjVFM0Y7fQouY2xzLTIge2ZpbGw6IzA4MDMwNDt9Ci5jbHMtMyB7ZmlsbDojMDIwMjAyO30KLmNscy00IHtmaWxsOiMwMTAxMDE7fQouY2xzLTUge2ZpbGw6I0FCNjM0Qjt9PC9zdHlsZT4KICA8cGF0aCBjbGFzcz0iY2xzLTAiIGQ9Im04Mi45IDdoLTE2LjRjLTIuNCAwLTQuNSAyLTQuNSA0LjR2MTcuMWMwIDIuMyAyIDQuNiA0LjQgNC42aDE2LjZjMi40IDAgNC41LTIgNC41LTQuNXYtMTcuMmMwLTIuNC0yLjEtNC40LTQuNi00LjR6Ii8+CiAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJtODIuOSA3aC0xNi40Yy0yLjQgMC00LjUgMi00LjUgNC40djE3LjFjMCAyLjMgMiA0LjYgNC40IDQuNmgxNi42YzIuNCAwIDQuNS0yIDQuNS00LjV2LTE3LjJjMC0yLjQtMi4xLTQuNC00LjYtNC40em0zLjYgMjFjMCAyLjEtMS42IDQtMy43IDRoLTE2Yy0yLjEgMC0zLjktMS43LTMuOS0zLjl2LTE2LjJjMC0yLjEgMS43LTMuOCAzLjgtMy44aDE2YzIuMSAwIDMuOCAxLjcgMy44IDMuOHYxNi4xeiIvPgogIDxwYXRoIGNsYXNzPSJjbHMtMiIgZD0ibTY4LjEgMTMuMnYzLjRoNy45bC03LjkgNi41djMuNWgxMi41di0zLjRoLTdsNy4xLTYuNHYtMy42eiIvPgogIDxwYXRoIGNsYXNzPSJjbHMtMyIgZD0ibTAuNCA0Mi44djIuNWgyMC4xbC0xOS44IDEwLjcgMC4zIDIuNWgyNC4xdi0yLjNoLTE5LjZsMTkuNS0xMC43di0yLjd6Ii8+CiAgPHBhdGggY2xhc3M9ImNscy00IiBkPSJtNTUuNSA0Mi44aC0xOC41Yy00IDAtNy45IDIuOC03LjkgNy45IDAgNC4yIDMuNCA3LjggNy44IDcuOGgxOC42di0yLjNoLTE4LjNjLTIuNyAwLTUuNy0yLTUuNy01LjUgMC0yLjkgMi41LTUuNCA1LjUtNS40aDE4LjV2LTIuNXoiLz4KICA8cGF0aCBjbGFzcz0iY2xzLTQiIGQ9Im01OS40IDQyLjh2MTUuN2gyNS43di0yLjJoLTIzdi0xMy41eiIvPgogIDxwYXRoIGNsYXNzPSJjbHMtNCIgZD0ibTg5LjEgNTguNWgzLjRsMTEuNy0xMy45IDEzLjIgMTMuOWgzLjJsLTE0LjktMTUuN2gtMy4xeiIvPgogIDxwYXRoIGNsYXNzPSJjbHMtNCIgZD0ibTEyNC43IDQyLjh2Mi41aDIwLjljMSAwIDEuNyAwLjcgMS43IDEuOXMtMC44IDEuOS0xLjYgMS45aC0yMS4xdjkuNGgyLjd2LTYuOWgxOC40YzIuMiAwIDMuOC0xLjcgMy44LTQuMnMtMS43LTQuNi0zLjktNC42aC0yMC45eiIvPgogIDxwYXRoIGNsYXNzPSJjbHMtNSIgZD0ibTEyNiA3NmgyLjR2Mi41aC0yLjR6Ii8+CiAgPHBhdGggZD0ibTI1LjQgNzBjMC42LTAuMSAxLjMtMC4yIDIuMi0wLjIgMS41IDAgMi41IDAuMyAzLjIgMC45czEuMSAxLjYgMS4xIDIuOGMwIDEuMy0wLjQgMi4zLTEuMSAzcy0yIDEuNi0zLjUgMS42Yy0wLjggMC0xLjQgMC4yLTEuOSAwLjF2LTguMnptMS4xIDcuNGgxYzIuMSAwIDMuMy0xLjIgMy4zLTMuMyAwLTEuOC0xLTMuMi0zLjItMy4yLTAuNSAwLTAuOSAwLjEtMS4xIDAuMXY2LjR6Ii8+CiAgPHBhdGggZD0ibTM2LjkgNzguMy0wLjEtMC43Yy0wLjMgMC41LTAuOSAwLjktMS43IDAuOS0xLjEgMC0xLjktMC44LTEuOS0xLjYgMC0xLjQgMS4yLTIuMiAzLjQtMi4ydi0wLjFjMC0wLjUtMC4xLTEuMy0xLjItMS4zLTAuNSAwLTEuMSAwLjItMS41IDAuNGwtMC4zLTAuOGMwLjUtMC4zIDEuMi0wLjYgMS45LTAuNiAxLjggMCAyLjMgMS4yIDIuMyAyLjR2Mi4zYzAgMC41IDAgMSAwLjEgMS4zaC0xem0tMC4yLTIuOWMtMS4xIDAtMi4zIDAuMi0yLjMgMS4zIDAgMC42IDAuNCAwLjkgMSAwLjkgMC43IDAgMS4xLTAuNCAxLjMtMC45IDAtMC4xIDAuMS0wLjIgMC4xLTAuM3YtMWgtMC4xeiIvPgogIDxwYXRoIGQ9Im00MSA3MC42djEuNmgxLjV2MC45aC0xLjV2My4xYzAgMC43IDAuMiAxLjEgMC44IDEuMmgwLjZsMC4xIDAuOWMtMC4yIDAuMS0wLjUgMC4yLTAuOSAwLjItMC41IDAtMC45LTAuMi0xLjItMC41cy0wLjQtMC44LTAuNC0xLjV2LTMuM2gtMXYtMC45aDAuOHYtMS4zbDEuMi0wLjR6Ii8+CiAgPHBhdGggZD0ibTQ3LjMgNzguMy0wLjEtMC43Yy0wLjMgMC41LTAuOSAwLjktMS43IDAuOS0xLjEgMC0xLjktMC44LTEuOS0xLjYgMC0xLjQgMS4yLTIuMiAzLjQtMi4ydi0wLjFjMC0wLjUtMC4xLTEuMy0xLjItMS4zLTAuNSAwLTEuMSAwLjItMS41IDAuNGwtMC4zLTAuOGMwLjUtMC4zIDEuMi0wLjYgMS45LTAuNiAxLjggMCAyLjMgMS4yIDIuNCAyLjR2Mi4zYzAgMC41IDAgMSAwLjEgMS4zaC0xLjF6bS0wLjItMi45Yy0xLjEgMC0yLjMgMC4yLTIuMyAxLjMgMCAwLjYgMC40IDAuOSAxIDAuOSAwLjcgMCAxLjEtMC40IDEuMy0wLjkgMC0wLjEgMC4xLTAuMiAwLjEtMC4zdi0xaC0wLjF6Ii8+CiAgPHBhdGggZD0ibTU0LjkgNzAuNnYxLjdoMS41djAuOWgtMS41djMuMmMwIDAuNyAwLjIgMS4xIDAuOCAxLjFoMC42bDAuMSAwLjljLTAuMiAwLjEtMC41IDAuMS0wLjkgMC4xLTAuNSAwLTAuOS0wLjItMS4yLTAuNXMtMC40LTAuOC0wLjQtMS41di0zLjNoLTAuOHYtMC45aDAuOHYtMS40bDEtMC4zeiIvPgogIDxwYXRoIGQ9Im01OC40IDc1LjZjMCAxLjQgMC45IDEuOSAxLjkgMS45IDAuNyAwIDEuMi0wLjEgMS42LTAuM2wwLjIgMC44Yy0wLjQgMC4yLTEgMC40LTEuOSAwLjQtMS43IDAtMi44LTEuMS0yLjgtMi45IDAtMS43IDEtMy4yIDIuNy0zLjIgMS45IDAgMi40IDEuNyAyLjQgMi43djAuNWwtNC4xIDAuMXptMi45LTAuOGMwLTAuNi0wLjMtMS42LTEuNC0xLjYtMSAwLTEuNCAwLjktMS41IDEuNmgyLjl6Ii8+CiAgPHBhdGggZD0ibTY0LjEgNjkuNWgxLjF2OC44aC0xeiIvPgogIDxwYXRoIGQ9Im02Ny4xIDY5LjVoMS4xbDAuMSA4LjhoLTEuMXoiLz4KICA8cGF0aCBkPSJtNzAuMSA3Ny4yYzAuMyAwLjIgMC45IDAuNCAxLjQgMC40IDAuNyAwIDEuMS0wLjQgMS4xLTAuOCAwLTAuNS0wLjMtMC43LTEtMS0xLTAuNC0xLjUtMC45LTEuNS0xLjYgMC0xIDAuNy0xLjkgMi0xLjkgMC42IDAgMS4xIDAuMiAxLjQgMC4zbC0wLjIgMC45Yy0wLjItMC4xLTAuNi0wLjMtMS4yLTAuM3MtMC45IDAuMy0wLjkgMC44IDAuMyAwLjcgMS4xIDFjMSAwLjQgMS40IDAuOSAxLjQgMS43IDAgMS0wLjggMS44LTIuMSAxLjgtMC42IDAtMS4yLTAuMS0xLjYtMC40bDAuMS0wLjl6Ii8+CiAgPHBhdGggZD0ibTc5LjUgNzAuNnYxLjZoMS40djAuOWgtMS40djMuMmMwIDAuNyAwLjIgMS4xIDAuOCAxLjFoMC42djAuOWMtMC4yIDAuMS0wLjUgMC4yLTAuOSAwLjItMC41IDAtMC45LTAuMi0xLjItMC41cy0wLjQtMC44LTAuNC0xLjV2LTMuM2gtMC43di0wLjloMC44bDAuMS0xLjYgMC45LTAuMXoiLz4KICA8cGF0aCBkPSJtODIuNSA2OS41aDEuMXYzLjZjMC4yLTAuMyAwLjQtMC41IDAuNy0wLjdzMC43LTAuMyAxLjEtMC4zYzAuOCAwIDIuMSAwLjUgMi4yIDIuNHYzLjhoLTEuMXYtMy41YzAtMC45LTAuMy0xLjYtMS4zLTEuNi0wLjYgMC0xLjEgMC40LTEuMyAwLjktMC4xIDAuMS0wLjEgMC4zLTAuMSAwLjV2My43aC0xLjN2LTguOHoiLz4KICA8cGF0aCBkPSJtOTAuNCA3NS42YzAgMS40IDAuOSAyIDEuOSAyIDAuNyAwIDEuMi0wLjEgMS42LTAuM2wwLjEgMC44Yy0wLjQgMC4yLTEgMC40LTEuOSAwLjQtMS43IDAtMi44LTEuMi0yLjgtMi45czEtMy4zIDIuNy0zLjNjMS45IDAgMi40IDEuNyAyLjQgMi44djAuNWgtNHptMi45LTAuOGMwLTAuNi0wLjMtMS42LTEuMy0xLjZzLTEuNCAwLjktMS42IDEuNmgyLjl6Ii8+CiAgPHBhdGggZD0ibTk5IDc3LjJjMC4zIDAuMiAwLjkgMC40IDEuNCAwLjQgMC43IDAgMS4xLTAuNCAxLjEtMC44IDAtMC41LTAuMy0wLjgtMS0xLTEtMC40LTEuNS0wLjktMS41LTEuNiAwLTEgMC43LTEuOSAyLTEuOSAwLjYgMCAxLjEgMC4yIDEuNCAwLjNsLTAuMiAwLjljLTAuMi0wLjEtMC42LTAuMy0xLjItMC4zcy0wLjkgMC4zLTAuOSAwLjggMC4zIDAuNyAxLjEgMC45YzEgMC40IDEuNCAwLjkgMS40IDEuNyAwIDEtMC44IDEuOS0yLjEgMS45LTAuNiAwLTEuMi0wLjItMS42LTAuNGwwLjEtMC45eiIvPgogIDxwYXRoIGQ9Im0xMDUuNyA3MC42djEuNmgxLjV2MWgtMS41djMuMWMwIDAuNyAwLjIgMS4xIDAuOCAxLjJoMC42bDAuMSAwLjhjLTAuMiAwLjEtMC41IDAuMi0wLjkgMC4yLTAuNSAwLTAuOS0wLjItMS4yLTAuNXMtMC40LTAuOC0wLjUtMS41di0zLjNoLTAuOHYtMC45aDAuOGwwLjEtMS42IDEtMC4xeiIvPgogIDxwYXRoIGQ9Im0xMTQgNzUuNGMwIDIuMS0xLjQgMy4xLTIuNyAzLjEtMS41IDAtMi45LTEuMi0zLTMgMC0xLjkgMS4zLTMuMiAyLjgtMy4yIDEuNyAwIDIuOSAxLjIgMi45IDMuMXptLTQuNiAwYzAgMS4yIDAuNyAyLjIgMS43IDIuMnMxLjctMC45IDEuOS0yLjJjMC0wLjktMC41LTIuMi0xLjctMi4yLTEuMiAwLjEtMS45IDEuMi0xLjkgMi4yeiIvPgogIDxwYXRoIGQ9Im0xMTUuNiA3NC4ydi0xLjloMXYxLjFjMC4zLTAuOCAwLjktMS4yIDEuNi0xLjJoMC4zdjEuMWgtMC40Yy0wLjcgMC0xLjIgMC41LTEuNCAxLjJ2MC41IDMuNGgtMS4xdi00LjJ6Ii8+CiAgPHBhdGggZD0ibTEyMC42IDcyLjMgMS4yIDMuM2MwLjEgMC40IDAuMyAwLjggMC40IDEuMSAwLjEtMC4zIDAuMi0wLjcgMC4zLTEuMWwxLjEtMy4yaDEuMWwtMS40IDRjLTAuOCAyLTEuMyAzLTIgMy42LTAuNSAwLjUtMSAwLjctMS4zIDAuOGwtMC4zLTAuOWMwLjMtMC4xIDAuNi0wLjMgMC45LTAuNiAwLjMtMC4yIDAuNy0wLjcgMC45LTEuMiAwLTAuMSAwLjEtMC4yIDAuMS0wLjNzMC0wLjEtMC4xLTAuM2wtMi4xLTUuMmgxLjJ6Ii8+Cjwvc3ZnPg==" alt="ZCLAP" style="height:36px;margin-bottom:28px;" />

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
