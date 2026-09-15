"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createInvite } from "@/lib/users/invite-actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ASSIGNABLE_ROLES, DEFAULT_ROLE, ROLE_LABEL } from "@/lib/auth/role-labels";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useErrorToast } from "@/lib/forms/use-error-toast";
import { camposDeFila } from "@/lib/forms/field-signals";

/** Los campos que este formulario pinta. Uno del schema que no esté acá cae en
 *  el toast, que es lo correcto: no tendría dónde mostrarse. */
const CAMPOS = ["email", "role"] as const;

/**
 * Invitar por correo es la excepción al filtro de dominio corporativo (ver
 * auth/callback/route.ts): sirve para dar de alta a alguien que todavía no
 * tiene cuenta y cuyo correo no es del dominio permitido — el rol se le
 * asigna solo en cuanto entra la primera vez con Google.
 *
 * **No pasa por `<Field>`**: los dos controles y el botón van en una sola fila,
 * y `<Field>` apila etiqueta, control y mensaje en columna. El cableado va a
 * mano con las mismas piezas — y el mensaje va debajo de la FILA, no dentro de
 * la columna del correo: con `items-end`, un mensaje adentro empujaba el botón
 * "Invitar" hacia abajo y desalineaba la fila entera justo al fallar.
 */
export function InviteForm() {
  const [state, formAction] = useActionState(createInvite, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Un id propio por instancia: `email`/`role` a secas son de los nombres más
  // fáciles de chocar en una pantalla que monta más formularios.
  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const fila = camposDeFila(state, uid, CAMPOS);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {/* `flex-wrap` + un mínimo real en el correo: a 320px los tres controles
          en una línea empujaban el botón fuera de la pantalla, y `html` recorta
          el eje X sin barra — o sea, botón inalcanzable. */}
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <label htmlFor={`${uid}-email`} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Correo a invitar
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            required
            placeholder="nombre@correo.com"
            {...fila.props("email")}
            className={cn(
              "h-10 rounded-md border border-border bg-background px-3 text-sm",
              fila.es("email") && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-role`} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Rol
          </label>
          <select
            id={`${uid}-role`}
            name="role"
            defaultValue={DEFAULT_ROLE}
            {...fila.props("role")}
            className={cn(
              "h-10 rounded-md border border-border bg-background px-2 text-sm",
              fila.es("role") && ERROR_CONTROL_CLASS,
            )}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <ActionButton variant="secondary" className="h-10 shrink-0 px-4 text-xs">
          Invitar
        </ActionButton>
      </div>
      {/* Un solo mensaje: `zodFieldError` devuelve el primer issue, así que
          nunca hay dos campos en error a la vez. El id lo arma el campo que
          falló, que es al que apunta su `aria-describedby` — y es el mismo que
          `useErrorToast` busca para decidir si además hace falta el toast. */}
      {fila.idMensaje && <FieldError id={fila.idMensaje}>{fila.mensaje}</FieldError>}
    </form>
  );
}
