import { NextRequest, NextResponse } from "next/server";
import { prepareProfileRequest } from "@/lib/api-profile";
import {
  deleteDataPurchase,
  updateDataPurchase,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

function parseNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    prepareProfileRequest(req);
    const { id: idStr } = await context.params;
    const id = Math.floor(Number(idStr));
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const amountGb = Math.floor(Number(body.amountGb));
    if (!Number.isFinite(amountGb) || amountGb < 1) {
      return NextResponse.json(
        { error: "amountGb must be a positive integer" },
        { status: 400 }
      );
    }

    const startAt = parseNumber(body.startAt);
    const expiresAt = parseNumber(body.expiresAt);
    if (startAt == null || expiresAt == null || expiresAt <= startAt) {
      return NextResponse.json(
        { error: "startAt/expiresAt must be valid (expiresAt after startAt)" },
        { status: 400 }
      );
    }

    const notes =
      typeof body.notes === "string" ? body.notes.trim() || undefined : undefined;
    const alertPercent = Math.min(
      100,
      Math.max(1, Math.floor(Number(body.alertPercent) || 80))
    );

    await updateDataPurchase(id, {
      amountGb,
      notes,
      alertPercent,
      startAt,
      expiresAt,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    prepareProfileRequest(req);
    const { id: idStr } = await context.params;
    const id = Math.floor(Number(idStr));
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await deleteDataPurchase(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

