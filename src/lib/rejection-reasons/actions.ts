"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { RejectionReasonSchema } from "./schema";
import { zodFieldError } from "@/lib/forms/zod-error";

export type RejectionReasonActionResult = { error?: string; success?: string; field?: string };

export async function createRejectionReason(
  _prevState: RejectionReasonActionResult | undefined,
  formData: FormData,
): Promise<RejectionReasonActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = RejectionReasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFieldError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rejection_reasons")
    .insert({ organization_id: profile.organization_id, label: parsed.data.label });
  if (error) {
    // 23505 es UNIQUE(label): el problema es lo que se escribió en el campo.
    return error.code === "23505"
      ? { error: "Ya existe ese motivo.", field: "label" }
      : { error: "No se pudo crear." };
  }

  revalidatePath("/configuracion/motivos-rechazo");
  return { success: "Motivo agregado" };
}

/**
 * Nunca se borra un motivo — solo se desactiva. Postulaciones ya
 * rechazadas con este motivo (rejection_reason_id) deben poder seguir
 * mostrándolo; is_active solo controla si aparece como opción nueva.
 */
export async function toggleRejectionReason(id: string, isActive: boolean): Promise<RejectionReasonActionResult> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("rejection_reasons").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "No se pudo actualizar." };

  revalidatePath("/configuracion/motivos-rechazo");
  return { success: isActive ? "Motivo activado" : "Motivo desactivado" };
}
