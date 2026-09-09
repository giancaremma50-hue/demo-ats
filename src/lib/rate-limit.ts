import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Contador compartido en Postgres (`public.check_rate_limit` — vive en
 * `public`, no en `private`, porque PostgREST solo expone RPC de `public`;
 * `EXECUTE` revocado a `anon`/`authenticated`, solo `service_role` puede
 * llamarla) — reemplaza el Map en memoria que tenía este archivo. Ese Map
 * vivía por instancia de función: en Vercel, con varias instancias vivas a
 * la vez bajo carga real, cada una traía su propio contador en cero, así
 * que el límite de "5 por minuto" en la práctica no frenaba nada. La fila
 * en Postgres es una sola verdad para todas las instancias y regiones.
 */
export async function checkRateLimit(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): Promise<boolean> {
  const max = opts.max ?? 5;
  const windowSeconds = Math.ceil((opts.windowMs ?? 60_000) / 1000);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  // Si la función falla (ej. migración no aplicada todavía), no se abre la
  // puerta de par en par: se deja pasar la petición individual pero se deja
  // rastro — más seguro fallar "permitir" que "bloquear a todos por un typo
  // de despliegue", ya que Zod y el resto de las validaciones siguen de pie
  // detrás de esto de todos modos.
  if (error) {
    console.error("[rate-limit] check_rate_limit falló", { key, code: error.code, message: error.message });
    return true;
  }

  return data === true;
}
