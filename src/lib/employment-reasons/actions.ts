"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmploymentReasonSchema } from "./schema";
import { zodFieldError } from "@/lib/forms/zod-error";

export type EmploymentReasonActionResult = { error?: string; id?: string; label?: string; field?: string };

/**
 * Alta inline desde el selector de "Motivo de la vacante" al crear una
 * vacante — a diferencia de rejection_reasons (admin-only), cualquier rol
 * que pueda crear una vacante puede agregar un motivo nuevo (RLS:
 * employment_reasons_insert). Es una lista operativa, no una política de
 * rechazo, y los 3 roles que existen pueden crear vacantes.
 */
export async function createEmploymentReason(
  _prevState: EmploymentReasonActionResult | undefined,
  formData: FormData,
): Promise<EmploymentReasonActionResult> {
  const profile = await requireProfile();
  const parsed = EmploymentReasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFieldError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employment_reasons")
    .insert({ organization_id: profile.organization_id, label: parsed.data.label })
    .select("id, label")
    .single();

  if (error || !data) {
    // 23505 es UNIQUE(label): el problema es lo que se escribió, así que el
    // mensaje va debajo de ESE campo. El resto no es culpa del texto y va al
    // toast, que es su canal (AGENTS.md, regla 12).
    return error?.code === "23505"
      ? { error: "Ese motivo ya existe.", field: "label" }
      : { error: "No se pudo agregar el motivo." };
  }

  revalidatePath("/vacantes/nueva");
  return { id: data.id, label: data.label };
}
