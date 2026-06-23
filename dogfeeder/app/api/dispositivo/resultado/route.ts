import { NextRequest, NextResponse } from "next/server";
import { reportarResultado } from "@/lib/store";

export const dynamic = "force-dynamic";

const API_KEY = process.env.DEVICE_API_KEY || "cambia-esta-clave";

// El ESP32 reporta cuantos gramos sirvio al terminar.
export async function POST(req: NextRequest) {
  if (req.headers.get("x-api-key") !== API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const d = body as { gramos?: number };
  reportarResultado(Number(d.gramos ?? 0));

  return NextResponse.json({ ok: true });
}
