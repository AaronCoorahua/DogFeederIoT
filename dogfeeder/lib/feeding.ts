// ======================================================
// Maquina de estados del feeding, declarativa e idempotente, sobre Supabase.
//
// En cada heartbeat el servidor recalcula desde la BD si toca servir AHORA:
//   - hay un horario vencido (dentro de su ventana) y aun no servido hoy
//   - y el perro esta cerca
// Entonces RECLAMA el slot del dia de forma atomica (indice unico
// (schedule_id, local_date)) y responde alimentar:true con sus gramos.
//
// Tambien soporta el SERVO MANUAL (forzar servir / cerrar) via
// device_state.manual_orden: 'abrir' mantiene la compuerta abierta y 'cerrar'
// la cierra; al cerrar el ESP32 reporta los gramos y se registra la racion.
// El boton manual inserta un serving sin schedule (no choca con el cerrojo).
// ======================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/hash";
import { localParts, localDateStr, hhmmToMinutes } from "@/lib/time";

const COMMAND_TIMEOUT_MS = 30_000; // si el device no confirma, liberamos el slot

export interface HeartbeatIn {
  perroCerca: boolean;
  peso: number;
  distancia: number;
}
export interface HeartbeatOut {
  pesoObjetivo: number;
  alimentar: boolean;
  abrir?: boolean;
  cerrar?: boolean;
  _t?: string;    // hora Lima "HH:MM" para debug en Serial Monitor
  _near?: boolean; // si el server consideró al perro cerca
  _next?: string; // próxima comida programada "HH:MM" (o "ninguna")
}

type Admin = ReturnType<typeof createAdminClient>;
type Device = {
  id: string;
  owner_id: string;
  dog_id: string | null;
  near_distance_cm: number;
  timezone: string;
};

async function findDevice(admin: Admin, apiKey: string): Promise<Device | null> {
  const { data } = await admin
    .from("devices")
    .select("*")
    .eq("api_key_hash", sha256Hex(apiKey))
    .eq("is_active", true)
    .maybeSingle();
  return (data as Device | null) ?? null;
}

