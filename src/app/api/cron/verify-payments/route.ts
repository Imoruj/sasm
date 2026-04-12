import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";

// Vercel Cron: runs every 30 minutes
// vercel.json → { "crons": [{ "path": "/api/cron/verify-payments", "schedule": "*/30 * * * *" }] }

export async function GET(req: Request) {
  // Guard: only allow Vercel Cron or internal calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const pendingPayments = await db.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      gatewayReference: { not: null },
    },
    select: { id: true, gatewayReference: true, amountKobo: true, applicationId: true },
    take: 50, // process max 50 per run to stay within timeout
  });

  let resolved = 0;
  let failed = 0;

  for (const payment of pendingPayments) {
    try {
      const verified = await verifyTransaction(payment.gatewayReference!);

      if (verified.data.status === "success" && verified.data.amount === payment.amountKobo) {
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
        resolved++;
      } else if (verified.data.status === "failed" || verified.data.status === "abandoned") {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", gatewayResponse: verified.data as object },
        });
        failed++;
      }
      // "abandoned" with pending state — leave for next cron run
    } catch (err) {
      console.error(`[CRON_VERIFY] Failed for ${payment.gatewayReference}:`, err);
    }
  }

  console.log(`[CRON_VERIFY] Processed ${pendingPayments.length} payments: ${resolved} resolved, ${failed} failed`);
  return NextResponse.json({ checked: pendingPayments.length, resolved, failed });
}
