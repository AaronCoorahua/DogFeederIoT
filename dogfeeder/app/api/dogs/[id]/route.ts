import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/dogs/[id]
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("dogs")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ dog: data });
}

// PATCH /api/dogs/[id] -> actualiza campos del perro
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = [
    "name",
    "birthdate",
    "age_years",
    "weight_g",
    "photo_path",
    "breed",
    "timezone",
  ] as const;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in (body ?? {})) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("dogs")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ dog: data });
}

// DELETE /api/dogs/[id] -> baja logica
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await supabase
    .from("dogs")
    .update({ is_active: false })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
