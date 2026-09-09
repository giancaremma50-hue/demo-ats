import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Invalida las rutas donde de verdad se ve una postulación.
 *
 * Antes cada acción llamaba `revalidatePath("/postulaciones/[id]")` a secas, y
 * esa página dejó de renderizar nada cuando el drawer pasó a ser la vista
 * principal: hoy es solo un `redirect()` al pipeline. O sea, se invalidaba una
 * ruta que no muestra datos, y el tablero —que sí los muestra— nunca se
 * enteraba. Eran 13 llamadas, todas al mismo destino equivocado.
 *
 * Ojo: esto arregla la caché del SERVIDOR. NO refresca el drawer, porque el
 * drawer guarda sus datos en estado local de cliente — eso se resuelve con los
 * callbacks `onSaved` / `onChanged` de los formularios, no desde acá.
 *
 * `jobId` se pasa siempre que el llamador ya lo tenga (casi todos lo tienen: lo
 * acaban de leer para chequear permisos). Sin él hay que ir a buscarlo, y esa
 * consulta extra por mutación no tiene sentido cuando el valor está en scope.
 *
 * `pipeline` (default `true`) — BUG REAL encontrado 2026-09-09: revalidar
 * `/vacantes/[id]/pipeline` mientras esa MISMA página está abierta con el
 * drawer del candidato desplegado encima cierra el drawer solo — esa ruta
 * tiene `pipeline/loading.tsx`, así que Next la envuelve en un Suspense
 * boundary, y una `revalidatePath` sobre la ruta activa puede volver a
 * suspenderla y remontar el árbol de cliente completo (KanbanBoard pierde su
 * `useState(openApplicationId)` y vuelve al valor inicial, que es `null`
 * salvo que la URL traiga `?candidato=`). Notas, tareas y mensajes no se
 * pintan en la tarjeta del kanban (`KanbanCard` solo muestra nombre y
 * rating) — revalidar esa ruta ahí no aporta nada y sí tiene este costo, así
 * que esas tres acciones pasan `pipeline: false`. Calificar, mover de etapa,
 * contratar/descartar/reabrir SÍ cambian lo que la tarjeta muestra, así que
 * esas siguen revalidando (y además ya cierran el drawer ellas mismas o son
 * arrastres del tablero, no una acción escrita DESDE dentro del drawer).
 */
export async function revalidateApplication(
  applicationId: string,
  jobId?: string,
  options?: { pipeline?: boolean },
): Promise<void> {
  // La ruta vieja sigue existiendo como redirect para enlaces de correos y
  // notificaciones; se invalida igual, es gratis.
  revalidatePath(`/postulaciones/${applicationId}`);

  // La agenda y los contadores de Inicio se alimentan de las tareas y
  // entrevistas que estas mismas acciones tocan; sin esto quedaban desfasados
  // hasta la siguiente recarga completa.
  revalidatePath("/inicio");

  if (options?.pipeline === false) return;

  let resolvedJobId = jobId;
  if (!resolvedJobId) {
    // Con el cliente de sesión a propósito: si este actor no puede ver la
    // postulación, tampoco hay una vista suya que valga invalidar.
    const supabase = await createClient();
    const { data } = await supabase
      .from("applications")
      .select("job_id")
      .eq("id", applicationId)
      .maybeSingle();
    resolvedJobId = data?.job_id ?? undefined;
  }
  if (resolvedJobId) revalidatePath(`/vacantes/${resolvedJobId}/pipeline`);
}
