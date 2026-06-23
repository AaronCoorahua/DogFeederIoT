import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente service-role: SALTA RLS. Solo para rutas de dispositivo
// (/api/dispositivo/*) que se autentican con x-api-key, nunca en el cliente.
// "server-only" hace fallar el build si se importa desde un componente cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
