import { Bone, X } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Evento } from "@/lib/types";

function hora(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityCard({ eventos }: { eventos: Evento[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actividad</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {eventos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aún no hay raciones registradas
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {eventos.map((e) => {
              const saltada = e.status === "missed";
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "flex size-9 items-center justify-center rounded-lg " +
                        (saltada
                          ? "bg-warning/15 text-warning"
                          : "bg-primary/15 text-primary")
                      }
                    >
                      {saltada ? (
                        <X className="size-4" aria-hidden />
                      ) : (
                        <Bone className="size-4" aria-hidden />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {saltada ? (
                          "Se saltó la comida"
                        ) : (
                          <>
                            Sirvió{" "}
                            <span className="tabular-nums">{e.gramos} g</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.label ? `${e.label} · ` : ""}
                        {hora(e.timestamp)}
                      </p>
                    </div>
                  </div>
                  {e.origen === "manual" && (
                    <Badge variant="muted" className="text-[10px]">
                      manual
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
