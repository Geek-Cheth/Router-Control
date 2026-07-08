import { NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import { listMonthlyUsage } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    prepareProfileRequest(request);
    const rows = await listMonthlyUsage();
    return NextResponse.json({
      months: rows.map((r) => ({
        month: r.yearMonth,
        txBytes: r.txBytes,
        rxBytes: r.rxBytes,
        totalBytes: r.totalBytes,
        quotaGB: r.quotaGb,
        finalized: r.finalized,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load usage history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
