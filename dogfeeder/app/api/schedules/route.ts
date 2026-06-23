import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

// GET /api/schedules?dogId=... -> horarios del perro
export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const dogId = new URL(request.url).searchParams.get("dogId");
  let query = supabase
    .from("feeding_schedules")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("feed_time");

  if (dogId) query = query.eq("dog_id", dogId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedules: data });
}

// POST /api/schedules -> crea un horario { dogId, feed_time, grams_target, label?, days_of_week? }
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { dogId, feed_time, grams_target, label, days_of_week } = body ?? {};

  if (!dogId || !feed_time || !grams_target) {
    return NextResponse.json(
      { error: "Faltan datos (dogId, feed_time, grams_target)" },
      { status: 400 }
    );
  }

  // El perro debe ser del usuario.
  const { data: dog } = await supabase
    .from("dogs")
    .select("id")
    .eq("id", dogId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!dog) {
    return NextResponse.json({ error: "Perro no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("feeding_schedules")
    .insert({
      owner_id: user.id,
      dog_id: dogId,
      feed_time,
      grams_target: Number(grams_target),
      label: label || null,
      days_of_week: Array.isArray(days_of_week)
        ? days_of_week
        : [0, 1, 2, 3, 4, 5, 6],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedule: data });
}
