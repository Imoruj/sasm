import { Resend } from "resend";

// Lazy client — avoids "Missing API key" crash during Next.js build-time
// page-data collection when RESEND_API_KEY is not set in the build env.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(apiKey);
  }
  return _resend;
}
// Keep a top-level alias so all call sites stay unchanged (also exported for route files).
export const resend = { emails: { send: (...args: Parameters<Resend["emails"]["send"]>) => getResend().emails.send(...args) } };

type ResendSendResult = Awaited<ReturnType<Resend["emails"]["send"]>>;
async function sendOrThrow(payload: Parameters<Resend["emails"]["send"]>[0]): Promise<ResendSendResult> {
  const result = await resend.emails.send(payload);
  // Resend SDK returns `{ data, error }` but may not throw.
  // Use a runtime check to keep TS compatible across SDK versions.
  const maybeError = (result as unknown as { error?: unknown }).error;
  if (maybeError) {
    const msg =
      typeof maybeError === "string"
        ? maybeError
        : (maybeError as { message?: string }).message ?? "Email send failed";
    throw new Error(msg);
  }
  return result;
}

// Support both EMAIL_FROM ("Name <addr@domain.com>") and EMAIL_FROM_ADDRESS ("addr@domain.com")
function parseEmailAddress(raw: string | undefined): string {
  if (!raw) {
    // Prefer a deterministic sender domain derived from NEXT_PUBLIC_APP_URL
    // (Resend often rejects "noreply@localhost").
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      const hostname = appUrl ? new URL(appUrl).hostname : null;
      if (hostname) return `noreply@${hostname}`;
    } catch {
      // ignore
    }
    return "noreply@localhost";
  }
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw.trim();
}

function getFromAddress(): string {
  const raw = process.env.EMAIL_FROM ?? process.env.EMAIL_FROM_ADDRESS;
  const parsed = parseEmailAddress(raw);

  if (process.env.NODE_ENV === "production") {
    // In production we must use a verified sender/domain.
    if (!raw || parsed.endsWith("@localhost")) {
      throw new Error("EMAIL_FROM (or EMAIL_FROM_ADDRESS) must be set to a verified sender in production");
    }
  }

  return parsed;
}

// In dev/test, Resend only delivers to the verified account owner email.
// Set RESEND_TEST_EMAIL to redirect all applicant emails there.
const TEST_TO = process.env.RESEND_TEST_EMAIL;

function toAddress(email: string): string {
  // Never redirect in production.
  if (process.env.NODE_ENV === "production") return email;
  return TEST_TO ?? email;
}

function makeFrom(orgName: string) {
  return `${orgName} <${getFromAddress()}>`;
}

