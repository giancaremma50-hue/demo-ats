import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodFieldError } from "./zod-error";

/** Corre un schema contra un valor inválido y devuelve el ZodError. */
function falla(schema: z.ZodType, valor: unknown): z.ZodError {
  const r = schema.safeParse(valor);
  if (r.success) throw new Error("Se esperaba que fallara.");
  return r.error;
}

describe("zodFieldError", () => {
  it("un path de UN segmento nombra al campo", () => {
    const schema = z.object({ title: z.string().min(4, { error: "Muy corto." }) });
    expect(zodFieldError(falla(schema, { title: "ab" }))).toEqual({ error: "Muy corto.", field: "title" });
  });

  it("un path ANIDADO no nombra ningún campo", () => {
    // `["questions", 0, "prompt"]` no es el `name` de ningún control del DOM:
    // devolver "questions" mandaba el mensaje a un campo que no existe. Sin
    // `field`, el formulario lo muestra por su canal general, que sí se ve.
    const schema = z.object({
      questions: z.array(z.object({ prompt: z.string().min(1, { error: "Escribe la pregunta." }) })),
    });
    expect(zodFieldError(falla(schema, { questions: [{ prompt: "" }] }))).toEqual({
      error: "Escribe la pregunta.",
      field: undefined,
    });
  });

  it("un índice de arreglo tampoco nombra un campo", () => {
    const schema = z.array(z.string({ error: "Texto inválido." }));
    expect(zodFieldError(falla(schema, [1])).field).toBeUndefined();
  });

  it("un valor suelto (path vacío) va sin campo", () => {
    const schema = z.number().int({ error: "Debe ser entero." });
    expect(zodFieldError(falla(schema, 1.5))).toEqual({ error: "Debe ser entero.", field: undefined });
  });

  it("siempre devuelve un mensaje: el issue de Zod nunca viene vacío", () => {
    // Por esto se quitó el parámetro `fallback`: era inalcanzable, y 28
    // llamadas le pasaban textos escritos para el usuario que no se veían nunca.
    const schema = z.object({ x: z.string() });
    const { error } = zodFieldError(falla(schema, { x: 1 }));
    expect(error.length).toBeGreaterThan(0);
  });
});
