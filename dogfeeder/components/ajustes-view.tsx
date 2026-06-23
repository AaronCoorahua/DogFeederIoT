"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Loader2,
  Scale,
  Container,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Sched = {
  id: string;
  feed_time: string;
  grams_target: number;
  label: string | null;
};

export function AjustesView() {
  const [dogId, setDogId] = useState<string | null>(null);
  const [pesoActual, setPesoActual] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Sched[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevoTime, setNuevoTime] = useState("12:00");
  const [nuevoGr, setNuevoGr] = useState("200");

  const [pesoKg, setPesoKg] = useState("");
  const [pesoMsg, setPesoMsg] = useState<string | null>(null);

  const [tolvaGr, setTolvaGr] = useState("");
  const [tolvaMsg, setTolvaMsg] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const d = await fetch("/api/dogs").then((r) => r.json());
      const dog = d?.dogs?.[0];
      if (!dog) {
        setCargando(false);
        return;
      }
      setDogId(dog.id);
      setPesoActual(dog.weight_g ? dog.weight_g / 1000 : null);
      const s = await fetch(`/api/schedules?dogId=${dog.id}`).then((r) =>
        r.json()
      );
      setSchedules(
        (s?.schedules ?? []).map((x: Sched) => ({
          id: x.id,
          feed_time: String(x.feed_time).slice(0, 5),
          grams_target: x.grams_target,
          label: x.label,
        }))
      );
    } catch {
      /* ignore */
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function setRow(id: string, patch: Partial<Sched>) {
    setSchedules((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function guardarRow(row: Sched) {
    setBusy(true);
    try {
      await fetch(`/api/schedules/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_time: row.feed_time,
          grams_target: Number(row.grams_target),
        }),
      });
      await cargar();
    } finally {
      setBusy(false);
    }
  }

  async function borrarRow(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      await cargar();
    } finally {
      setBusy(false);
    }
  }

  async function agregar() {
    if (!dogId) return;
    setBusy(true);
    try {
      await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogId,
          feed_time: nuevoTime,
          grams_target: Number(nuevoGr),
        }),
      });
      await cargar();
    } finally {
      setBusy(false);
    }
  }

  async function guardarPeso() {
    if (!dogId || !pesoKg) return;
    setBusy(true);
    setPesoMsg(null);
    try {
      await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogId, weight_g: Math.round(Number(pesoKg) * 1000) }),
      });
      setPesoKg("");
      setPesoMsg("Peso guardado ✓");
      await cargar();
    } finally {
      setBusy(false);
    }
  }

  async function recargar() {
    if (!tolvaGr) return;
    setBusy(true);
    setTolvaMsg(null);
    try {
      const res = await fetch("/api/hopper/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gramos: Number(tolvaGr) }),
      });
      setTolvaMsg(res.ok ? "Tolva actualizada ✓" : "No se pudo guardar");
      if (res.ok) setTolvaGr("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          aria-label="Volver"
          className="inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-lg font-bold tracking-tight">Ajustes</span>
      </header>

      {cargando ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <main className="flex flex-col gap-4 p-4">
          {/* Horarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Horarios de comida</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {schedules.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">
                  Sin horarios. Agrega uno abajo.
                </p>
              )}
              {schedules.map((s) => (
                <div key={s.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">
                      {s.label ?? "Hora"}
                    </Label>
                    <Input
                      type="time"
                      className="h-11"
                      value={s.feed_time}
                      onChange={(e) => setRow(s.id, { feed_time: e.target.value })}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs text-muted-foreground">g</Label>
                    <Input
                      type="number"
                      min="1"
                      className="h-11"
                      value={s.grams_target}
                      onChange={(e) =>
                        setRow(s.id, { grams_target: Number(e.target.value) })
                      }
                    />
                  </div>
                  <Button
                    size="icon-lg"
                    variant="outline"
                    aria-label="Guardar"
                    disabled={busy}
                    onClick={() => guardarRow(s)}
                  >
                    <Check />
                  </Button>
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    className="text-muted-foreground"
                    aria-label="Borrar"
                    disabled={busy}
                    onClick={() => borrarRow(s.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}

              <div className="mt-2 flex items-end gap-2 border-t border-border/60 pt-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    Nuevo horario
                  </Label>
                  <Input
                    type="time"
                    className="h-11"
                    value={nuevoTime}
                    onChange={(e) => setNuevoTime(e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">g</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-11"
                    value={nuevoGr}
                    onChange={(e) => setNuevoGr(e.target.value)}
                  />
                </div>
                <Button
                  size="icon-lg"
                  aria-label="Agregar"
                  disabled={busy}
                  onClick={agregar}
                >
                  <Plus />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Peso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="size-4" /> Registrar peso
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {pesoActual != null && (
                <p className="text-sm text-muted-foreground">
                  Actual: <span className="font-medium">{pesoActual} kg</span>
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="peso" className="text-xs text-muted-foreground">
                    Peso (kg)
                  </Label>
                  <Input
                    id="peso"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Ej. 12.4"
                    className="h-11"
                    value={pesoKg}
                    onChange={(e) => setPesoKg(e.target.value)}
                  />
                </div>
                <Button disabled={busy || !pesoKg} onClick={guardarPeso} className="h-11">
                  Guardar
                </Button>
              </div>
              {pesoMsg && <p className="text-sm text-success">{pesoMsg}</p>}
            </CardContent>
          </Card>

          {/* Tolva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Container className="size-4" /> Recargar tolva
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-sm text-muted-foreground">
                ¿Cuántos gramos de comida cargaste?
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="tolva" className="text-xs text-muted-foreground">
                    Gramos
                  </Label>
                  <Input
                    id="tolva"
                    type="number"
                    min="1"
                    placeholder="Ej. 2000"
                    className="h-11"
                    value={tolvaGr}
                    onChange={(e) => setTolvaGr(e.target.value)}
                  />
                </div>
                <Button disabled={busy || !tolvaGr} onClick={recargar} className="h-11">
                  Recargué
                </Button>
              </div>
              {tolvaMsg && <p className="text-sm text-success">{tolvaMsg}</p>}
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  );
}
