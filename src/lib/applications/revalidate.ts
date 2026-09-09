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
 */
export async function revalidateApplication(applicationId: string, jobId?: string): Promise<void> {
  // La ruta vieja sigue existiendo como redirect para enlaces de correos y
  // notificaciones; se invalida igual, es gratis.
  revalidatePath(`/postulaciones/${applicationId}`);

  // La agenda y los contadores de Inicio se alimentan de las tareas y
  // entrevistas que estas mismas acciones tocan; sin esto quedaban desfasados
  // hasta la siguiente recarga completa.
  revalidatePath("/inicio");

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
