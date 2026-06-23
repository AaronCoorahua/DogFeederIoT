"use client";

import { Dog, Bone, Loader2, CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { EstadoPublico } from "@/lib/types";

export function FeedCard({
  estado,
  enviando,
  onAlimentar,
}: {
  estado: EstadoPublico;
  enviando: boolean;
  onAlimentar: () => void;
}) {
  const { fase, perroCerca, peso, pesoObjetivo, ultimaCantidad, online } =
    estado;

  const pct =
    pesoObjetivo > 0 ? Math.min(100, (peso / pesoObjetivo) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      {/* Franja de presencia del perro */}
      <div
        className={
          "flex items-center justify-between px-4 py-3 transition-colors " +
          (perroCerca ? "bg-primary/15" : "bg-muted/40")
        }
      >
        <div className="flex items-center gap-2">
          {perroCerca ? (
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
          ) : (
            <span className="size-2.5 rounded-full bg-muted-foreground/50" />
          )}
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Dog className="size-4" aria-hidden />
            {perroCerca ? "Tu perro está cerca" : "Esperando al perro"}
          </span>
        </div>
        <Badge variant={online ? "success" : "muted"}>
          {online ? "En línea" : "Sin conexión"}
        </Badge>
      </div>

      <CardContent className="p-5" aria-live="polite">
        {fase === "listo" && (
          <Button
            size="xl"
            className="w-full shadow-lg shadow-primary/25"
            onClick={onAlimentar}
            disabled={enviando}
          >
            {enviando ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Bone />
                Alimentar ahora
              </>
            )}
          </Button>
        )}

        {fase === "alimentando" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-primary">
                <Loader2 className="size-4 animate-spin" />
                Alimentando…
              </span>
              <span className="tabular-nums text-muted-foreground">
                {online ? `${Math.round(peso)} / ${pesoObjetivo} g` : "Sirviendo"}
              </span>
            </div>
            <Progress value={!online ? null : pct} />
          </div>
        )}

        {fase === "completado" && (
          <div className="flex flex-col items-center gap-1 py-1 text-center">
            <CheckCircle2 className="size-9 text-[color:var(--success)]" />
            <p className="text-lg font-semibold">
              Sirvió{" "}
              <span className="tabular-nums">{Math.round(ultimaCantidad)} g</span>
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Reiniciando…
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
