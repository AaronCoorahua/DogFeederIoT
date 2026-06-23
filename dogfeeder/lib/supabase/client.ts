import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes de cliente ("use client"). Usa la anon key:
// la seguridad la da RLS (cada usuario solo ve sus filas).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
