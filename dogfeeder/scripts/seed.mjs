// Inyecta datos de demo (~2.5 meses) en Supabase usando la service-role key.
// Uso:  node scripts/seed.mjs   (desde la carpeta dogfeeder)
//
// Crea/recrea: usuario demo, 1 perro con foto de internet, 1 dispositivo,
// 3 horarios y ~70 dias de raciones (con algunas saltadas y manuales) +
// pesajes semanales. Es idempotente: borra los datos previos del usuario demo.

import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---- env ----
function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}
// .env.local tiene prioridad sobre .env (igual que Next.js)
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEVICE_KEY = env.DEVICE_API_KEY || process.env.DEVICE_API_KEY || "123456789";
if (!URL || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EMAIL = "demo@dogfeeder.app";
const PASSWORD = "demo1234";
const TZ_OFFSET_H = 5; // America/Lima = UTC-5

// ---- helpers de fecha (Lima) ----
function limaNow() {
  const t = new Date(Date.now() - TZ_OFFSET_H * 3600e3);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
function dayParts(daysAgo) {
  const dt = new Date(Date.UTC(2000, 0, 1, 12)); // base
  const n = limaNow();
  dt.setUTCFullYear(n.y, n.m, n.d);
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() };
}
const pad = (n) => String(n).padStart(2, "0");
const dateStr = (p) => `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
// instante UTC para una hora local (hh:mm) en un dia local dado
function atLocal(p, hh, mm) {
  return new Date(Date.UTC(p.y, p.m, p.d, hh, mm, 0) + TZ_OFFSET_H * 3600e3);
}
const rnd = (a, b) => a + Math.random() * (b - a);

async function main() {
  // 1) Usuario demo (o reutilizar si ya existe)
  let userId;
  const created = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users?.find((u) => u.email === EMAIL);
    if (!found) throw created.error;
    userId = found.id;
    await supabase.auth.admin.updateUserById(userId, { password: PASSWORD });
  } else {
    userId = created.data.user.id;
  }
  console.log("Usuario demo:", userId);

  // asegurar perfil (por si el trigger no existiera)
  await supabase.from("profiles").upsert({ id: userId, email: EMAIL }, { onConflict: "id" });

  // 2) Limpiar datos previos del usuario demo
  await supabase.from("servings").delete().eq("owner_id", userId);
  await supabase.from("weight_logs").delete().eq("owner_id", userId);
  await supabase.from("feeding_schedules").delete().eq("owner_id", userId);
  await supabase.from("devices").delete().eq("owner_id", userId);
  await supabase.from("dogs").delete().eq("owner_id", userId);

  // 3) Foto de internet -> bucket dog-photos
  let photo_path = null;
  try {
    const r = await fetch("https://dog.ceo/api/breeds/image/random");
    const j = await r.json();
    const imgUrl = j?.message;
    if (imgUrl) {
      const img = await fetch(imgUrl);
      const buf = Buffer.from(await img.arrayBuffer());
      const ext = imgUrl.split(".").pop()?.split("?")[0] || "jpg";
      const path = `${userId}/${randomUUID()}.${ext}`;
      const up = await supabase.storage.from("dog-photos").upload(path, buf, {
        contentType: img.headers.get("content-type") || "image/jpeg",
        upsert: true,
      });
      if (!up.error) photo_path = path;
    }
  } catch (e) {
    console.warn("No se pudo descargar la foto:", e?.message);
  }
  console.log("Foto:", photo_path ?? "(sin foto)");

  // 4) Perro
  const { data: dog, error: dogErr } = await supabase
    .from("dogs")
    .insert({
      owner_id: userId,
      name: "Rocky",
      breed: "Labrador",
      age_years: 3,
      weight_g: 12700,
      photo_path,
    })
    .select()
    .single();
  if (dogErr) throw dogErr;

  // 5) Dispositivo (puente con DEVICE_API_KEY) + estado vivo
  const api_key_hash = createHash("sha256").update(DEVICE_KEY).digest("hex");
  const lastRefill = atLocal(dayParts(3), 9, 0).toISOString(); // recarga hace 3 dias
  const { data: device, error: devErr } = await supabase
    .from("devices")
    .insert({
      owner_id: userId,
      dog_id: dog.id,
      name: "Dispensador de Rocky",
      api_key_hash,
      near_distance_cm: 20,
      hopper_capacity_g: 4000,
      last_refill_g: 4000,
      last_refill_at: lastRefill,
    })
    .select()
    .single();
  if (devErr) throw devErr;

  await supabase.from("device_state").upsert(
    {
      device_id: device.id,
      perro_cerca: true,
      peso_g: 38,
      distancia_cm: 14,
      last_seen: new Date().toISOString(),
      feed_phase: "idle",
    },
    { onConflict: "device_id" }
  );

  // 6) Horarios
  const slots = [
    { label: "Desayuno", feed_time: "08:00", grams_target: 250 },
    { label: "Almuerzo", feed_time: "13:00", grams_target: 200 },
    { label: "Cena", feed_time: "19:00", grams_target: 250 },
  ];
  const { data: schedules, error: schErr } = await supabase
    .from("feeding_schedules")
    .insert(
      slots.map((s) => ({
        owner_id: userId,
        dog_id: dog.id,
        label: s.label,
        feed_time: s.feed_time,
        grams_target: s.grams_target,
      }))
    )
    .select();
  if (schErr) throw schErr;

  // 7) Raciones ~70 dias
  const DAYS = 70;
  const now = limaNow();
  const servings = [];
  let nServed = 0,
    nMissed = 0,
    nManual = 0;

  for (let i = DAYS; i >= 0; i--) {
    const p = dayParts(i);
    for (const s of schedules) {
      const [hh, mm] = s.feed_time.split(":").map(Number);
      const slotMin = hh * 60 + mm;
      // hoy: solo los slots cuya hora ya paso
      if (i === 0 && slotMin > now.min) continue;

      const missed = Math.random() < 0.06;
      if (missed) {
        servings.push({
          owner_id: userId,
          dog_id: dog.id,
          device_id: device.id,
          schedule_id: s.id,
          source: "scheduled",
          status: "missed",
          grams_target: s.grams_target,
          grams_actual: null,
          local_date: dateStr(p),
          commanded_at: atLocal(p, hh, mm).toISOString(),
          served_at: null,
        });
        nMissed++;
      } else {
        const delay = Math.floor(rnd(1, 14)); // tardo unos minutos en acercarse
        const served = atLocal(p, hh, mm + delay);
        servings.push({
          owner_id: userId,
          dog_id: dog.id,
          device_id: device.id,
          schedule_id: s.id,
          source: "scheduled",
          status: "served",
          grams_target: s.grams_target,
          grams_actual: Math.max(1, Math.round(s.grams_target + rnd(-18, 12))),
          local_date: dateStr(p),
          commanded_at: atLocal(p, hh, mm).toISOString(),
          served_at: served.toISOString(),
        });
        nServed++;
      }
    }
    // racion manual ocasional (premio)
    if (i > 0 && Math.random() < 0.15) {
      const hh = Math.floor(rnd(15, 17));
      const mm = Math.floor(rnd(0, 59));
      const t = atLocal(p, hh, mm);
      const g = Math.round(rnd(60, 140));
      servings.push({
        owner_id: userId,
        dog_id: dog.id,
        device_id: device.id,
        schedule_id: null,
        source: "manual",
        status: "served",
        grams_target: g,
        grams_actual: g,
        local_date: dateStr(p),
        commanded_at: t.toISOString(),
        served_at: t.toISOString(),
      });
      nManual++;
    }
  }

  // insertar por lotes
  for (let i = 0; i < servings.length; i += 500) {
    const chunk = servings.slice(i, i + 500);
    const { error } = await supabase.from("servings").insert(chunk);
    if (error) throw error;
  }

  // 8) Pesajes semanales (tendencia ligera)
  const weights = [];
  let kg = 12.9;
  for (let w = 10; w >= 0; w--) {
    const p = dayParts(w * 7);
    kg = Math.max(11.5, kg - rnd(-0.15, 0.22)); // baja suave con ruido
    weights.push({
      owner_id: userId,
      dog_id: dog.id,
      weight_g: Math.round(kg * 1000),
      measured_on: dateStr(p),
    });
  }
  await supabase.from("weight_logs").insert(weights);
  // peso actual del perro = ultimo pesaje
  await supabase
    .from("dogs")
    .update({ weight_g: weights[weights.length - 1].weight_g })
    .eq("id", dog.id);

  console.log("\n✅ Seed completo");
  console.log(`   Perro: ${dog.name}`);
  console.log(`   Raciones: ${nServed} servidas, ${nMissed} saltadas, ${nManual} manuales`);
  console.log(`   Pesajes: ${weights.length}`);
  console.log(`\n   Entra con:  ${EMAIL}  /  ${PASSWORD}\n`);
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
