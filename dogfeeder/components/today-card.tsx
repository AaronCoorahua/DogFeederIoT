import { Clock, Check, X } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EstadoPublico } from "@/lib/types";

export function TodayCard({ estado }: { estado: EstadoPublico }) {
  const { nextFeed, comidasHoy, adherencia } = estado;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Hoy</CardTitle>
        {adherencia.objetivoHoy > 0 && (
          <Badge variant={adherencia.pct >= 80 ? "success" : "warning"}>
            {adherencia.pct}% · {adherencia.servidoHoy}/{adherencia.objetivoHoy} g
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {nextFeed && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Próxima comida</p>
              <p className="text-sm font-medium">
                {nextFeed.hora}
                {nextFeed.label ? ` · ${nextFeed.label}` : ""} ·{" "}
                <span className="tabular-nums">{nextFeed.gramos} g</span>
              </p>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-1">
          {comidasHoy.map((c) => (
            <li
              key={c.hora + (c.label ?? "")}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-sm font-medium tabular-nums">
                  {c.hora}
                </span>
                <span className="text-sm text-muted-foreground">
                  {c.label ?? "Comida"} · {c.gramos} g
                </span>
              </div>
              {c.estado === "servido" ? (
                <Badge variant="success" className="gap-1">
                  <Check className="size-3" /> Servido
                </Badge>
              ) : c.estado === "saltado" ? (
                <Badge variant="warning" className="gap-1">
                  <X className="size-3" /> Saltada
                </Badge>
              ) : (
                <Badge variant="muted">Pendiente</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
