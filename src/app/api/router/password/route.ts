import { NextRequest, NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import { updateEnvPassword } from "@/lib/env-password";
import { logAudit, logSettingChange } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { profileId, client } = prepareProfileRequest(req);
    const body = await req.json();
    const { oldPassword, newPassword, confirmPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Missing password fields" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    await client.changePassword(oldPassword, newPassword);
    updateEnvPassword(profileId, newPassword);

    await logAudit("password.change", { success: true, profileId });
    await logSettingChange("admin_password", true, { method: "CHANGE_PASSWORD", profileId });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password change failed";
    await logSettingChange("admin_password", false, { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
