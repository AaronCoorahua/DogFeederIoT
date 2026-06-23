import { createClient } from "@/lib/supabase/server";

// Helper para rutas de usuario: devuelve el cliente RLS + el usuario (o null).
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
