import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "SAMS <noreply@localhost>";

export async function sendOtpEmail(email: string, otp: string, firstName: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your SAMS account",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">Welcome to SAMS, ${firstName}!</h2>
        <p>Your verification code is:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1B4332;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, otp: string, firstName: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your SAMS password",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">Password Reset Request</h2>
        <p>Hi ${firstName}, use this code to reset your password:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1B4332;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendApplicationStatusEmail(
  email: string,
  firstName: string,
  applicationNumber: string,
  status: string,
  message: string,
) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Application Update: ${applicationNumber} — ${status}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">Application Status Update</h2>
        <p>Hi ${firstName},</p>
        <p>Your application <strong>${applicationNumber}</strong> status has been updated to <strong>${status}</strong>.</p>
        <p>${message}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications"
           style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          View Application
        </a>
      </div>
    `,
  });
}
