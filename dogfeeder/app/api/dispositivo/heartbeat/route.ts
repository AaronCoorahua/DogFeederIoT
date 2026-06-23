import { NextRequest, NextResponse } from "next/server";

import { heartbeat } from "@/lib/feeding";

export const dynamic = "force-dynamic";

// El ESP32 reporta su estado y recibe si debe alimentar.
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") || "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const d = body as { perroCerca?: boolean; peso?: number; distancia?: number };
  const r = await heartbeat(apiKey, {
    perroCerca: !!d.perroCerca,
    peso: Number(d.peso ?? 0),
    distancia: Number(d.distancia ?? 0),
  });

  if (!r) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(r);
}
