import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDateStr } from "@/lib/time";

const ONLINE_MS = 12_000;

// POST /api/feed/cerrar -> cierra la compuerta (servo manual).
// Online: el ESP32 cierra y reporta los gramos. Demo: registra la racion ya.
export async function POST() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id, dog_id, timezone")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!device) {
    return NextResponse.json({ error: "No hay dispositivo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: st } = await admin
    .from("device_state")
    .select("last_seen")
    .eq("device_id", device.id)
    .maybeSingle();
  const online =
    !!st?.last_seen && Date.now() - new Date(st.last_seen).getTime() < ONLINE_MS;

  if (online) {
    // El ESP32 cerrara y reportara los gramos via /resultado.
    await admin
      .from("device_state")
      .update({ manual_orden: "cerrar", updated_at: now })
      .eq("device_id", device.id);
    return NextResponse.json({ ok: true, modo: "dispositivo" });
  }

  // Demo (sin hardware): registramos la racion al instante.
  if (device.dog_id) {
    const grams = Math.round(80 + Math.random() * 90);
    await admin.from("servings").insert({
      owner_id: user.id,
      dog_id: device.dog_id,
      device_id: device.id,
      schedule_id: null,
      source: "manual",
      status: "served",
      grams_target: grams,
      grams_actual: grams,
      local_date: localDateStr(new Date(), device.timezone || "America/Lima"),
      served_at: now,
    });
  }
  await admin
    .from("device_state")
    .update({ manual_orden: null, feed_phase: "completed", updated_at: now })
    .eq("device_id", device.id);

  return NextResponse.json({ ok: true, modo: "demo" });
}
