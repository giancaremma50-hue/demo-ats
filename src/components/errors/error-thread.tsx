"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { replyToErrorReport } from "@/lib/errors/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import type { ErrorReportMessageRow } from "@/lib/errors/get-error-reports";

export function ErrorThread({
  reportId,
  messages,
  currentProfileId,
}: {
  reportId: string;
  messages: ErrorReportMessageRow[];
  currentProfileId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = replyToErrorReport.bind(null, reportId);
  const [state, formAction] = useActionState(action, undefined);

  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const campo = campoSuelto(selectorDeError(state)("body"), `${uid}-body-error`);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div>
      <p className="mb-4 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Conversación</p>
      <div className="space-y-5">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay respuestas.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <Avatar name={m.author?.display_name ?? "?"} src={m.author?.avatar_url} size={32} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium">{m.author?.display_name ?? "Alguien"}</span>
                {m.author_id === currentProfileId && (
                  <span className="rounded-sm border border-accent px-1.5 py-0.5 text-[10px] text-accent">Tú</span>
                )}
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-6">
        {/* Card no reenvía ref (no usa forwardRef) — el form vive adentro,
            sin estilos propios, solo para que formRef.current?.reset() siga
            apuntando a un nodo real. */}
        <form ref={formRef} action={formAction}>
          {/* Etiqueta visible aunque sea corta: el placeholder se va con la
              primera letra y deja la caja sin nombre, que es justo cuando el
              mensaje de error de abajo se queda sin nada a qué referirse. */}
          <label htmlFor={`${uid}-body`} className="block px-3 pt-3 text-[11px] text-muted-foreground">
            Tu respuesta
          </label>
          <textarea
            id={`${uid}-body`}
            name="body"
            required
            minLength={1}
            maxLength={4000}
            rows={2}
            placeholder="Responde…"
            {...campo.props}
            className={cn(
              // `border-2 border-transparent` de base: la caja no tiene borde
              // propio —lo pone la `<Card>`—, así que sin esto el borde de 2px
              // del error no tendría dónde dibujarse. Transparente y del mismo
              // grosor mantiene el tamaño de caja idéntico en los dos estados,
              // que es lo que impide que el texto salte al fallar.
              // `-4px` y no `-2px`: con 2px de anillo a 2px hacia adentro, el
              // anillo se pinta EXACTAMENTE sobre la banda del borde de error, y
              // un outline va por encima de un borde — al entrar al campo para
              // corregirlo, el rojo se volvía verde. Es el fallo que la regla 12
              // existe para evitar, reintroducido por el borde que acabo de
              // agregar. A 4px el anillo queda por dentro del borde y conviven.
              "w-full resize-none border-2 border-transparent p-3 text-sm focus-visible:outline-offset-[-4px]",
              campo.enError && ERROR_CONTROL_CLASS,
            )}
          />
          {campo.idMensaje && (
            <div className="px-3 pb-2">
              <FieldError id={campo.idMensaje}>{campo.mensaje}</FieldError>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Se notifica dentro de la plataforma.</span>
            <ActionButton type="submit" variant="primary" className="h-8 px-4 text-xs" pendingLabel="Enviando…">
              Responder
            </ActionButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
