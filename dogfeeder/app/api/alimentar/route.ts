import { NextResponse } from "next/server";
import { pedirAlimentar } from "@/lib/store";

export const dynamic = "force-dynamic";

// El usuario pulsa "Alimentar" desde la web.
export async function POST() {
  const r = pedirAlimentar();
  if (!r.ok) {
    return NextResponse.json({ error: r.motivo }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
