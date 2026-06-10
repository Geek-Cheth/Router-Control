import { NextResponse } from "next/server";
import { getDailyUsageStats } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1),
      90
    );
    const stats = await getDailyUsageStats(days);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load daily usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
