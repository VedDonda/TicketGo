const https = require("https");

const sendOtpEmail = (toEmail, toName, otp) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || "TicketGo",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: toEmail, name: toName }],
      subject: "Your TicketGo Verification Code",
      htmlContent: buildOtpHtml(toName, otp),
    });
    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ raw: body });
          }
        } else {
          reject(new Error(`[Brevo] API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", (err) =>
      reject(new Error(`[Brevo] Request failed: ${err.message}`)),
    );
    req.write(payload);
    req.end();
  });
};

const buildOtpHtml = (name, otp) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">🎟 TicketGo</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Email Verification</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi <strong>${name}</strong>,</p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
                Thanks for signing up! Use the code below to verify your email address
                and complete your registration.
              </p>
              <!-- OTP Box -->
              <div style="background:#f9f7ff;border:2px dashed #7c3aed;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your verification code</p>
                <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#4f46e5;font-family:'Courier New',monospace;">${otp}</p>
              </div>
              <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">⏱ This code expires in <strong>10 minutes</strong>.</p>
              <p style="margin:0;color:#9ca3af;font-size:13px;">If you did not create a TicketGo account, you can safely ignore this email.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} TicketGo. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { sendOtpEmail };
