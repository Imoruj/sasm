const TERMII_BASE = "https://api.ng.termii.com/api";

interface TermiiResponse {
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

export async function sendSms(to: string, message: string): Promise<TermiiResponse> {
  const res = await fetch(`${TERMII_BASE}/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      from: process.env.TERMII_SENDER_ID ?? "SAMS",
      sms: message,
      type: "plain",
      api_key: process.env.TERMII_API_KEY,
      channel: "generic",
    }),
  });

  if (!res.ok) {
    throw new Error(`Termii SMS failed: ${res.statusText}`);
  }

  return res.json() as Promise<TermiiResponse>;
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  await sendSms(phone, `Your SAMS verification code is: ${otp}. Valid for 15 minutes. Do not share.`);
}

export async function sendApplicationUpdateSms(
  phone: string,
  applicationNumber: string,
  status: string,
): Promise<void> {
  await sendSms(
    phone,
    `SAMS: Your application ${applicationNumber} status updated to ${status}. Log in to view details.`,
  );
}
