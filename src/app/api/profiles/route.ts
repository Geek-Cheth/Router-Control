import { NextResponse } from "next/server";
import { listPublicProfiles, loadProfilesConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadProfilesConfig();
  return NextResponse.json({
    activeProfileId: config.activeProfileId,
    profiles: listPublicProfiles(),
  });
}
