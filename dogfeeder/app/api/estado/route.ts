import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { buildEstado } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

// La web consulta el estado completo para pintar el dashboard.
export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const estado = await buildEstado(supabase, user.id);
  return NextResponse.json(estado);
}
