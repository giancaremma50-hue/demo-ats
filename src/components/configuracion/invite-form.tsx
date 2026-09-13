"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvite } from "@/lib/users/invite-actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ASSIGNABLE_ROLES, DEFAULT_ROLE, ROLE_LABEL } from "@/lib/auth/role-labels";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useErrorToast } from "@/lib/forms/use-error-toast";

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

  useErrorToast(state, (campo) => `invite-${campo}-error`);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  /**
   * Los campos que este formulario pinta, y la **única** fuente de qué campo
   * está en error: de acá salen el `aria-invalid` de cada control, su
   * `aria-describedby`, el borde rojo y el mensaje. Gatear por nombre y no por
   * "cualquier cosa que venga en `state.field`" evita que un campo nuevo del
   * schema, sin control acá, pinte un mensaje que ningún control apunta — y que
   * `useErrorToast` lo viera pintado y se callara el toast.
   */
  const CAMPOS = ["email", "role"] as const;
  // Exige que HAYA mensaje, no solo campo: un resultado con `field` y sin
  // `error` pintaba el borde rojo y un `role="alert"` vacío, que un lector de
  // pantalla anuncia como nada.
  const campoEnError = state?.error ? CAMPOS.find((c) => c === state.field) : undefined;
  const idError = (name: (typeof CAMPOS)[number]) =>
    campoEnError === name ? `invite-${name}-error` : undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {/* `flex-wrap` + un mínimo real en el correo: a 320px los tres controles
          en una línea empujaban el botón fuera de la pantalla, y `html` recorta
          el eje X sin barra — o sea, botón inalcanzable. */}
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Correo a invitar
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="nombre@correo.com"
            aria-invalid={campoEnError === "email"}
            aria-describedby={idError("email")}
            className={cn(
              "h-10 rounded-md border border-border bg-background px-3 text-sm",
              campoEnError === "email" && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Rol
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue={DEFAULT_ROLE}
            aria-invalid={campoEnError === "role"}
            aria-describedby={idError("role")}
            className={cn(
              "h-10 rounded-md border border-border bg-background px-2 text-sm",
              campoEnError === "role" && ERROR_CONTROL_CLASS,
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
      {campoEnError && <FieldError id={`invite-${campoEnError}-error`}>{state!.error}</FieldError>}
    </form>
  );
}
