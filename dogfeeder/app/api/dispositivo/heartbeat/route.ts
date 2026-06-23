import { NextRequest, NextResponse } from "next/server";
import { heartbeat } from "@/lib/store";

export const dynamic = "force-dynamic";

const API_KEY = process.env.DEVICE_API_KEY || "cambia-esta-clave";

// El ESP32 reporta su estado y recibe si debe alimentar.
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

  const d = body as { perroCerca?: boolean; peso?: number; distancia?: number };
  const respuesta = heartbeat({
    perroCerca: !!d.perroCerca,
    peso: Number(d.peso ?? 0),
    distancia: Number(d.distancia ?? 0),
  });

  return NextResponse.json(respuesta);
}
