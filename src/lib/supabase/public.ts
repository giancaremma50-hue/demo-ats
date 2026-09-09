import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente anónimo, sin cookies — para páginas públicas de solo lectura
 * (`/empleos`, `/empleos/[slug]`) que no necesitan sesión. El cliente de
 * `server.ts` llama `cookies()` para llevar la sesión del actor, y esa sola
 * llamada saca a la página del renderizado estático/ISR aunque tenga
 * `export const revalidate` — con tráfico de un portal público que cualquiera
 * puede visitar sin sesión, cada visita terminaba pegándole en vivo a
 * Postgres. RLS igual aplica (`jobs_select_public`, ya abierta a `anon`), así
 * que el alcance de datos es el mismo que ya veía cualquier visitante.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
