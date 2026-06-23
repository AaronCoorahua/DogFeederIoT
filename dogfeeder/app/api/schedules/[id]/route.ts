import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/schedules/[id] -> edita un horario
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = [
    "feed_time",
    "grams_target",
    "label",
    "days_of_week",
    "catch_up_window_minutes",
    "is_active",
  ] as const;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in (body ?? {})) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("feeding_schedules")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedule: data });
}

// DELETE /api/schedules/[id] -> desactiva el horario
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await supabase
    .from("feeding_schedules")
    .update({ is_active: false })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
