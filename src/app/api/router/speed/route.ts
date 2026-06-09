import { NextResponse } from "next/server";
import { getRouterClient } from "@/lib/router-client";

export const dynamic = "force-dynamic";

let inFlight: Promise<unknown> | null = null;

export async function GET() {
  try {
    if (!inFlight) {
      inFlight = getRouterClient()
        .getLiveSpeed()
        .finally(() => {
          inFlight = null;
        });
    }
    const speed = await inFlight;
    return NextResponse.json(speed);
  } catch (err) {
    inFlight = null;
    const message = err instanceof Error ? err.message : "Failed to fetch speed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
