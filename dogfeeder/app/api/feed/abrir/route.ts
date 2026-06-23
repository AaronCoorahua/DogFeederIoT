import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ONLINE_MS = 12_000;

// POST /api/feed/abrir -> fuerza abrir la compuerta (servo manual), sin importar
// la hora ni la presencia del perro. El ESP32 la mantiene abierta hasta "cerrar".
export async function POST() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!device) {
    return NextResponse.json({ error: "No hay dispositivo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: st } = await admin
    .from("device_state")
    .select("last_seen")
    .eq("device_id", device.id)
    .maybeSingle();
  const online =
    !!st?.last_seen && Date.now() - new Date(st.last_seen).getTime() < ONLINE_MS;

  await admin.from("device_state").upsert(
    {
      device_id: device.id,
      manual_orden: "abrir",
      feed_phase: "feeding",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" }
  );

  return NextResponse.json({ ok: true, online });
}
