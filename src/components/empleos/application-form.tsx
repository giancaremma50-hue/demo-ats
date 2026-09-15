"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, Field, FieldError } from "@/components/ui/field";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import type { CandidacyFields } from "@/lib/job-templates/candidacy-fields";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/lib/jobs/upload-limits";

export type PublicQuestion = {
  id: string;
  prompt: string;
  type: string;
  job_question_options: { id: string; label: string }[];
};

/**
 * El mensaje general del formulario, junto al botón. **Se pinta solo cuando el
 * error no trae campo** — una condición que sale del propio estado, no de una
 * lista de qué campos están en pantalla. Si el error SÍ trae campo pero ese
 * campo está escondido por configuración (`candidacyFields`), no se pinta nada
 * acá y `useErrorToast` lo manda al toast, porque comprueba si el mensaje se ve
 * en vez de suponerlo. Así no hay ninguna lista que mantener a mano.
 */
const ID_MENSAJE_GENERAL = "postular-error";

/** Alto de los campos de texto, igual que el resto de los formularios. */
const CLASE_CAMPO = "h-11 w-full rounded-md border border-border bg-background px-3 text-sm";

export function ApplicationForm({
  jobId,
  candidacyFields,
  questions,
}: {
  jobId: string;
  candidacyFields: CandidacyFields;
  questions: PublicQuestion[];
}) {
  const [pending, setPending] = useState(false);
  /**
   * El error y su campo **en un solo estado**, no en dos. Dos `useState` dan
   * dos objetos independientes y cualquier efecto que mire "el fallo" tiene que
   * recomponerlo en cada render, así que se dispara de más; con un objeto, cada
   * `setFallo` es un fallo nuevo, incluso si el texto se repite — que es lo que
   * hace falta para volver a llevar al candidato al campo cuando reintenta y
   * vuelve a fallar igual.
   */
  const [fallo, setFallo] = useState<{ error: string; field?: string } | undefined>(undefined);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setFallo(undefined);

    const formData = new FormData(e.currentTarget);
    formData.set("job_id", jobId);

    // Chequeo del lado del cliente antes de mandar nada: Vercel corta
    // cualquier request de función en 4.5 MB a nivel de plataforma, con un
    // error crudo que no es JSON — mejor avisar acá, antes de subir, que
    // dejar que la plataforma responda con una página que el catch de abajo
    // solo puede traducir como "se perdió la conexión".
    const totalBytes = [...formData.values()].reduce(
      (sum, value) => sum + (value instanceof File ? value.size : 0),
      0,
    );
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setFallo({ error: "El CV y los archivos adicionales juntos pesan demasiado. Quita alguno e inténtalo de nuevo." });
      setPending(false);
      return;
    }

    try {
      const res = await fetch("/api/postular", { method: "POST", body: formData });

      // La respuesta puede no ser JSON: un 413 de la plataforma (payload
      // demasiado grande) llega como página de error de Vercel, no como el
      // cuerpo que arma esta ruta.
      const body: { error?: string; field?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        const fallback =
          res.status === 413
            ? "El CV o los archivos adicionales pesan demasiado para enviarse."
            : "No se pudo enviar tu postulación.";
        setFallo({ error: body.error ?? fallback, field: body.field });
        return;
      }
      notifySuccess("Postulación enviada");
      router.push("/empleos");
    } catch {
      setFallo({ error: "Se perdió la conexión. Tus datos no se enviaron — inténtalo de nuevo." });
    } finally {
      setPending(false);
    }
  }

  /** El texto del error, pero solo para el campo que lo causó. `<Field>` se
   *  encarga del resto: borde, `aria-invalid`, `aria-describedby` y el
   *  `role="alert"` del mensaje. El mismo selector que usan los formularios con
   *  `useActionState`, aunque acá el estado sea propio. */
  const errorDe = selectorDeError(fallo);

  // El tercer argumento es el id del mensaje general de abajo: el hook consulta
  // ese si el campo no pintó el suyo, y solo habla por toast cuando ninguno de
  // los dos está a la vista. Lo otro que hace acá es llevar al candidato hasta
  // el campo cuando el mensaje quedó arriba — en un teléfono, con el CV y las
  // preguntas de por medio, puede estar a varias pantallas del botón que acaba
  // de tocar, y ahí lo único que pasaría en pantalla es que el botón deja de
  // girar.
  useErrorToast(fallo, (campo) => `postular-${campo}-error`, ID_MENSAJE_GENERAL);

  /** Los dos controles que no pueden pasar por `<Field>` —un `<input type=file>`
   *  con su caja y una casilla cuyo texto ES su etiqueta— sacan sus cuatro
   *  señales del mismo helper, en vez de recalcularlas en cada atributo. */
  const cv = campoSuelto(errorDe("cv"), "postular-cv-error");
  const consentimiento = campoSuelto(errorDe("privacy_consent"), "postular-privacy_consent-error");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={pending}>
      {/* Etiqueta visible, no placeholder. Un placeholder desaparece apenas
          se escribe: el candidato deja de saber qué campo está llenando, y si
          el formulario le devuelve un error no tiene con qué ubicarlo. Es el
          único formulario que usa alguien de afuera, sin cuenta ni soporte. */}
      {candidacyFields.full_name !== "hidden" && (
        <Field
          id="postular-full_name"
          label={`Nombre completo${candidacyFields.full_name === "optional" ? " (opcional)" : ""}`}
          error={errorDe("full_name")}
        >
          <input name="full_name" required={candidacyFields.full_name === "required"} className={CLASE_CAMPO} />
        </Field>
      )}
      <Field id="postular-email" label="Correo" hint="Ahí te avisamos del proceso." error={errorDe("email")}>
        <input name="email" type="email" required className={CLASE_CAMPO} />
      </Field>
      {candidacyFields.phone !== "hidden" && (
        <Field
          id="postular-phone"
          label={`Teléfono${candidacyFields.phone === "optional" ? " (opcional)" : ""}`}
          error={errorDe("phone")}
        >
          <input name="phone" required={candidacyFields.phone === "required"} className={CLASE_CAMPO} />
        </Field>
      )}
      {candidacyFields.address !== "hidden" && (
        <Field
          id="postular-address"
          label={`Dirección${candidacyFields.address === "optional" ? " (opcional)" : ""}`}
          error={errorDe("address")}
        >
          <input name="address" required={candidacyFields.address === "required"} className={CLASE_CAMPO} />
        </Field>
      )}
      <Field id="postular-current_title" label="Puesto actual (opcional)" error={errorDe("current_title")}>
        <input name="current_title" className={CLASE_CAMPO} />
      </Field>

      {candidacyFields.resume !== "hidden" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2 text-sm text-muted-foreground">
            Currículum (PDF, máx. 4 MB){candidacyFields.resume === "optional" && " — opcional"}
            {/* El error va en una CAJA alrededor del input, no en el color del
                input: `text-destructive` no llega al `::file-selector-button`
                ni al "Sin archivos seleccionados" —los pinta el navegador en
                su shadow DOM—, así que el único campo del formulario que se
                puede rechazar por su contenido era también el único que no
                mostraba nada al rechazarse. Borde de 2px y fondo tenue, los
                mismos dos canales que `<Field>` le da al resto. */}
            <span
              className={cn(
                "block rounded-md border border-border bg-background p-2.5",
                cv.enError && ERROR_CONTROL_CLASS,
              )}
            >
              <input
                name="cv"
                type="file"
                accept="application/pdf"
                required={candidacyFields.resume === "required"}
                {...cv.props}
                className="w-full text-sm"
              />
            </span>
          </label>
          {/* FUERA del `<label>`: adentro, el texto del error pasa a ser parte
              del nombre accesible del control Y su descripción, así que un
              lector lo lee dos veces — la misma trampa que ya está anotada
              abajo para la casilla de privacidad. Y un `<p>` no es contenido
              válido dentro de un `<label>`. */}
          {cv.idMensaje && <FieldError id={cv.idMensaje}>{cv.mensaje}</FieldError>}
        </div>
      )}

      {candidacyFields.cover_letter !== "hidden" && (
        <Field
          id="postular-cover_letter"
          label={`Carta de motivación${candidacyFields.cover_letter === "optional" ? " (opcional)" : ""}`}
          error={errorDe("cover_letter")}
        >
          <textarea
            name="cover_letter"
            required={candidacyFields.cover_letter === "required"}
            rows={4}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      )}

      {candidacyFields.additional_files !== "hidden" && (
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Archivos adicionales (PDF, JPG o PNG, máx. 1 MB cada uno){candidacyFields.additional_files === "optional" && " — opcional"}
          <input
            name="additional_files"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            required={candidacyFields.additional_files === "required"}
            className="text-sm"
          />
        </label>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {questions.map((question) => (
            <label key={question.id} className="flex flex-col gap-2 text-sm">
              {question.prompt}
              {question.type === "multiple_choice" ? (
                <div className="flex flex-col gap-1.5">
                  {question.job_question_options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <input type="radio" name={`answer_${question.id}`} value={option.id} className="size-4" />
                      {option.label}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea name={`answer_${question.id}`} rows={2} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              )}
            </label>
          ))}
        </div>
      )}

      {/* Sin marcar por defecto y `required`: el navegador ya frena el envío,
          y /api/postular lo vuelve a exigir con Zod — quitar el atributo desde
          las herramientas del navegador no alcanza para saltarlo. */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="privacy_consent"
          required
          {...consentimiento.props}
          className="mt-0.5 size-4 flex-none"
        />
        {/* Sin aria-describedby: este span YA es la etiqueta de la casilla (va
            dentro del <label>), y apuntarlo también como descripción hace que
            un lector de pantalla lea la frase completa dos veces. */}
        <span className="text-foreground/90">
          He leído y acepto la{" "}
          <Link href="/privacidad" target="_blank" className="font-medium text-accent underline">
            política de privacidad y tratamiento de datos
          </Link>
          , y autorizo el uso de la información y los archivos que envío para evaluar mi candidatura.
        </span>
      </label>
      {/* FUERA del `<label>`: adentro pasaría a formar parte del NOMBRE de la
          casilla en vez de ser su descripción. Sin esto, marcar la casilla era
          el único campo del formulario cuyo rechazo no dejaba nada en pantalla
          — y es justo el que decide si se pueden guardar los datos. */}
      {consentimiento.idMensaje && (
        <FieldError id={consentimiento.idMensaje}>{consentimiento.mensaje}</FieldError>
      )}
      </div>

      {/* Solo el error que NO es de ningún campo. Si trae campo, el mensaje va
          debajo del campo —repetirlo acá manda al candidato a buscar dos
          veces— y si ese campo resultó estar escondido por configuración,
          `useErrorToast` lo manda al toast por su cuenta. Ver
          `ID_MENSAJE_GENERAL`. */}
      {fallo?.error && !fallo.field && <FieldError id={ID_MENSAJE_GENERAL}>{fallo.error}</FieldError>}

      <ActionButton pending={pending} pendingLabel="Enviando…" className="h-11 w-full">
        Enviar postulación
      </ActionButton>
    </form>
  );
}
