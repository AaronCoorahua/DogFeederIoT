import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para server components y route handlers de usuario.
// Lee/escribe la sesion desde las cookies -> RLS aplica como ese usuario.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: lo refresca el middleware.
          }
        },
      },
    }
  );
}
