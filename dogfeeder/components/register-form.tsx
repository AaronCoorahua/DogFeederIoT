"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dog, Lock, Mail, Loader2, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email || pass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
    });

    if (error) {
      setError(
        error.message.includes("already")
          ? "Ese correo ya está registrado."
          : "No se pudo crear la cuenta."
      );
      setCargando(false);
      return;
    }

    // Acceso inmediato (sin verificar correo): hay sesion -> al onboarding.
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      router.replace("/login");
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Dog className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">DogFeeder</h1>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Crear cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={registrar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Correo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pass">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pass"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="pl-9"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-2 w-full"
                disabled={cargando || !email || !pass}
              >
                {cargando ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
