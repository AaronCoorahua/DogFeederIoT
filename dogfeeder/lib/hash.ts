import { createHash } from "crypto";

// SHA-256 en hex. Se usa para guardar/buscar la API key del dispositivo
// sin almacenar nunca la clave cruda.
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
