import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

// POST /api/hopper/refill -> { gramos }  marca que se recargo la tolva con N gramos.
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const gramos = Number(body?.gramos);
  if (!Number.isFinite(gramos) || gramos <= 0) {
    return NextResponse.json({ error: "Gramos inválido" }, { status: 400 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id, hopper_capacity_g")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!device) {
    return NextResponse.json({ error: "No hay dispositivo" }, { status: 400 });
  }

  const cap = Number(device.hopper_capacity_g) || Math.round(gramos);
  const newCap = gramos > cap ? Math.round(gramos) : cap; // si cargas mas, sube el tope

  const { error } = await supabase
    .from("devices")
    .update({
      last_refill_at: new Date().toISOString(),
      last_refill_g: Math.round(gramos),
      hopper_capacity_g: newCap,
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
