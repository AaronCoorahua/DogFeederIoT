import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

// GET /api/weights?dogId=&from=&to=  -> registros de peso (para la grafica)
export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const dogId = sp.get("dogId");
  const from = sp.get("from");
  const to = sp.get("to");

  let query = supabase
    .from("weight_logs")
    .select("*")
    .eq("owner_id", user.id)
    .order("measured_on");

  if (dogId) query = query.eq("dog_id", dogId);
  if (from) query = query.gte("measured_on", from);
  if (to) query = query.lte("measured_on", to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ weights: data });
}

// POST /api/weights -> { dogId, weight_g, measured_on?, note? }
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { dogId, weight_g, measured_on, note } = body ?? {};

  if (!dogId || !weight_g) {
    return NextResponse.json(
      { error: "Faltan datos (dogId, weight_g)" },
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

  // upsert por (dog_id, measured_on): un peso por dia.
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        owner_id: user.id,
        dog_id: dogId,
        weight_g: Number(weight_g),
        ...(measured_on ? { measured_on } : {}),
        note: note || null,
      },
      { onConflict: "dog_id,measured_on" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Actualiza el peso cacheado del perro.
  await supabase
    .from("dogs")
    .update({ weight_g: Number(weight_g), updated_at: new Date().toISOString() })
    .eq("id", dogId)
    .eq("owner_id", user.id);

  return NextResponse.json({ weight: data });
}
