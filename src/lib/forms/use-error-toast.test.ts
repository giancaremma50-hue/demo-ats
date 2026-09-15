import { describe, expect, it } from "vitest";
import { campoSuelto, camposDeFila } from "./field-signals";
import { decidirToast, puedeMoverElFoco, seVe } from "./use-error-toast";

/** Un nodo de mentira con el único dato que la decisión mira. */
const nodo = (rects: number) => ({ getClientRects: () => ({ length: rects }) });
const nada = () => null;
const prefijado = (campo: string) => `referir-${campo}-error`;

describe("seVe", () => {
  it("un mensaje que no existe en el DOM no se ve", () => {
    expect(seVe(null)).toBe(false);
    expect(seVe(undefined)).toBe(false);
  });

  it("montado NO alcanza: sin cajas, no se pinta", () => {
    expect(seVe(nodo(0))).toBe(false);
  });

  it("con al menos una caja, se ve", () => {
    expect(seVe(nodo(1))).toBe(true);
  });
});

describe("decidirToast", () => {
  it("sin error no hay nada que avisar", () => {
    expect(decidirToast(undefined, prefijado, nada)).toEqual({ toast: null, llevarA: null });
    expect(decidirToast({ success: "Listo" } as never, prefijado, nada)).toEqual({ toast: null, llevarA: null });
  });

  it("un error SIN campo siempre va al toast", () => {
    expect(decidirToast({ error: "No se pudo guardar." }, prefijado, nada)).toEqual({
      toast: "No se pudo guardar.",
      llevarA: null,
    });
  });

  it("un error con campo que NO pintó su mensaje va al toast", () => {
    // Campo escondido por configuración: el `<Field>` no existe en el DOM.
    expect(decidirToast({ error: "Correo inválido.", field: "email" }, prefijado, nada)).toEqual({
      toast: "Correo inválido.",
      llevarA: null,
    });
  });

  it("un error cuyo mensaje está montado pero NO pintado va al toast", () => {
    // El caso que rompió la versión anterior: el `<FieldError>` existe dentro
    // de un <dialog> que el usuario ya cerró. La lista decía "se ve", el toast
    // se callaba, y el error quedaba mudo.
    const enDialogoCerrado = (id: string) => (id === "referir-email-error" ? nodo(0) : null);
    expect(decidirToast({ error: "Correo inválido.", field: "email" }, prefijado, enDialogoCerrado)).toEqual({
      toast: "Correo inválido.",
      llevarA: null,
    });
  });

  it("un error cuyo mensaje SÍ se pinta no repite toast, y dice a dónde llevar", () => {
    const visible = (id: string) => (id === "referir-email-error" ? nodo(1) : null);
    expect(decidirToast({ error: "Correo inválido.", field: "email" }, prefijado, visible)).toEqual({
      toast: null,
      llevarA: "referir-email-error",
    });
  });

  it("usa el id que arma el formulario, no el nombre del campo", () => {
    // Si el mapper y el `<Field id>` se desincronizan, `buscar` no encuentra
    // nada y el toast habla — ruidoso, nunca mudo.
    const soloSinPrefijo = (id: string) => (id === "email-error" ? nodo(1) : null);
    expect(decidirToast({ error: "Correo inválido.", field: "email" }, prefijado, soloSinPrefijo).toast).toBe(
      "Correo inválido.",
    );
  });
});

describe("puedeMoverElFoco", () => {
  /** Un nodo de mentira con lo único que la guardia mira: a quién contiene. */
  type Falso = { nombre: string; contains: (otro: Node) => boolean };
  const crear = (nombre: string, contiene: string[] = []): Node => {
    const n: Falso = {
      nombre,
      contains: (otro) => {
        const o = otro as unknown as Falso | null;
        return o?.nombre === nombre || (o != null && contiene.includes(o.nombre));
      },
    };
    return n as unknown as Node;
  };
  const body = crear("body");

  it("si nadie tiene el foco, se mueve", () => {
    expect(puedeMoverElFoco(null, crear("form"), body)).toBe(true);
  });

  it("si lo tiene el body, se mueve", () => {
    expect(puedeMoverElFoco(body, crear("form"), body)).toBe(true);
  });

  it("si lo tiene algo DENTRO del formulario, se mueve", () => {
    // Lo normal: quedó en el botón que acaba de enviar.
    expect(puedeMoverElFoco(crear("boton"), crear("form", ["boton"]), body)).toBe(true);
  });

  it("si lo tiene un ANCESTRO del formulario, se mueve", () => {
    // El diálogo modal: al deshabilitarse el botón mientras la acción corre, el
    // navegador devuelve el foco al <dialog>, que contiene al formulario — no
    // al revés. Sin esta rama, descartar y referir quedaban justo afuera.
    expect(puedeMoverElFoco(crear("dialogo", ["form"]), crear("form"), body)).toBe(true);
  });

  it("si lo tiene OTRO formulario de la pantalla, NO se mueve", () => {
    // Lo que la guardia existe para proteger: el usuario se fue a escribir a
    // otro lado mientras la acción corría.
    expect(puedeMoverElFoco(crear("campoAjeno"), crear("form"), body)).toBe(false);
  });

  it("sin formulario, no se mueve nada", () => {
    expect(puedeMoverElFoco(crear("campoAjeno"), null, body)).toBe(false);
  });
});

