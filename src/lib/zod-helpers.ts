import { z } from "zod";

/** Un `<input>` vacío llega como `""`, no `undefined` — sin este preprocess, `.optional()` no lo reconoce como ausente y lo valida como string real. */
export function optionalText(max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max, { error: `Máximo ${max} caracteres.` }).optional(),
  );
}

export function optionalUuid(message = "Id inválido.") {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.uuid({ error: message }).optional(),
  );
}

/** Un uuid, con la validación estricta de Zod (versión y variante, RFC 9562).
 * Una sola definición: antes convivían `z.uuid()`, `z.string().uuid()` (que
 * Zod marca como deprecada) y un `UUID_RE` propio con estrictez distinta, así
 * que cambiar qué cuenta como id válido había que hacerlo en varios lugares o
 * las capas se contradecían. */
export const UuidSchema = z.uuid();
