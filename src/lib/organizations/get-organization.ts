import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * organizations es de lectura pública (RLS using true), así que esto sirve
 * tanto para /login (sin sesión) como para el resto de la app. cache()
 * evita que layout.tsx, la página y componentes hijos repitan la misma
 * consulta dentro de la misma request.
 */
export const getOrganization = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", "principal")
    .single();
  return data;
});

/**
 * Misma consulta, pero con el cliente sin cookies (`createPublicClient`) —
 * exclusiva del portal público (`/empleos*`). `getOrganization()` llama
 * `cookies()`, y esa sola llamada saca a la página del renderizado
 * estático/ISR aunque tenga `export const revalidate`, incluso cuando la
 * usa el layout y no la página misma.
 */
export const getPublicOrganization = cache(async () => {
  const { data } = await createPublicClient()
    .from("organizations")
    .select("*")
    .eq("slug", "principal")
    .single();
  return data;
});
