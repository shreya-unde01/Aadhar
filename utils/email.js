/**
 * Email service utility for AADHAR.
 * Handles dispatching transactional notification emails, including delivery OTPs.
 * Supports SMTP configuration via environment variables with a safe fallback logger.
 */

async function sendDeliveryOtpEmail({ toEmail, recipientName, otp, foodRequest, task }) {
  if (!toEmail) {
    console.warn('[email] No recipient email provided for delivery OTP notification.');
    return false;
  }

  const subject = 'AADHAR: Your Food Delivery Verification OTP';
  const requirements = foodRequest?.requirements ? ` "${foodRequest.requirements}"` : '';
  const plainText = [
    `Namaste ${recipientName || 'Resident'},`,
    '',
    `Your food request${requirements} is currently on its way to you!`,
    '',
    `Your Delivery Verification OTP is: ${otp}`,
    '',
    'Please share this 6-digit OTP with the AADHAR volunteer ONLY when you receive your food delivery in hand.',
    'Do not share this OTP over the phone or with anyone before receiving your delivery.',
    '',
    'Thank you for trusting AADHAR — The Soul Serves.',
  ].join('\n');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">AADHAR</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">The Soul Serves · Food Support</p>
      </div>
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 6px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Namaste <strong>${recipientName || 'Resident'}</strong>,</p>
        <p style="color: #334155; line-height: 1.5;">Your food request${requirements ? ` (<em>${requirements}</em>)` : ''} has been picked up and is on its way to your address.</p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="display: inline-block; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 6px;">Your Delivery Verification OTP</span>
          <div style="font-family: monospace, Courier, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background: #ffffff; padding: 12px 24px; border: 2px dashed #cbd5e1; border-radius: 8px; display: inline-block;">
            ${otp}
          </div>
          <p style="color: #dc2626; font-size: 13px; margin-top: 8px; font-weight: 500;">Valid for this delivery confirmation only</p>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
          <strong>Important:</strong> Please provide this OTP to your delivery volunteer only after you have physically received your food package.
        </p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from AADHAR. Please do not reply to this email.
      </p>
    </div>
  `;

  // Check if SMTP configuration is present
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const fromAddress = process.env.EMAIL_FROM || '"AADHAR Community Support" <noreply@aadhar.org>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(`[email] SMTP configuration is missing. Delivery OTP notification could not be emailed to <${toEmail}>.`);
    return false;
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    console.warn(`[email] Nodemailer is not installed. Delivery OTP notification could not be emailed to <${toEmail}>.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: plainText,
      html: htmlContent,
    });

    return true;
  } catch (err) {
    console.error(`[email] Failed to deliver OTP email to <${toEmail}>:`, err.message);
    return false;
  }
}

module.exports = { sendDeliveryOtpEmail };
