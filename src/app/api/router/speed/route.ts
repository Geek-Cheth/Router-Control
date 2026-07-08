import { NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";

export const dynamic = "force-dynamic";

const inFlight = new Map<string, Promise<unknown>>();

export async function GET(request: Request) {
  try {
    const { profileId, client } = prepareProfileRequest(request);
    if (!inFlight.has(profileId)) {
      inFlight.set(
        profileId,
        client.getLiveSpeed().finally(() => {
          inFlight.delete(profileId);
        })
      );
    }
    const speed = await inFlight.get(profileId);
    return NextResponse.json(speed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch speed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
