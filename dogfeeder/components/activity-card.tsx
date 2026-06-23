import { Bone } from "lucide-react";

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
            {eventos.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Bone className="size-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Sirvió{" "}
                      <span className="tabular-nums">
                        {Math.round(e.gramos)} g
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hora(e.timestamp)}
                    </p>
                  </div>
                </div>
                {e.origen === "demo" && (
                  <Badge variant="muted" className="text-[10px]">
                    demo
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