// El ESP32 reporta y recibe si debe alimentar / abrir / cerrar.
export async function heartbeat(
  apiKey: string,
  data: HeartbeatIn
): Promise<HeartbeatOut | null> {
  const admin = createAdminClient();
  const device = await findDevice(admin, apiKey);
  if (!device) return null; // 401

  const now = new Date();
  const { dateStr, minutes, dow } = localParts(now, device.timezone);
  const _t = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  // 1) Telemetria viva.
  await admin.from("device_state").upsert(
    {
      device_id: device.id,
      perro_cerca: !!data.perroCerca,
      peso_g: data.peso,
      distancia_cm: data.distancia,
      last_seen: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "device_id" }
  );

  // 2) Servo manual (tiene prioridad sobre los horarios).
  const { data: st } = await admin
    .from("device_state")
    .select("manual_orden")
    .eq("device_id", device.id)
    .maybeSingle();
  const orden = st?.manual_orden as string | null | undefined;
  if (orden === "abrir") return { pesoObjetivo: 0, alimentar: false, abrir: true, _t };
  if (orden === "cerrar") return { pesoObjetivo: 0, alimentar: false, cerrar: true, _t };

  if (!device.dog_id) return { pesoObjetivo: 0, alimentar: false, _t };

  const near =
    !!data.perroCerca ||
    (data.distancia > 0 && data.distancia <= Number(device.near_distance_cm));

  // 3) Feed ya en curso?
  const { data: active } = await admin
    .from("servings")
    .select("id, grams_target, commanded_at")
    .eq("device_id", device.id)
    .eq("status", "commanded")
    .order("commanded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    const ageMs = now.getTime() - new Date(active.commanded_at).getTime();
    if (ageMs <= COMMAND_TIMEOUT_MS) {
      return { pesoObjetivo: active.grams_target, alimentar: true, _t, _near: near };
    }
    // Failsafe: el device nunca confirmo -> liberar.
    await admin.from("servings").update({ status: "failed" }).eq("id", active.id);
    await admin
      .from("device_state")
      .update({ feed_phase: "idle", active_serving_id: null })
      .eq("device_id", device.id);
  }

  // 4) Slot programado vencido (dentro de ventana) y aun no servido hoy.
  const { data: schedules } = await admin
    .from("feeding_schedules")
    .select("*")
    .eq("dog_id", device.dog_id)
    .eq("is_active", true)
    .order("feed_time");

  let chosen: {
    id: string;
    feed_time: string;
    grams_target: number;
    catch_up_window_minutes: number;
    days_of_week: number[];
  } | null = null;

  for (const s of schedules ?? []) {
    if (!Array.isArray(s.days_of_week) || !s.days_of_week.includes(dow)) continue;
    const start = hhmmToMinutes(s.feed_time);
    const end = start + (s.catch_up_window_minutes ?? 120);
    if (minutes < start || minutes >= end) continue;

    const { data: existing } = await admin
      .from("servings")
      .select("id")
      .eq("schedule_id", s.id)
      .eq("local_date", dateStr)
      .maybeSingle();
    if (existing) continue;

    chosen = s;
    break; // el mas temprano sin servir
  }

  // Próxima comida del día (la más temprana aún por llegar hoy).
  const _next =
    (schedules ?? [])
      .filter(
        (s) =>
          Array.isArray(s.days_of_week) &&
          s.days_of_week.includes(dow) &&
          hhmmToMinutes(s.feed_time) > minutes
      )
      .sort((a, b) => hhmmToMinutes(a.feed_time) - hhmmToMinutes(b.feed_time))[0]
      ?.feed_time?.slice(0, 5) ?? "ninguna";

  if (chosen && near) {
    // Reclamo atomico: el indice unico (schedule_id, local_date) evita doble servido.
    const { data: inserted, error } = await admin
      .from("servings")
      .insert({
        dog_id: device.dog_id,
        device_id: device.id,
        owner_id: device.owner_id,
        schedule_id: chosen.id,
        source: "scheduled",
        status: "commanded",
        grams_target: chosen.grams_target,
        local_date: dateStr,
      })
      .select("id")
      .single();

    if (!error && inserted) {
      await admin
        .from("device_state")
        .update({ feed_phase: "feeding", active_serving_id: inserted.id })
        .eq("device_id", device.id);
      return { pesoObjetivo: chosen.grams_target, alimentar: true, _t, _near: near, _next };
    }
    // Conflicto (otro latido lo tomo) -> no alimentar.
  }

  const pesoObjetivo = chosen?.grams_target ?? schedules?.[0]?.grams_target ?? 0;
  return { pesoObjetivo, alimentar: false, _t, _near: near, _next };
}

// El ESP32 termino de dispensar (peso objetivo o cierre manual) y reporta gramos.
export async function reportarResultado(
  apiKey: string,
  gramos: number
): Promise<{ ok: boolean } | null> {
  const admin = createAdminClient();
  const device = await findDevice(admin, apiKey);
  if (!device) return null; // 401

  const now = new Date().toISOString();

  // a) Cierra el serving programado/portado que estuviera en curso.
  const { data: active } = await admin
    .from("servings")
    .select("id")
    .eq("device_id", device.id)
    .eq("status", "commanded")
    .order("commanded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    await admin
      .from("servings")
      .update({ status: "served", grams_actual: gramos, served_at: now })
      .eq("id", active.id);
    await admin
      .from("device_state")
      .update({ feed_phase: "completed", active_serving_id: null, updated_at: now })
      .eq("device_id", device.id);
    return { ok: true };
  }

  // b) Cierre del servo manual -> registra la racion manual.
  const { data: st } = await admin
    .from("device_state")
    .select("manual_orden")
    .eq("device_id", device.id)
    .maybeSingle();

  if (st?.manual_orden && device.dog_id) {
    await admin.from("servings").insert({
      owner_id: device.owner_id,
      dog_id: device.dog_id,
      device_id: device.id,
      schedule_id: null,
      source: "manual",
      status: "served",
      grams_target: Math.round(gramos),
      grams_actual: gramos,
      local_date: localDateStr(new Date(), device.timezone),
      served_at: now,
    });
  }
  await admin
    .from("device_state")
    .update({
      manual_orden: null,
      feed_phase: "completed",
      active_serving_id: null,
      updated_at: now,
    })
    .eq("device_id", device.id);

  return { ok: true };
}
