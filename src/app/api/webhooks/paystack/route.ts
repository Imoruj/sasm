import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";

const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET ?? "";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const hash = createHmac("sha512", WEBHOOK_SECRET).update(body).digest("hex");
  return hash === signature;
}

export async function POST(req: Request) {
  // Read raw body for HMAC — must happen before any .json() call
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; data: { reference: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle charge.success — ignore other events gracefully
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    // Idempotency — skip if already processed
    const payment = await db.payment.findFirst({
      where: { gatewayReference: reference },
    });

    if (!payment) {
      // Reference unknown — possibly from a different system, ignore safely
      return NextResponse.json({ received: true });
    }

    if (payment.status === "PAID") {
      // Already processed — idempotent response
      return NextResponse.json({ received: true });
    }

    // Verify with Paystack API before trusting webhook payload
    const verified = await verifyTransaction(reference);

    if (verified.data.status !== "success") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", gatewayResponse: verified.data as object },
      });
      return NextResponse.json({ received: true });
    }

    // Amount integrity check
    if (verified.data.amount !== payment.amountKobo) {
      console.error("[WEBHOOK_PAYSTACK] Amount mismatch", {
        reference,
        expected: payment.amountKobo,
        received: verified.data.amount,
      });
      return NextResponse.json({ received: true });
    }

    // Atomically mark PAID + update application
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: new Date(verified.data.paid_at),
          gatewayResponse: verified.data as object,
        },
      }),
      db.application.update({
        where: { id: payment.applicationId },
        data: { paymentStatus: "PAID" },
      }),
    ]);

    console.log(`[WEBHOOK_PAYSTACK] Payment confirmed: ${reference}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[WEBHOOK_PAYSTACK]", error);
    // Return 200 so Paystack doesn't retry — we'll reconcile via cron
    return NextResponse.json({ received: true });
  }
}
