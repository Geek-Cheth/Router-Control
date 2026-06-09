import { NextRequest, NextResponse } from "next/server";
import { getRouterClient } from "@/lib/router-client";
import {
  getQuotaSettings as getLocalQuota,
  logAudit,
  saveQuotaSettingsLocal,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = getRouterClient();
    const routerQuota = await client.getQuotaSettings();
    const local = await getLocalQuota();
    return NextResponse.json({
      enabled: routerQuota.enabled,
      limitGB: routerQuota.limitGB || local.limitGb,
      alertPercent: routerQuota.alertPercent || local.alertPercent,
      source: "router",
    });
  } catch {
    const local = await getLocalQuota();
    return NextResponse.json({
      enabled: local.enabled,
      limitGB: local.limitGb,
      alertPercent: local.alertPercent,
      source: "local",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const limitGB = Math.max(1, Number(body.limitGB) || 80);
    const alertPercent = Math.min(100, Math.max(1, Number(body.alertPercent) || 80));

    const client = getRouterClient();
    await client.setQuotaSettings({ enabled, limitGB, alertPercent });
    await saveQuotaSettingsLocal(enabled, limitGB, alertPercent);
    await logAudit("quota.update", { enabled, limitGB, alertPercent });

    return NextResponse.json({ enabled, limitGB, alertPercent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save quota";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
