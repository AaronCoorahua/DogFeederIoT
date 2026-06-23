import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

// GET /api/history?dogId=&from=&to=&status=  -> historial de raciones
export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  let dogId = sp.get("dogId");
  const from = sp.get("from");
  const to = sp.get("to");
  const status = sp.get("status");

  if (!dogId) {
    const { data: dog } = await supabase
      .from("dogs")
      .select("id")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    dogId = dog?.id ?? null;
  }
  if (!dogId) return NextResponse.json({ servings: [] });

  let query = supabase
    .from("servings")
    .select("*")
    .eq("owner_id", user.id)
    .eq("dog_id", dogId)
    .order("commanded_at", { ascending: false })
    .limit(500);

  if (from) query = query.gte("local_date", from);
  if (to) query = query.lte("local_date", to);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ servings: data });
}
