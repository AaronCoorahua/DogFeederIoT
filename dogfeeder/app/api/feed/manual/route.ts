import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { localDateStr } from "@/lib/time";

const ONLINE_MS = 12_000;

// POST /api/feed/manual -> "Alimentar ahora" (no choca con el horario).
// Si el device esta en linea: deja un comando y el ESP32 lo ejecuta.
// Si no hay hardware (demo): registra la racion al instante.
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: dog } = await supabase
    .from("dogs")
    .select("id, timezone")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!dog) {
    return NextResponse.json({ error: "No hay perro" }, { status: 400 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const body = await request.json().catch(() => ({}));
  let grams = Number(body?.grams);
  if (!Number.isFinite(grams) || grams <= 0) {
    const { data: sched } = await supabase
      .from("feeding_schedules")
      .select("grams_target")
      .eq("dog_id", dog.id)
      .eq("is_active", true)
      .order("feed_time")
      .limit(1)
      .maybeSingle();
    grams = Number(sched?.grams_target) || 250;
  }

  // Ya hay una alimentacion en curso?
  if (device) {
    const { data: enCurso } = await supabase
      .from("servings")
      .select("id")
      .eq("device_id", device.id)
      .eq("status", "commanded")
      .maybeSingle();
    if (enCurso) {
      return NextResponse.json(
        { error: "Ya hay una alimentación en curso." },
        { status: 409 }
      );
    }
  }

  // Online?
  let online = false;
  if (device) {
    const { data: st } = await supabase
      .from("device_state")
      .select("last_seen")
      .eq("device_id", device.id)
      .maybeSingle();
    online =
      !!st?.last_seen && Date.now() - new Date(st.last_seen).getTime() < ONLINE_MS;
  }

  const local_date = localDateStr(new Date(), dog.timezone || "America/Lima");
  const base = {
    owner_id: user.id,
    dog_id: dog.id,
    device_id: device?.id ?? null,
    schedule_id: null,
    source: "manual" as const,
    grams_target: Math.round(grams),
    local_date,
  };

  if (online) {
    // El ESP32 lo ejecutara en el proximo heartbeat.
    const { error } = await supabase
      .from("servings")
      .insert({ ...base, status: "commanded" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, modo: "dispositivo" });
  }

  // Demo: registramos la racion al instante.
  const variacion = Math.round((Math.random() - 0.5) * 12);
  const { error } = await supabase.from("servings").insert({
    ...base,
    status: "served",
    grams_actual: Math.max(1, Math.round(grams) + variacion),
    served_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, modo: "demo" });
}
