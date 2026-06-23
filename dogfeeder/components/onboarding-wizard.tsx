"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Dog,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Slot = { id: string; time: string; grams: string };

const TOTAL_STEPS = 3;

export function OnboardingWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [slots, setSlots] = useState<Slot[]>([
    { id: crypto.randomUUID(), time: "08:00", grams: "250" },
    { id: crypto.randomUUID(), time: "19:00", grams: "250" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  function addSlot() {
    setSlots((s) => [
      ...s,
      { id: crypto.randomUUID(), time: "12:00", grams: "200" },
    ]);
  }
  function removeSlot(id: string) {
    setSlots((s) => s.filter((x) => x.id !== id));
  }
  function updateSlot(id: string, patch: Partial<Slot>) {
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  const canNext1 = name.trim().length > 0;
  const canFinish =
    slots.length > 0 && slots.every((s) => s.time && Number(s.grams) > 0);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      let photo_path: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("dog-photos")
          .upload(path, photoFile, { upsert: true });
        if (!upErr) photo_path = path;
      }

      const weight_g = weightKg ? Math.round(Number(weightKg) * 1000) : null;
      const age_years = age ? Number(age) : null;

      const res = await fetch("/api/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), age_years, weight_g, photo_path }),
      });
      if (!res.ok) throw new Error("dog");
      const { dog } = await res.json();

      for (const s of slots) {
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dogId: dog.id,
            feed_time: s.time,
            grams_target: Number(s.grams),
          }),
        });
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Algo salió mal. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {/* Progreso */}
        <div className="mb-8 flex items-center gap-2">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="mr-1 text-muted-foreground"
              aria-label="Atrás"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <span className="mr-1 size-5" />
          )}
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 flex-1 rounded-full transition-colors " +
                (i < step ? "bg-primary" : "bg-muted")
              }
            />
          ))}
        </div>

        {/* Paso 1: nombre + foto */}
        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-bold tracking-tight">
              ¿Cómo se llama?
            </h1>

            <div className="mt-8 flex flex-col items-center gap-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex size-28 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-2 ring-border"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Foto"
                    className="size-full object-cover"
                  />
                ) : (
                  <Dog className="size-12" />
                )}
                <span className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                  <Camera className="size-4" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickPhoto}
              />

              <div className="w-full">
                <Label htmlFor="name" className="sr-only">
                  Nombre
                </Label>
                <Input
                  id="name"
                  autoFocus
                  placeholder="Nombre de tu perro"
                  className="h-12 text-center text-lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-auto pt-8">
              <Button
                size="lg"
                className="w-full"
                disabled={!canNext1}
                onClick={() => setStep(2)}
              >
                Continuar <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: edad + peso */}
        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-bold tracking-tight">Edad y peso</h1>

            <div className="mt-8 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="age">Edad (años)</Label>
                <Input
                  id="age"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="Ej. 3"
                  className="h-12"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder="Ej. 12.5"
                  className="h-12"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-auto pt-8">
              <Button size="lg" className="w-full" onClick={() => setStep(3)}>
                Continuar <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: horarios */}
        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-bold tracking-tight">
              Horarios de comida
            </h1>

            <div className="mt-6 flex flex-col gap-3">
              {slots.map((s) => (
                <div key={s.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Hora</Label>
                    <Input
                      type="time"
                      className="h-12"
                      value={s.time}
                      onChange={(e) => updateSlot(s.id, { time: e.target.value })}
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground">Gramos</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      className="h-12"
                      value={s.grams}
                      onChange={(e) =>
                        updateSlot(s.id, { grams: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground"
                    disabled={slots.length <= 1}
                    onClick={() => removeSlot(s.id)}
                    aria-label="Quitar"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="mt-1"
                onClick={addSlot}
              >
                <Plus /> Agregar horario
              </Button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="mt-auto pt-8">
              <Button
                size="lg"
                className="w-full"
                disabled={!canFinish || saving}
                onClick={finish}
              >
                {saving ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Listo <Check />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
