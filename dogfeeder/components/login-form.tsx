"use client";

import { useState } from "react";
import { Dog, Lock, Mail, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [cargando, setCargando] = useState(false);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !pass) return;
    setCargando(true);
    document.cookie = "df_auth=1; path=/; max-age=604800; samesite=lax";
    // Navegacion completa para que el server revalide la cookie.
    window.location.href = "/";
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Dog className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">DogFeeder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dispensador inteligente
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
            <CardDescription>Ingresa para ver tu dispensador</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={entrar} className="flex flex-col gap-4">
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
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </div>
              </div>

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
                    Entrar
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demo · usa cualquier correo y contraseña
        </p>
      </div>
    </main>
  );
}
