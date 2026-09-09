import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";
import {
  getApplicationDetail,
  getAssignableProfiles,
  getMentionableProfiles,
  type ApplicationDetail,
  type AssignableProfile,
  type MentionableProfile,
} from "./get-applications";
import { getApplicationInterviews, type ApplicationInterview } from "@/lib/interviews/get-interviews";
import { getMessageTemplates, type MessageTemplate } from "@/lib/message-templates/get-message-templates";
import { getApplicationPermissions } from "./permissions";

type AppRole = Database["public"]["Enums"]["app_role"];

export type CandidacyAnswer = {
  questionId: string;
  prompt: string;
  type: string;
  answerText: string | null;
  selectedOptionLabel: string | null;
};

export type AdditionalFile = { id: string; fileName: string; filePath: string };

export type DrawerData = {
  application: ApplicationDetail;
  answers: CandidacyAnswer[];
  additionalFiles: AdditionalFile[];
  interviews: ApplicationInterview[];
  assignable: AssignableProfile[];
  /** A quién se puede mencionar en un seguimiento — incluye solo lectura, a diferencia de `assignable`. */
  mentionable: MentionableProfile[];
  /**
   * Si el actor es admin o superior. NO es lo mismo que `canDecide`, que
   * también es true para el reclutador asignado aunque sea gestor.
   *
   * Gobierna quién puede marcar una nota como PRIVADA. `notes_select` deja
   * leer una nota privada a admin+ **y a su propio autor**, así que si un
   * gestor pudiera crear una privada la vería él solo: un admin le
   * respondería, la respuesta heredaría `is_private`, y el gestor no vería esa
   * respuesta nunca — se quedaría hablando solo sin saberlo. Restringir la
   * creación a admin+ hace que "privada = solo admins" sea verdad de verdad.
   */
  isAdminOrAbove: boolean;
  rejectionReasons: { id: string; label: string }[];
  messageTemplates: MessageTemplate[];
  /** Descartar/Siguiente etapa/Agendar reunión/Mensaje exigen el mismo nivel — Tareas y Seguimientos no. */
  canDecide: boolean;
  canWrite: boolean;
};

/**
 * Todo lo que el drawer de candidato necesita, en una sola llamada — se pide
 * una vez al abrir el drawer, no una consulta separada por cada botón de la
 * barra flotante. `role`/`profileId`/`organizationId` vienen del actor ya
 * resuelto por el caller (Server Action), no se vuelven a pedir acá.
 */
export async function getDrawerData(
  applicationId: string,
  actor: { id: string; role: AppRole; organizationId: string },
): Promise<DrawerData | null> {
  const application = await getApplicationDetail(applicationId);
  if (!application) return null;

  const supabase = await createClient();
  const [
    { data: answerRows },
    { data: fileRows },
    interviews,
    assignable,
    mentionable,
    { data: reasons },
    messageTemplates,
    permissions,
  ] = await Promise.all([
      supabase
        .from("application_answers")
        .select("job_question_id, answer_text, selected_option_id, job_questions(prompt, type)")
        .eq("application_id", applicationId),
      supabase
        .from("attachments")
        .select("id, file_name, file_path")
        .eq("application_id", applicationId)
        .eq("kind", "adicional"),
      getApplicationInterviews(applicationId),
      getAssignableProfiles(application.jobId, actor.organizationId),
      getMentionableProfiles(application.jobId, actor.organizationId),
      supabase.from("rejection_reasons").select("id, label").eq("is_active", true),
      getMessageTemplates(actor.organizationId).catch(() => []),
      getApplicationPermissions(actor.role, actor.id, application.jobId),
    ]);

  // job_question_options no viene embebido en la consulta de arriba (esa
  // solo trae job_questions) — se resuelve con una segunda consulta acotada
  // a las opciones realmente seleccionadas, no todas las de la vacante.
  const optionLabelById = new Map<string, string>();
  const selectedOptionIds = (answerRows ?? []).map((r) => r.selected_option_id).filter((id): id is string => Boolean(id));
  if (selectedOptionIds.length > 0) {
    const { data: options } = await supabase.from("job_question_options").select("id, label").in("id", selectedOptionIds);
    for (const o of options ?? []) optionLabelById.set(o.id, o.label);
  }

  const answers: CandidacyAnswer[] = (answerRows ?? []).map((r) => ({
    questionId: r.job_question_id,
    prompt: r.job_questions?.prompt ?? "Pregunta eliminada",
    type: r.job_questions?.type ?? "open",
    answerText: r.answer_text,
    selectedOptionLabel: r.selected_option_id ? (optionLabelById.get(r.selected_option_id) ?? null) : null,
  }));

  return {
    application,
    answers,
    additionalFiles: (fileRows ?? []).map((f) => ({ id: f.id, fileName: f.file_name, filePath: f.file_path })),
    interviews,
    assignable,
    mentionable,
    isAdminOrAbove: ADMIN_ROLES.has(actor.role),
    rejectionReasons: reasons ?? [],
    messageTemplates,
    canDecide: permissions.canDecide,
    canWrite: permissions.canWrite,
  };
}
