import { NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import {
  getPurchaseStatus,
  getStoredUsageForCurrentMonth,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    prepareProfileRequest(request);
    const stored = await getStoredUsageForCurrentMonth();
    const currentTotalBytes = stored?.totalBytes ?? 0;
    const status = await getPurchaseStatus(currentTotalBytes);

    return NextResponse.json({
      status,
      currentTotalBytes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load active purchase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