describe("decidirToast con mensaje general propio", () => {
  const idGeneral = "postular-error";

  it("si el campo no pintó pero el general SÍ, no repite toast", () => {
    const soloGeneral = (id: string) => (id === idGeneral ? nodo(1) : null);
    expect(decidirToast({ error: "Se perdió la conexión." }, prefijado, soloGeneral, idGeneral)).toEqual({
      toast: null,
      llevarA: idGeneral,
    });
  });

  it("si no pintó ninguno de los dos, habla el toast", () => {
    // Campo escondido por configuración: no hay mensaje de campo, y el general
    // tampoco se pinta porque el error SÍ trae campo.
    expect(decidirToast({ error: "El CV debe ser un PDF.", field: "cv" }, prefijado, nada, idGeneral)).toEqual({
      toast: "El CV debe ser un PDF.",
      llevarA: null,
    });
  });

  it("el del campo gana al general", () => {
    const ambos = (id: string) => (id === "referir-cv-error" || id === idGeneral ? nodo(1) : null);
    expect(decidirToast({ error: "x", field: "cv" }, prefijado, ambos, idGeneral).llevarA).toBe("referir-cv-error");
  });
});

describe("camposDeFila", () => {
  const CAMPOS = ["description", "due_date"] as const;

  it("sin error, ningún campo está marcado", () => {
    const fila = camposDeFila(undefined, "x", CAMPOS);
    expect(fila.enError).toBe(false);
    expect(fila.cual).toBeUndefined();
    expect(fila.idMensaje).toBeUndefined();
    expect(fila.props("description")).toEqual({ "aria-invalid": false, "aria-describedby": undefined });
  });

  it("un campo con mensaje marca SOLO a ese campo", () => {
    const fila = camposDeFila({ error: "Describe la tarea.", field: "description" }, "t1", CAMPOS);
    expect(fila.enError).toBe(true);
    expect(fila.cual).toBe("description");
    expect(fila.mensaje).toBe("Describe la tarea.");
    expect(fila.idMensaje).toBe("t1-description-error");
    expect(fila.es("description")).toBe(true);
    expect(fila.es("due_date")).toBe(false);
    expect(fila.props("description")["aria-describedby"]).toBe("t1-description-error");
    expect(fila.props("due_date")["aria-describedby"]).toBeUndefined();
  });

  it("un campo que esta fila NO pinta se deja para el toast", () => {
    const fila = camposDeFila({ error: "Persona inválida.", field: "assigned_to" }, "t1", CAMPOS);
    expect(fila.enError).toBe(false);
    expect(fila.cual).toBeUndefined();
  });

  it("`field` SIN mensaje no marca nada", () => {
    // Pintaba borde rojo y un role="alert" vacío, que se anuncia como nada.
    const fila = camposDeFila({ field: "description" }, "t1", CAMPOS);
    expect(fila.enError).toBe(false);
    expect(fila.cual).toBeUndefined();
    expect(fila.es("description")).toBe(false);
  });
});

describe("campoSuelto", () => {
  it("sin mensaje no marca nada", () => {
    expect(campoSuelto(undefined, "x-error").enError).toBe(false);
    expect(campoSuelto(undefined, "x-error").props["aria-describedby"]).toBeUndefined();
  });

  it("sin id de mensaje tampoco: el `aria-describedby` colgaría de la nada", () => {
    expect(campoSuelto("Inválido.", undefined).enError).toBe(false);
  });

  it("con las dos cosas, las cuatro señales coinciden", () => {
    const c = campoSuelto("Inválido.", "x-error");
    expect(c.enError).toBe(true);
    expect(c.props).toEqual({ "aria-invalid": true, "aria-describedby": "x-error" });
    expect(c.idMensaje).toBe("x-error");
    expect(c.mensaje).toBe("Inválido.");
  });

  it("un mensaje vacío no pinta borde rojo sin explicación", () => {
    expect(campoSuelto("", "x-error").enError).toBe(false);
  });
});

describe("camposDeFila y campoSuelto dicen lo mismo", () => {
  it("`enError` es booleano en los dos, y `cual` es el que nombra al campo", () => {
    // Si uno devolviera el nombre y el otro un booleano, un `=== true` escrito
    // después de leer `campoSuelto` descartaría el mensaje en silencio.
    const fila = camposDeFila({ error: "x", field: "a" }, "p", ["a"] as const);
    const suelto = campoSuelto("x", "p-a-error");
    expect(typeof fila.enError).toBe(typeof suelto.enError);
    expect(fila.enError).toBe(true);
    expect(fila.cual).toBe("a");
    expect(fila.mensaje).toBe(suelto.mensaje);
    expect(fila.props("a")).toEqual(suelto.props);
    expect(fila.idMensaje).toBe(suelto.idMensaje);
  });
});

describe("los dos helpers coinciden también sin error", () => {
  it("misma forma cuando no hay nada que mostrar", () => {
    const fila = camposDeFila(undefined, "p", ["a"] as const);
    const suelto = campoSuelto(undefined, undefined);
    expect(fila.enError).toBe(suelto.enError);
    expect(fila.mensaje).toBe(suelto.mensaje);
    expect(fila.idMensaje).toBe(suelto.idMensaje);
    expect(fila.props("a")).toEqual(suelto.props);
  });
});