function formatStudentName(studentName: string | null | undefined) {
  const normalized = studentName?.trim();
  return normalized && normalized.length > 0 ? normalized : "your child";
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export async function sendPasswordResetEmail(email: string, otp: string, firstName: string, orgName = "SAMS") {
  return sendOrThrow({
    from: makeFrom(orgName),
    to: toAddress(email),
    subject: `Reset your ${orgName} password`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">Password Reset Request</h2>
        <p>Hi ${firstName}, use this code to reset your ${orgName} password:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1B4332;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendStaffWelcomeEmail(
  email: string,
  firstName: string,
  lastName: string,
  temporaryPassword: string,
  role: "SCHOOL_ADMIN" | "SUPER_ADMIN",
  branchName: string | null,
  organizationName: string,
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`;
  const roleLabel = role === "SUPER_ADMIN" ? "Super Admin" : "School Admin";
  const branchLine = branchName
    ? `<tr><td style="color:#6b7280;padding:6px 0;width:120px;">Branch</td><td style="font-weight:600;padding:6px 0;">${branchName}</td></tr>`
    : "";

  return resend.emails.send({
    from: makeFrom(organizationName),
    to: toAddress(email),
    subject: `Welcome to ${organizationName} - Your Admin Account`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${organizationName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Admin Portal Access</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Hi <strong>${firstName} ${lastName}</strong>,</p>
          <p style="color:#374151;">Your admin account has been created. Below are your login credentials - please keep them safe.</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#6b7280;padding:6px 0;width:120px;">Email</td><td style="font-weight:600;padding:6px 0;">${email}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;">Password</td>
                <td style="padding:6px 0;">
                  <span style="font-family:monospace;background:#1B4332;color:#fff;padding:4px 10px;border-radius:4px;font-size:15px;letter-spacing:1px;">${temporaryPassword}</span>
                </td>
              </tr>
              <tr><td style="color:#6b7280;padding:6px 0;">Role</td><td style="font-weight:600;padding:6px 0;">${roleLabel}</td></tr>
              ${branchLine}
            </table>
          </div>

          <p style="color:#6b7280;font-size:13px;">For your security, please change your password after your first login.</p>

          <a href="${loginUrl}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            Log In to Admin Portal ->
          </a>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            This email was sent by ${organizationName}. If you did not expect this account, please contact your administrator.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendStaffPasswordResetNotification(
  email: string,
  firstName: string,
  newPassword: string,
  organizationName: string,
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`;

  return resend.emails.send({
    from: makeFrom(organizationName),
    to: toAddress(email),
    subject: `Your ${organizationName} password has been reset`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${organizationName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Password Reset Notice</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#374151;">Your admin account password has been reset by a super administrator. Use the credentials below to log in.</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="color:#6b7280;padding:6px 0;width:120px;">Email</td><td style="font-weight:600;padding:6px 0;">${email}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;">New Password</td>
                <td style="padding:6px 0;">
                  <span style="font-family:monospace;background:#1B4332;color:#fff;padding:4px 10px;border-radius:4px;font-size:15px;letter-spacing:1px;">${newPassword}</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="color:#6b7280;font-size:13px;">Please change your password after logging in.</p>

          <a href="${loginUrl}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            Log In Now ->
          </a>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            If you did not expect this change, contact your administrator immediately.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendApplicationSubmittedEmail(
  email: string,
  firstName: string,
  applicationNumber: string,
  organizationName: string,
) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/applications`;
  return resend.emails.send({
    from: makeFrom(organizationName),
    to: toAddress(email),
    subject: `Application ${applicationNumber} Successfully Submitted - ${organizationName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${organizationName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Admission Application</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Dear <strong>${firstName}</strong>,</p>
          <p style="color:#374151;">
            We are pleased to confirm that your payment has been verified and your application has been successfully submitted.
          </p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Application Number</p>
            <p style="margin:6px 0 0;font-family:monospace;font-size:22px;font-weight:bold;color:#1B4332;letter-spacing:2px;">${applicationNumber}</p>
          </div>

          <p style="color:#374151;">Your application is now under review. You will be notified of any updates via email.</p>

          <a href="${url}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            View My Application ->
          </a>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            This email was sent by ${organizationName}. Please keep your application number safe for future reference.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendAdmissionOfferEmail(
  email: string,
  firstName: string,
  studentName: string,
  applicationNumber: string,
  orgName: string,
  branchName: string,
) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/results`;
  const childName = formatStudentName(studentName);
  const branchLabel = branchName.trim() ? `${orgName} (${branchName})` : orgName;

  return resend.emails.send({
    from: makeFrom(orgName),
    to: toAddress(email),
    subject: `Admission Offer for ${childName} - ${applicationNumber} - ${orgName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${orgName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Admission Offer</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Dear <strong>${firstName}</strong>,</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;">
            <p style="margin:0;font-size:15px;color:#166534;font-weight:600;">
              Congratulations! ${childName} has been offered admission to ${branchLabel}.
            </p>
          </div>
          <p style="color:#374151;">
            Following ${possessive(childName)} successful entrance examination performance, we are delighted to offer ${childName} a place at ${orgName}.
            To secure this offer, please log in to your portal to:
          </p>
          <ol style="color:#374151;padding-left:20px;line-height:1.8;">
            <li>View ${childName}'s exam result</li>
            <li>Pay the acceptance fee to confirm ${childName}'s admission</li>
            <li>Upload the required admission documents</li>
          </ol>
          <p style="color:#dc2626;font-size:13px;font-weight:600;">
            Important: This offer may be withdrawn if the acceptance fee is not paid within the stipulated deadline.
          </p>
          <a href="${url}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            View Offer and Accept Admission ->
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">Application: <strong>${applicationNumber}</strong> - ${orgName}</p>
        </div>
      </div>
    `,
  });
}

export async function sendExamResultPublishedEmail(
  email: string,
  firstName: string,
  studentName: string,
  applicationNumber: string,
  isPassed: boolean,
  orgName: string,
) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/results`;
  const childName = formatStudentName(studentName);
  const subject = isPassed
    ? `Exam Result for ${childName}: Passed - ${applicationNumber}`
    : `Exam Result for ${childName} - ${applicationNumber}`;

  return resend.emails.send({
    from: makeFrom(orgName),
    to: toAddress(email),
    subject,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:${isPassed ? "#1B4332" : "#374151"};padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${orgName}</h1>
          <p style="color:${isPassed ? "#a7f3d0" : "#d1d5db"};margin:4px 0 0;font-size:14px;">Entrance Examination Result</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Dear <strong>${firstName}</strong>,</p>
          <p style="color:#374151;">
            ${childName}'s entrance examination result for application <strong>${applicationNumber}</strong> has been published.
          </p>
          ${isPassed
            ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;color:#166534;font-weight:600;">Result for ${childName}: PASSED</p>
               </div>`
            : `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;color:#991b1b;font-weight:600;">Result for ${childName}: NOT PASSED</p>
                <p style="margin:8px 0 0;color:#7f1d1d;font-size:13px;">
                  We appreciate the effort ${childName} put into this application. You may contact the admissions office for further guidance.
                </p>
               </div>`
          }
          <a href="${url}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            View Full Result ->
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">Application: <strong>${applicationNumber}</strong> - ${orgName}</p>
        </div>
      </div>
    `,
  });
}

export async function sendEnrollmentConfirmationEmail(
  email: string,
  firstName: string,
  studentName: string,
  applicationNumber: string,
  orgName: string,
  branchName: string,
  classAdmitted?: string,
) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/applications`;
  const childName = formatStudentName(studentName);
  const branchLabel = branchName.trim() ? `${orgName} — ${branchName}` : orgName;

  return resend.emails.send({
    from: makeFrom(orgName),
    to: toAddress(email),
    subject: `Enrollment Confirmed: ${childName} is now enrolled at ${orgName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${orgName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Enrollment Confirmation</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Dear <strong>${firstName}</strong>,</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;">
            <p style="margin:0;font-size:15px;color:#166534;font-weight:600;">
              ${childName} has been officially enrolled at ${branchLabel}!
            </p>
          </div>
          <p style="color:#374151;">
            We are delighted to confirm that all admission documents have been reviewed and verified.
            ${possessive(childName)} enrollment is now complete.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="color:#6b7280;padding:6px 0;width:140px;">Application No.</td>
                <td style="font-weight:600;padding:6px 0;font-family:monospace;">${applicationNumber}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0;">School</td>
                <td style="font-weight:600;padding:6px 0;">${branchLabel}</td>
              </tr>
              ${classAdmitted ? `<tr>
                <td style="color:#6b7280;padding:6px 0;">Class Admitted</td>
                <td style="font-weight:600;padding:6px 0;">${classAdmitted.replace(/_/g, " ")}</td>
              </tr>` : ""}
            </table>
          </div>
          <p style="color:#374151;font-size:14px;">
            You will receive further information regarding resumption date, school supplies, and orientation from the admissions office.
            If you have any questions, please do not hesitate to contact us.
          </p>
          <a href="${url}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            View My Portal ->
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            Application: <strong>${applicationNumber}</strong> · ${orgName}
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendApplicantWelcomeEmail(
  email: string,
  firstName: string,
  temporaryPassword: string,
  organizationName: string,
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`;

  return resend.emails.send({
    from: makeFrom(organizationName),
    to: toAddress(email),
    subject: `Your ${organizationName} Applicant Account`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <div style="background:#1B4332;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${organizationName}</h1>
          <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">Applicant Portal Access</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-top:0;">Dear <strong>${firstName}</strong>,</p>
          <p style="color:#374151;">
            An account has been created for you on the ${organizationName} Admission Portal.
            Use the credentials below to log in and track your application.
          </p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="color:#6b7280;padding:6px 0;width:130px;">Email</td>
                <td style="font-weight:600;padding:6px 0;">${email}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0;vertical-align:top;">Password</td>
                <td style="padding:6px 0;">
                  <span style="font-family:monospace;background:#1B4332;color:#fff;padding:4px 12px;border-radius:4px;font-size:16px;letter-spacing:2px;">${temporaryPassword}</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="color:#dc2626;font-size:13px;font-weight:600;">
            Please change your password after your first login for security.
          </p>

          <a href="${loginUrl}"
             style="display:inline-block;background:#1B4332;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px;">
            Log In to Applicant Portal &rarr;
          </a>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            This account was created on your behalf by ${organizationName} admissions staff.
            If you did not expect this, please contact the school directly.
          </p>
        </div>
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
  orgName = "School",
) {
  return resend.emails.send({
    from: makeFrom(orgName),
    to: toAddress(email),
    subject: `Application Update: ${applicationNumber} - ${status}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">Application Status Update</h2>
        <p>Hi ${firstName},</p>
        <p>Your application <strong>${applicationNumber}</strong> status has been updated to <strong>${status}</strong>.</p>
        <p>${message}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/applications"
           style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          View Application
        </a>
      </div>
    `,
  });
}
