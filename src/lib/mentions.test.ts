import { describe, expect, it } from "vitest";
import { activeMentionQuery, canonicalizeMentions, extractMentionIds, parseMentions, resolveMentionTokens } from "./mentions";

// Migra las 20 comprobaciones que se verificaron a mano el 2026-09-09 (ver
// docs/PENDIENTE.md #18 y .claude/napkin.md) y que no habían quedado en el
// repo porque el proyecto no tenía runner de tests todavía.

describe("parseMentions", () => {
  it("no ejecuta HTML — un <script> queda como texto literal", () => {
    const partes = parseMentions("hola <script>alert(1)</script> mundo");
    expect(partes).toEqual([{ tipo: "texto", valor: "hola <script>alert(1)</script> mundo" }]);
  });

  it("parte texto y mención en el orden correcto", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    const partes = parseMentions(`hola @[Ana](${uuid}) chau`);
    expect(partes).toEqual([
      { tipo: "texto", valor: "hola " },
      { tipo: "mencion", nombre: "Ana", profileId: uuid },
      { tipo: "texto", valor: " chau" },
    ]);
  });

  it("un uuid en mayúsculas se normaliza a minúsculas", () => {
    const partes = parseMentions("@[Ana](AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE)");
    expect(partes).toEqual([{ tipo: "mencion", nombre: "Ana", profileId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }]);
  });

  it("un token malformado (sin paréntesis) no casa como mención", () => {
    const texto = "@[Ana] sin uuid";
    expect(parseMentions(texto)).toEqual([{ tipo: "texto", valor: texto }]);
  });

  it("un nombre con corchetes rompe el token — no casa, queda literal", () => {
    const texto = "@[Ana [Directora]](11111111-1111-1111-1111-111111111111)";
    // El corchete de "[Directora]" cierra el nombre antes de tiempo: el
    // resto ("Directora]](uuid)") no vuelve a formar un token válido.
    expect(parseMentions(texto)).toEqual([{ tipo: "texto", valor: texto }]);
  });

  it("un nombre multilínea no casa (el corte de negrita no se puede inyectar con saltos de línea)", () => {
    const texto = "@[Ana\nRamírez](11111111-1111-1111-1111-111111111111)";
    expect(parseMentions(texto)).toEqual([{ tipo: "texto", valor: texto }]);
  });

  it("body vacío devuelve cero partes", () => {
    expect(parseMentions("")).toEqual([]);
  });
});

describe("extractMentionIds", () => {
  it("dedupea y normaliza a minúsculas", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const ids = extractMentionIds(`@[Ana](${a.toUpperCase()}) y @[Ana otra vez](${a})`);
    expect(ids).toEqual([a]);
  });

  it("cadena sin menciones devuelve un array vacío", () => {
    expect(extractMentionIds("texto sin nada")).toEqual([]);
  });
});

describe("canonicalizeMentions", () => {
  it("reescribe el token con el nombre autoritativo del mapa", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const nombrePorId = new Map([[id, "Nombre Real"]]);
    const resultado = canonicalizeMentions(`hola @[Nombre Falso](${id})`, nombrePorId);
    expect(resultado).toBe(`hola @[Nombre Real](${id})`);
  });

  it("deja intacto un token cuyo uuid no está en el mapa", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    const original = `@[Alguien](${id})`;
    expect(canonicalizeMentions(original, new Map())).toBe(original);
  });
});

describe("resolveMentionTokens", () => {
  it("degrada a texto plano un token cuyo uuid no resolvió", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    expect(resolveMentionTokens(`@[Alguien](${id})`, new Map())).toBe("Alguien");
  });

  it("un intento de token anidado no se vuelve a armar al degradar", () => {
    // Ver el comentario de resolveMentionTokens: sin limpiar el nombre
    // degradado (quitar el "["), el texto que sobrevive sería
    // "@[Directora](idReal)" — un token NUEVO y nunca validado. Limpio,
    // sobrevive "@Directora](idReal)", que ya no arranca con "@[" y por
    // lo tanto no vuelve a parsear como mención de nadie.
    const idReal = "11111111-1111-1111-1111-111111111111";
    const idFalso = "22222222-2222-2222-2222-222222222222";
    const resultado = resolveMentionTokens(`@[@[Directora](${idFalso})](${idReal})`, new Map());
    const menciones = parseMentions(resultado).filter((p) => p.tipo === "mencion");
    expect(menciones).toEqual([]);
  });
});

describe("activeMentionQuery", () => {
  it("un correo escrito en el texto no abre el autocompletado", () => {
    const texto = "contacto: ana@empresa.com";
    expect(activeMentionQuery(texto, texto.length)).toBeNull();
  });

  it("un @ al inicio de palabra sí abre el autocompletado", () => {
    const texto = "hola @ana";
    expect(activeMentionQuery(texto, texto.length)).toEqual({ query: "ana", desde: 5 });
  });

  it("cursor antes del @ no encuentra ninguna búsqueda activa", () => {
    const texto = "hola @ana lucía";
    expect(activeMentionQuery(texto, 3)).toBeNull();
  });

  it("un salto de línea cierra la búsqueda activa", () => {
    const texto = "@ana\nlucía";
    expect(activeMentionQuery(texto, texto.length)).toBeNull();
  });

  it("un espacio simple no cierra la búsqueda (permite '@ana lu')", () => {
    const texto = "@ana lu";
    expect(activeMentionQuery(texto, texto.length)).toEqual({ query: "ana lu", desde: 0 });
  });

  it("sin ningún @ devuelve null", () => {
    expect(activeMentionQuery("texto plano", 5)).toBeNull();
  });

  it("una query de más de 40 caracteres cierra la búsqueda", () => {
    const texto = "@" + "a".repeat(41);
    expect(activeMentionQuery(texto, texto.length)).toBeNull();
  });
});
