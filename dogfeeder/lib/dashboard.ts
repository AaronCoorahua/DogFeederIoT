import type { SupabaseClient } from "@supabase/supabase-js";

import { localParts, hhmmToMinutes } from "@/lib/time";
import type {
  EstadoPublico,
  Evento,
  ComidaHoy,
  SaludEstado,
  Fase,
} from "@/lib/types";

const ONLINE_MS = 12_000;
const COMPLETADO_MS = 6_000;
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Suma "YYYY-MM-DD" + offset dias usando mediodia UTC (evita bordes de zona).
function addDays(dateStr: string, delta: number): { dateStr: string; dow: number } {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return { dateStr: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
}

const EMPTY_DOG = { name: "Tu perro", photoUrl: null, pesoKg: null, edad: null };

// Construye el payload del dashboard para el usuario dado (cliente RLS).
export async function buildEstado(
  supabase: SupabaseClient,
  userId: string
): Promise<EstadoPublico> {
  const now = new Date();

  const { data: dog } = await supabase
    .from("dogs")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const tz = dog?.timezone || "America/Lima";
  const { dateStr: hoy, minutes: ahoraMin, dow } = localParts(now, tz);

  // Dispositivo + telemetria + horarios (en paralelo).
  const [{ data: device }, { data: schedules }] = await Promise.all([
    supabase
      .from("devices")
      .select(
        "id, dog_id, hopper_capacity_g, last_refill_g, last_refill_at, near_distance_cm, timezone"
      )
      .eq("owner_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    dog
      ? supabase
          .from("feeding_schedules")
          .select("*")
          .eq("dog_id", dog.id)
          .eq("is_active", true)
          .order("feed_time")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const [{ data: estadoDev }, { data: servings7 }, { data: pesos }] =
    await Promise.all([
      device
        ? supabase
            .from("device_state")
            .select("*")
            .eq("device_id", device.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      dog
        ? supabase
            .from("servings")
            .select("*")
            .eq("dog_id", dog.id)
            .gte("local_date", addDays(hoy, -6).dateStr)
            .order("commanded_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      dog
        ? supabase
            .from("weight_logs")
            .select("measured_on, weight_g")
            .eq("dog_id", dog.id)
            .gte("measured_on", addDays(hoy, -75).dateStr)
            .order("measured_on")
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const horarios = schedules ?? [];
  const recientes = servings7 ?? [];

  // ---- Online / telemetria ----
  const lastSeen = estadoDev?.last_seen
    ? new Date(estadoDev.last_seen).getTime()
    : 0;
  const online = lastSeen > 0 && now.getTime() - lastSeen < ONLINE_MS;
  const peso = num(estadoDev?.peso_g);
  const distancia = num(estadoDev?.distancia_cm);
  const perroCerca = online && !!estadoDev?.perro_cerca;

  // ---- Fase (derivada de los servings) ----
  const servoAbierto = estadoDev?.manual_orden === "abrir";
  const enCurso = recientes.find((s) => s.status === "commanded");
  const ultimoServido = recientes.find((s) => s.status === "served");
  let fase: Fase = "listo";
  if (enCurso || servoAbierto) fase = "alimentando";
  else if (
    ultimoServido?.served_at &&
    now.getTime() - new Date(ultimoServido.served_at).getTime() < COMPLETADO_MS
  )
    fase = "completado";

  const ultimaCantidad = num(ultimoServido?.grams_actual);
  const pesoObjetivo = num(
    enCurso?.grams_target ?? horarios[0]?.grams_target ?? 0
  );

  // ---- Hoy: gramos, raciones, adherencia ----
  const hoyServed = recientes.filter(
    (s) => s.local_date === hoy && s.status === "served"
  );
  const gramosHoy = Math.round(
    hoyServed.reduce((acc, s) => acc + num(s.grams_actual), 0)
  );
  const vecesHoy = hoyServed.length;
  const horariosHoy = horarios.filter((s) =>
    Array.isArray(s.days_of_week) ? s.days_of_week.includes(dow) : true
  );
  const objetivoHoy = horariosHoy.reduce((acc, s) => acc + num(s.grams_target), 0);
  const adhPct =
    objetivoHoy > 0 ? Math.round((gramosHoy / objetivoHoy) * 100) : 0;

  // ---- Comidas de hoy (servido / pendiente / saltado) ----
  const servedPorSlot = new Map<string, any>();
  recientes
    .filter((s) => s.local_date === hoy && s.schedule_id)
    .forEach((s) => servedPorSlot.set(s.schedule_id as string, s));

  const comidasHoy: ComidaHoy[] = horariosHoy
    .map((s) => {
      const start = hhmmToMinutes(s.feed_time);
      const fin = start + (s.catch_up_window_minutes ?? 120);
      const serv = servedPorSlot.get(s.id);
      let estado: ComidaHoy["estado"] = "pendiente";
      if (serv && serv.status === "served") estado = "servido";
      else if (ahoraMin >= fin) estado = "saltado";
      return {
        label: s.label,
        hora: String(s.feed_time).slice(0, 5),
        gramos:
          serv && serv.status === "served"
            ? Math.round(num(serv.grams_actual))
            : num(s.grams_target),
        estado,
      };
    })
    .sort((a, b) => hhmmToMinutes(a.hora) - hhmmToMinutes(b.hora));

  // ---- Proxima comida ----
  let nextFeed: EstadoPublico["nextFeed"] = null;
  const pendHoy = horariosHoy
    .filter((s) => hhmmToMinutes(s.feed_time) > ahoraMin && !servedPorSlot.has(s.id))
    .sort((a, b) => hhmmToMinutes(a.feed_time) - hhmmToMinutes(b.feed_time));
  if (pendHoy[0]) {
    nextFeed = {
      label: pendHoy[0].label,
      hora: String(pendHoy[0].feed_time).slice(0, 5),
      gramos: num(pendHoy[0].grams_target),
    };
  } else {
    const dowMan = addDays(hoy, 1).dow;
    const manana = horarios
      .filter((s) => (Array.isArray(s.days_of_week) ? s.days_of_week.includes(dowMan) : true))
      .sort((a, b) => hhmmToMinutes(a.feed_time) - hhmmToMinutes(b.feed_time));
    if (manana[0]) {
      nextFeed = {
        label: manana[0].label,
        hora: String(manana[0].feed_time).slice(0, 5),
        gramos: num(manana[0].grams_target),
      };
    }
  }

  // ---- Ultimos 7 dias (gramos servidos por dia) ----
  const sumaPorDia = new Map<string, number>();
  recientes
    .filter((s) => s.status === "served")
    .forEach((s) =>
      sumaPorDia.set(
        s.local_date,
        (sumaPorDia.get(s.local_date) ?? 0) + num(s.grams_actual)
      )
    );
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const { dateStr, dow: d } = addDays(hoy, i - 6);
    return { dia: DIAS[d], gramos: Math.round(sumaPorDia.get(dateStr) ?? 0) };
  });

  // ---- Nivel de tolva (capacidad - servido desde la ultima recarga) ----
  let nivelTolva = 100;
  if (dog && device?.hopper_capacity_g) {
    const desde = device.last_refill_at ?? new Date(0).toISOString();
    const { data: consumo } = await supabase
      .from("servings")
      .select("grams_actual")
      .eq("dog_id", dog.id)
      .eq("status", "served")
      .gte("served_at", desde);
    const consumido = (consumo ?? []).reduce(
      (acc, s) => acc + num(s.grams_actual),
      0
    );
    const base = num(device.last_refill_g) || num(device.hopper_capacity_g);
    const cap = num(device.hopper_capacity_g) || base || 1;
    nivelTolva = Math.max(
      0,
      Math.min(100, Math.round(((base - consumido) / cap) * 100))
    );
  }

  // ---- Serie de peso corporal ----
  const pesoSerie = (pesos ?? []).map((w) => ({
    fecha: w.measured_on,
    kg: Math.round((num(w.weight_g) / 1000) * 10) / 10,
  }));

  // ---- Actividad (ultimos eventos) ----
  const labelPorSlot = new Map<string, string | null>();
  horarios.forEach((s) => labelPorSlot.set(s.id, s.label));
  const eventos: Evento[] = recientes
    .filter((s) => s.status === "served" || s.status === "missed")
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      gramos: Math.round(num(s.grams_actual ?? s.grams_target)),
      origen: s.source,
      status: s.status,
      label:
        s.source === "manual"
          ? "Manual"
          : s.schedule_id
          ? labelPorSlot.get(s.schedule_id) ?? null
          : null,
      timestamp: s.served_at ?? s.commanded_at,
    }));

  // ---- Componentes ----
  const dist: SaludEstado = online ? (distancia >= 999 ? "warn" : "ok") : "offline";
  const ok: SaludEstado = online ? "ok" : "offline";
  const componentes = [
    { key: "esp32", nombre: "Controlador ESP32", estado: ok },
    { key: "wifi", nombre: "Conexión WiFi", estado: ok },
    { key: "peso", nombre: "Sensor de peso HX711", estado: ok },
    { key: "distancia", nombre: "Sensor ultrasónico HC-SR04", estado: dist },
    { key: "servo", nombre: "Servomotor compuerta", estado: ok },
  ];

  // ---- Foto firmada ----
  let photoUrl: string | null = null;
  if (dog?.photo_path) {
    const { data: signed } = await supabase.storage
      .from("dog-photos")
      .createSignedUrl(dog.photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  const edad =
    dog?.age_years != null
      ? num(dog.age_years)
      : dog?.birthdate
      ? Math.max(
          0,
          Math.round(
            ((now.getTime() - new Date(dog.birthdate).getTime()) /
              (365.25 * 864e5)) *
              10
          ) / 10
        )
      : null;

  return {
    online,
    perroCerca,
    peso,
    distancia,
    fase,
    servoAbierto,
    ultimaCantidad,
    pesoObjetivo,
    dog: dog
      ? {
          name: dog.name,
          photoUrl,
          pesoKg: dog.weight_g != null ? num(dog.weight_g) / 1000 : null,
          edad,
        }
      : EMPTY_DOG,
    nextFeed,
    adherencia: { servidoHoy: gramosHoy, objetivoHoy, pct: adhPct },
    metrics: { gramosHoy, vecesHoy, nivelTolva, ultimos7 },
    pesoSerie,
    comidasHoy,
    componentes,
    eventos,
  };
}
