import { NextRequest, NextResponse } from "next/server";
import { getRouterClient } from "@/lib/router-client";
import { updateEnvPassword } from "@/lib/env-password";
import { logAudit, logSettingChange } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { oldPassword, newPassword, confirmPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Missing password fields" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const client = getRouterClient();
    await client.changePassword(oldPassword, newPassword);
    updateEnvPassword(newPassword);

    await logAudit("password.change", { success: true });
    await logSettingChange("admin_password", true, { method: "CHANGE_PASSWORD" });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password change failed";
    await logSettingChange("admin_password", false, { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
