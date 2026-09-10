"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import { X, ArrowRight, CalendarPlus, NotebookPen, ListChecks, Mail } from "lucide-react";
import { getApplicationDrawerData, getCvViewUrl } from "@/lib/applications/actions";
import type { DrawerData } from "@/lib/applications/get-drawer-data";
import type { ApplicationEvent, KanbanStage } from "@/lib/applications/get-applications";
import { notifyError } from "@/lib/notifications/toast";
import { CandidateActionBar, type CandidateAction } from "./candidate-action-bar";
import { RejectDialog, type RejectDialogHandle } from "./reject-dialog";
import { HireButton } from "./hire-button";
import { RatingStars } from "./rating-stars";
import { NoteForm } from "./note-form";
import { NoteList } from "./note-list";
import { TaskForm } from "./task-form";
import { MessageForm } from "./message-form";
import { InterviewList } from "./interview-list";
import { ApplicationTimeline } from "./application-timeline";
import { MeetingScheduler } from "./meeting-scheduler";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "info" | "seguimiento" | "bitacora" | "actividad" | "mensajes";

/**
 * "Actividad" salió del fondo de Seguimientos a su propia pestaña (decisión del
 * usuario, 2026-09-09): mezclada ahí abajo obligaba a scrollear por todas las
 * notas para ver el registro de qué pasó, y son dos cosas distintas — una la
 * escribe el equipo, la otra la genera el sistema.
 *
 * Tareas y Mensajes dejaron de ser "paneles" que se abrían debajo de la
 * pestaña activa (decisión del usuario, 2026-09-09) — las burbujas de conteo
 * arriba del header quedaban de más al lado de una barra de pestañas que ya
 * decía lo mismo. Tareas además se fusionó DENTRO de Seguimientos (ver
 * NoteList): un solo contador de "actividad del equipo" en vez de dos.
 */
function buildTabs(data: DrawerData, messageCount: number): { key: Tab; label: string }[] {
  return [
    { key: "info", label: "Información" },
    { key: "seguimiento", label: `Seguimientos (${data.application.notes.length + data.application.tasks.length})` },
    { key: "bitacora", label: "Bitácora" },
    { key: "actividad", label: "Actividad" },
    { key: "mensajes", label: `Mensajes (${messageCount})` },
  ];
}
type Panel = null | "reunion";

