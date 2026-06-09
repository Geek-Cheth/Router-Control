import { NextResponse } from "next/server";
import { getRouterClient } from "@/lib/router-client";
import {
  getPurchaseStatus,
  getStoredUsageForCurrentMonth,
  syncMonthlyUsage,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = getRouterClient();
    const data = await client.getDashboard();
    const raw = await client.getTrafficAlertRaw().catch(() => ({} as Record<string, string>));

    await syncMonthlyUsage({
      txBytes: data.traffic.monthlyTxBytes,
      rxBytes: data.traffic.monthlyRxBytes,
      quotaGb: data.traffic.dataLimitGB,
      alertPercent: parseInt(raw.data_volume_alert_percent ?? "80", 10) || 80,
      routerDateMonth: raw.date_month,
    });

    const stored = await getStoredUsageForCurrentMonth();
    if (stored) {
      data.storedUsage = {
        yearMonth: stored.yearMonth,
        txBytes: stored.txBytes,
        rxBytes: stored.rxBytes,
        totalBytes: stored.totalBytes,
      };
    }

    const currentTotalBytes =
      stored?.totalBytes ?? data.traffic.monthlyTxBytes + data.traffic.monthlyRxBytes;
    data.purchaseStatus = await getPurchaseStatus(currentTotalBytes);

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach router";
    return NextResponse.json({ error: message, connected: false }, { status: 502 });
  }
}
