import { NextRequest, NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import type { MacFilterState } from "@/lib/router-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { client } = prepareProfileRequest(request);
    const macFilter = await client.getMacFilter();
    return NextResponse.json(macFilter);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch MAC filter";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { client } = prepareProfileRequest(req);
    const body = await req.json();
    const mode = body.mode as MacFilterState["mode"];
    const macs = (body.macs as string[]) ?? [];

    if (!["disabled", "whitelist", "blacklist"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    await client.setMacFilter(mode, macs);
    const macFilter = await client.getMacFilter();
    const { logAudit } = await import("@/lib/db/repository");
    await logAudit("mac_filter.update", { mode, macCount: macs.length });
    return NextResponse.json(macFilter);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update MAC filter";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
