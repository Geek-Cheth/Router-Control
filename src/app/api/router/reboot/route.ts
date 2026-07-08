import { NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import { logAudit } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { client } = prepareProfileRequest(request);
    await client.reboot();
    await logAudit("router.reboot", { initiated: true });
    return NextResponse.json({ success: true, message: "Router is rebooting" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reboot failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
