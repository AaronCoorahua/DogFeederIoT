import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { sha256Hex } from "@/lib/hash";

// GET /api/dogs -> lista los perros del usuario
export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("dogs")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ dogs: data });
}

// POST /api/dogs -> crea un perro y auto-provisiona el dispositivo unico
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, birthdate, age_years, weight_g, photo_path, breed } = body ?? {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }

  const { data: dog, error } = await supabase
    .from("dogs")
    .insert({
      owner_id: user.id,
      name,
      birthdate: birthdate || null,
      age_years: age_years ?? null,
      weight_g: weight_g ?? null,
      photo_path: photo_path || null,
      breed: breed || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Peso inicial -> primer registro de la tendencia.
  if (weight_g) {
    await supabase
      .from("weight_logs")
      .insert({ owner_id: user.id, dog_id: dog.id, weight_g })
      .select()
      .maybeSingle();
  }

  // Auto-provisionar el dispositivo unico (best-effort, no rompe el alta).
  const rawKey = process.env.DEVICE_API_KEY;
  if (rawKey) {
    const apiKeyHash = sha256Hex(rawKey);
    const { data: existing } = await supabase
      .from("devices")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("devices")
        .update({ dog_id: dog.id })
        .eq("id", existing.id);
    } else {
      const { data: device } = await supabase
        .from("devices")
        .insert({ owner_id: user.id, dog_id: dog.id, api_key_hash: apiKeyHash })
        .select("id")
        .maybeSingle();
      if (device) {
        await supabase.from("device_state").insert({ device_id: device.id });
      }
    }
  }

  return NextResponse.json({ dog });
}
