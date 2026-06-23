import { NextResponse } from "next/server";
import { obtenerEstado } from "@/lib/store";

export const dynamic = "force-dynamic";

// La web consulta el estado completo para pintar el dashboard.
export async function GET() {
  return NextResponse.json(obtenerEstado());
}
