import { NextRequest, NextResponse } from "next/server";
import { agregarEvento, obtenerEventos, estadoActual } from "@/lib/store";

// Sin cache: siempre datos frescos.
export const dynamic = "force-dynamic";

const API_KEY = process.env.DEVICE_API_KEY || "cambia-esta-clave";

// El ESP32 envia los eventos aqui (POST).
export async function POST(req: NextRequest) {
  // Verificacion de clave compartida
  const key = req.headers.get("x-api-key");
  if (key !== API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const data = body as { tipo?: string; peso?: number; distancia?: number };

  if (data.tipo !== "abierto" && data.tipo !== "cerrado") {
    return NextResponse.json(
      { error: "El campo 'tipo' debe ser 'abierto' o 'cerrado'" },
      { status: 400 }
    );
  }

  const evento = agregarEvento({
    tipo: data.tipo,
    peso: Number(data.peso ?? 0),
    distancia: Number(data.distancia ?? 0),
  });

  return NextResponse.json({ ok: true, evento });
}

// La pagina web lee el estado y el historial desde aqui (GET).
export async function GET() {
  return NextResponse.json({
    ...estadoActual(),
    eventos: obtenerEventos(),
  });
}
