import { NextResponse } from "next/server";
import { getRouterClient } from "@/lib/router-client";
import { logAudit } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const client = getRouterClient();
    await client.reboot();
    await logAudit("router.reboot", { initiated: true });
    return NextResponse.json({ success: true, message: "Router is rebooting" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reboot failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
