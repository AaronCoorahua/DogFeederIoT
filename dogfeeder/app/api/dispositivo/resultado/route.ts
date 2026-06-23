import { NextRequest, NextResponse } from "next/server";

import { reportarResultado } from "@/lib/feeding";

export const dynamic = "force-dynamic";

// El ESP32 reporta cuantos gramos sirvio al terminar.
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") || "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const d = body as { gramos?: number };
  const r = await reportarResultado(apiKey, Number(d.gramos ?? 0));

  if (!r) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(r);
}
