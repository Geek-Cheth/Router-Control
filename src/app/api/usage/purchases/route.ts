import { NextRequest, NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import { listDataPurchases, recordDataPurchase } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    prepareProfileRequest(request);
    const rows = await listDataPurchases();
    return NextResponse.json({
      purchases: rows.map((r) => ({
        id: r.id,
        amountGb: r.amountGb,
        purchasedAt: r.purchasedAt,
        startAt: r.startAt,
        expiresAt: r.expiresAt,
        notes: r.notes,
        usedBytes: r.usedBytes,
        remainingBytes: r.remainingBytes,
        wastedBytes: r.wastedBytes,
        alertPercent: r.alertPercent,
        status: r.status,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load purchases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    prepareProfileRequest(req);
    const body = await req.json();
    const amountGb = Math.floor(Number(body.amountGb));
    if (!Number.isFinite(amountGb) || amountGb < 1) {
      return NextResponse.json({ error: "amountGb must be a positive integer" }, { status: 400 });
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() || undefined : undefined;
    const alertPercent = Math.min(
      100,
      Math.max(1, Math.floor(Number(body.alertPercent) || 80))
    );

    const startAt = Number(body.startAt);
    const expiresAt = Number(body.expiresAt);
    if (!Number.isFinite(startAt) || !Number.isFinite(expiresAt) || expiresAt <= startAt) {
      return NextResponse.json(
        { error: "startAt/expiresAt must be valid (expiresAt after startAt)" },
        { status: 400 }
      );
    }

    await recordDataPurchase({
      amountGb,
      notes,
      alertPercent,
      startAt,
      expiresAt,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record purchase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
