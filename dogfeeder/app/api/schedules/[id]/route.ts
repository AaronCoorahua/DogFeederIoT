import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDateStr } from "@/lib/time";

type Params = { params: Promise<{ id: string }> };

const hhmm = (t: unknown) => String(t ?? "").slice(0, 5);

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

  // Hora anterior (para saber si la están cambiando).
  const { data: prev } = await supabase
    .from("feeding_schedules")
    .select("feed_time")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

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

  // Si cambió la HORA, esta comida "a la nueva hora" aún no ocurrió hoy:
  // liberamos el cerrojo (schedule_id, local_date) borrando el serving
  // programado de hoy para que pueda volver a dispararse.
  if (
    data &&
    prev &&
    "feed_time" in patch &&
    hhmm(patch.feed_time) !== hhmm(prev.feed_time)
  ) {
    const admin = createAdminClient();
    await admin
      .from("servings")
      .delete()
      .eq("schedule_id", id)
      .eq("owner_id", user.id)
      .eq("source", "scheduled")
      .eq("local_date", localDateStr(new Date()));
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