export function CandidateDrawer({
  applicationId,
  onClose,
  jobTitle,
  stages,
  currentStageId,
  onStageChange,
  onDiscarded,
}: {
  applicationId: string | null;
  onClose: () => void;
  jobTitle: string;
  stages: KanbanStage[];
  currentStageId: string | null;
  onStageChange: (applicationId: string, fromStageId: string, toStageId: string) => void;
  onDiscarded: (applicationId: string) => void;
}) {
  // El caller (KanbanBoard) monta esta instancia con key={applicationId} —
  // cada candidato nuevo es un componente fresco, así que el estado local
  // (loading/tab/panel) arranca limpio solo, sin resetearlo a mano en un
  // efecto (evita setState síncrono dentro de un efecto, que dispara un
  // render en cascada extra).
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [panel, setPanel] = useState<Panel>(null);
  // Vive acá y no dentro de SeguimientoView: el botón "Asignar tarea" de la
  // barra de acciones (abajo del todo) necesita abrir el formulario aunque
  // el usuario YA esté en la pestaña Seguimientos — ahí setTab("seguimiento")
  // solo no cambia nada visible porque el tab no cambia de valor.
  const [mostrarTarea, setMostrarTarea] = useState(false);
  const rejectRef = useRef<RejectDialogHandle>(null);

  useEffect(() => {
    if (!applicationId) return;
    getApplicationDrawerData(applicationId)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        notifyError("No se pudo cargar la postulación. Cierra y vuelve a intentarlo.");
        setLoading(false);
      });
  }, [applicationId]);

  /**
   * Vuelve a leer todo el drawer. Es la pieza que faltaba: este componente
   * carga sus datos UNA vez (el useEffect de arriba) y los guarda en estado
   * local, así que nada de lo que se agrega desde dentro —nota, tarea— aparece
   * solo. `revalidatePath` no sirve para esto: invalida caché de servidor, no
   * toca este `useState`. MeetingScheduler ya lo hacía bien con `onScheduled`;
   * ahora lo comparten todos.
   */
  function refresh() {
    if (!applicationId) return;
    getApplicationDrawerData(applicationId).then(setData).catch(() => {
      notifyError("No se pudo actualizar la vista. Cierra y vuelve a abrir.");
    });
  }

  if (!applicationId) return null;

  const stageIndex = stages.findIndex((s) => s.id === currentStageId);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;

  const messageCount = data?.application.events.filter((e) => e.type === "correo_enviado").length ?? 0;

  function handleClose() {
    onClose();
  }

  function handleNextStage() {
    if (!applicationId || !currentStageId || !nextStage) return;
    onStageChange(applicationId, currentStageId, nextStage.id);
    handleClose();
  }

  function handleDecisionSuccess() {
    if (!applicationId) return;
    onDiscarded(applicationId);
    handleClose();
  }

  // Dos niveles, y los dos se exigen de verdad en el servidor (ver
  // lib/applications/permissions.ts y su espejo en SQL): decidir
  // (descartar, siguiente etapa, agendar, mensaje) = reclutador asignado o
  // RH; escribir (seguimientos, tareas, calificación) = eso más el
  // solicitante y los miembros de lectura y escritura. Un miembro de solo
  // lectura no debe ver formularios que el servidor va a rechazar.
  const canDecide = data?.canDecide ?? false;
  const canWrite = data?.canWrite ?? false;
  const actions: CandidateAction[] = [
    { key: "descartar", label: "Descartar candidato", icon: X, danger: true, onClick: () => rejectRef.current?.open(), hidden: !canDecide },
    {
      key: "siguiente",
      label: nextStage ? `Siguiente etapa: ${nextStage.name}` : "No hay siguiente etapa",
      icon: ArrowRight,
      onClick: handleNextStage,
      hidden: !canDecide || !nextStage,
    },
    { key: "reunion", label: "Agendar reunión", icon: CalendarPlus, onClick: () => setPanel("reunion"), hidden: !canDecide },
    { key: "seguimiento", label: "Seguimientos", icon: NotebookPen, onClick: () => setTab("seguimiento") },
    {
      key: "tarea",
      label: "Asignar tarea",
      icon: ListChecks,
      onClick: () => {
        setTab("seguimiento");
        setMostrarTarea(true);
      },
      hidden: !canWrite,
    },
    { key: "mensaje", label: "Mensaje por correo", icon: Mail, onClick: () => setTab("mensajes"), hidden: !canDecide },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/25" onClick={handleClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col bg-background">
        <div className="flex-none px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {loading || !data ? (
                <Skeleton className="h-8 w-56" />
              ) : (
                <>
                  <h2 className="font-serif truncate text-[26px]">{data.application.candidateName}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.application.stageName ?? "Etapa no disponible"} · {jobTitle}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={handleClose}
              className="flex size-[30px] flex-none items-center justify-center rounded-full bg-muted"
            >
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </div>

          {data && (
            // Las pestañas salen de un array con el conteo ya adentro del
            // label — antes había además una fila de burbujas arriba
            // repitiendo los mismos números, de más al lado de esta barra.
            <div className="mt-4 flex gap-5 border-b border-border">
              {buildTabs(data, messageCount).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`pb-2.5 text-[13px] ${tab === key ? "border-b-2 border-accent font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-32 pt-5">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">No se pudo cargar esta postulación.</p>
          ) : tab === "info" ? (
            <InfoView data={data} />
          ) : tab === "seguimiento" ? (
            <SeguimientoView
              data={data}
              applicationId={applicationId!}
              canWrite={canWrite}
              onChanged={refresh}
              mostrarTarea={mostrarTarea}
              onMostrarTareaChange={setMostrarTarea}
            />
          ) : tab === "actividad" ? (
            <ApplicationTimeline events={data.application.events} />
          ) : tab === "bitacora" ? (
            <BitacoraView
              events={data.application.events}
              stages={stages}
              isActive={data.application.status === "activa"}
            />
          ) : data.canDecide ? (
            <MessageForm
              applicationId={applicationId!}
              candidateEmail={data.application.candidateEmail}
              templates={data.messageTemplates}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Solo el reclutador asignado o RH pueden mandar mensajes.</p>
          )}

          {data && (
            <div className="mt-8 flex items-center gap-3 border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">Calificación:</span>
              {canWrite ? (
                <RatingStars applicationId={applicationId!} rating={data.application.rating} />
              ) : (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.application.rating ? data.application.rating + " / 5" : "Sin calificar"}
                </span>
              )}
              {data.application.status === "activa" && data.canDecide && (
                <HireButton applicationId={applicationId!} onSuccess={handleDecisionSuccess} />
              )}
            </div>
          )}
        </div>

        {data && <CandidateActionBar actions={actions} />}
      </div>

      {data && (
        <RejectDialog
          ref={rejectRef}
          applicationId={applicationId!}
          reasons={data.rejectionReasons}
          trigger={null}
          onSuccess={handleDecisionSuccess}
        />
      )}

      {data && panel === "reunion" && (
        <MeetingScheduler
          applicationId={applicationId!}
          candidateName={data.application.candidateName}
          candidateEmail={data.application.candidateEmail}
          assignable={data.assignable}
          onClose={() => setPanel(null)}
          onScheduled={() => {
            setPanel(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function InfoView({ data }: { data: DrawerData }) {
  const { application } = data;
  const [cvPending, startCv] = useTransition();

  function handleViewCv() {
    if (!application.cvFilePath) return;
    startCv(async () => {
      const { url } = await getCvViewUrl(application.cvFilePath!);
      if (!url) {
        notifyError("No se pudo generar el enlace del CV.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {application.status !== "activa" && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          Estado: <strong>{application.status}</strong>
          {application.rejectionReasonLabel && ` — ${application.rejectionReasonLabel}`}
        </p>
      )}

      <div>
        <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Contacto</p>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field k="Correo" v={application.candidateEmail} />
          <Field k="Teléfono" v={application.candidatePhone ?? "—"} />
          <Field k="Dirección" v={application.candidateAddress ?? "—"} />
          <div>
            <p className="text-[11px] text-muted-foreground">CV</p>
            {application.cvFilePath ? (
              <button type="button" onClick={handleViewCv} disabled={cvPending} className="mt-0.5 text-sm font-medium text-accent underline">
                {cvPending ? "Generando enlace…" : "Ver CV (enlace válido 60s)"}
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Sin CV adjunto</p>
            )}
          </div>
        </div>
      </div>

      {data.answers.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Respuestas de la postulación</p>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {data.answers.map((a) => (
              <Field key={a.questionId} k={a.prompt} v={a.answerText ?? a.selectedOptionLabel ?? "—"} />
            ))}
          </div>
        </div>
      )}

      {application.coverLetter && (
        <div>
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Carta de motivación</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{application.coverLetter}</p>
        </div>
      )}

      {data.additionalFiles.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Archivos adicionales</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {data.additionalFiles.map((f) => (
              <li key={f.id} className="text-muted-foreground">{f.fileName}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Entrevistas</p>
        <div className="mt-2">
          <InterviewList interviews={data.interviews} applicationId={application.id} jobTitle={jobTitleFallback(application)} />
        </div>
      </div>
    </div>
  );
}

function jobTitleFallback(application: DrawerData["application"]): string {
  return application.jobTitle ?? "";
}

function SeguimientoView({
  data,
  applicationId,
  canWrite,
  onChanged,
  mostrarTarea,
  onMostrarTareaChange,
}: {
  data: DrawerData;
  applicationId: string;
  canWrite: boolean;
  /** Recarga del drawer, ver `refresh()` en CandidateDrawer. */
  onChanged: () => void;
  /**
   * Vive en CandidateDrawer, no acá: el botón "Asignar tarea" de la barra de
   * acciones tiene que poder abrir este formulario aunque el usuario YA esté
   * en esta pestaña (donde cambiar de tab no dispara ningún re-render).
   */
  mostrarTarea: boolean;
  onMostrarTareaChange: (value: boolean) => void;
}) {
  // Sin columna de "Candidato" (correo/teléfono/etapa) — vivía repetida acá
  // Y en Información, decisión del usuario 2026-09-09: cada pestaña muestra
  // solo lo suyo, no un resumen que ya está un clic al lado.
  return (
    <div>
      {canWrite ? (
        <div className="flex flex-col gap-2.5">
          <NoteForm
            // Cuenta solo las notas RAÍZ, no el total. Con el total, una
            // respuesta en cualquier hilo cambiaba esta key y borraba el
            // borrador que el usuario tuviera escrito acá arriba.
            key={data.application.notes.filter((n) => !n.parentId).length}
            applicationId={applicationId}
            mentionable={data.mentionable}
            canMarkPrivate={data.isAdminOrAbove}
            onSaved={onChanged}
          />
          {mostrarTarea ? (
            <TaskForm
              applicationId={applicationId}
              assignable={data.assignable}
              onSaved={() => {
                onMostrarTareaChange(false);
                onChanged();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => onMostrarTareaChange(true)}
              className="self-start text-xs font-medium text-accent underline"
            >
              + Asignar tarea
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tu nivel en esta vacante es de solo lectura.</p>
      )}
      <div className="mt-4">
        <NoteList
          notes={data.application.notes}
          tasks={data.application.tasks}
          applicationId={applicationId}
          mentionable={data.mentionable}
          canWrite={canWrite}
          canMarkPrivate={data.isAdminOrAbove}
          onSaved={onChanged}
        />
      </div>
    </div>
  );
}

/**
 * Reconstruida en el cliente a partir de `application_events` — no hace
 * falta una tabla ni un query nuevo: "postulacion_creada" ya marca la
 * entrada a la primera etapa (siempre `stages[0]`, la postulación nunca
 * nace en otra) y cada "etapa_cambiada" ya trae `payload.to` (id de la
 * etapa nueva). La duración de cada etapa es la resta entre el evento que
 * entra y el siguiente — el tramo actual usa "ahora" y se marca "en curso".
 */
function BitacoraView({
  events,
  stages,
  isActive,
}: {
  events: ApplicationEvent[];
  stages: KanbanStage[];
  // Cuando la postulación ya no está activa (contratada/rechazada/retirada)
  // el último tramo no sigue corriendo — hireApplication() no inserta un
  // evento propio, así que no hay una marca de tiempo real de cierre para
  // calcular su duración. Mostrarla contra "ahora" (como si "en curso"
  // siguiera vigente) sería una cifra que crece sola y engaña al
  // reclutador; mejor no inventar una duración que no se puede sustentar.
  isActive: boolean;
}) {
  const stageName = (id: unknown) => stages.find((s) => s.id === id)?.name ?? "Etapa eliminada";

  // getApplicationDetail ya trae `events` ordenados por created_at
  // ascendente — filter() preserva ese orden, así que no hace falta
  // volver a ordenar acá.
  const movements = events.filter((e) => e.type === "postulacion_creada" || e.type === "etapa_cambiada");

  if (movements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin movimientos todavía — aparecerán aquí en cuanto muevas esta postulación de etapa en el pipeline.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {movements.map((e, i) => {
        const enteredStage = e.type === "postulacion_creada" ? (stages[0]?.name ?? "Postulado") : stageName(e.payload.to);
        const next = movements[i + 1];
        const isLastAndClosed = !next && !isActive;
        const start = new Date(e.createdAt);
        const end = next ? new Date(next.createdAt) : new Date();
        const duration = formatDistanceStrict(start, end, { locale: es });

        return (
          <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
            <p>
              Entró a <strong>{enteredStage}</strong>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {e.actorName ?? "Sistema"} · {start.toLocaleString("es")}
              {!isLastAndClosed && ` · ${duration} en esta etapa${!next ? " (en curso)" : ""}`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-border pb-2">
      <p className="text-[11px] text-muted-foreground">{k}</p>
      <p className="mt-0.5">{v}</p>
    </div>
  );
}
