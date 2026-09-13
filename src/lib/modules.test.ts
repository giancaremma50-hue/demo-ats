import { describe, expect, it } from "vitest";
import { HOME_ITEM, MODULES, activeByPathname, activeModuleFor, routesOf, settingsItemFor } from "./modules";

// Esta es la tercera vez que la barra flotante se rompe por la misma clase de
// error: una pantalla que aparece donde no es suya, o que desaparece de donde
// sí. El reporte del 2026-09-13 —"en Inicio no debería de verse lo de
// Vacantes, Candidatos y Bolsa"— salió de eso. Las comprobaciones de acá abajo
// son las que se hacían a mano cada vez.

const RECLUTAMIENTO = MODULES.find((m) => m.id === "reclutamiento")!;
const CONECTADOS = MODULES.find((m) => m.id === "conectados")!;

describe("activeModuleFor", () => {
  it("las pantallas de la plataforma no son de ningún módulo", () => {
    for (const ruta of ["/inicio", "/configuracion", "/configuracion/marca", "/mi-cuenta", "/notificaciones"]) {
      expect(activeModuleFor(ruta)).toBeNull();
    }
  });

  it("cada pantalla del ATS cae en Reclutamiento, incluidas sus hijas", () => {
    for (const ruta of ["/vacantes", "/vacantes/abc/pipeline", "/candidatos", "/bolsa", "/postulaciones/abc"]) {
      expect(activeModuleFor(ruta)?.id).toBe("reclutamiento");
    }
  });

  it("el muro cae en Conectados", () => {
    expect(activeModuleFor("/conectados")?.id).toBe("conectados");
  });

  // Una ruta nueva que nadie declaró no hereda los submenús del primer módulo:
  // ese fallback era el bug original, disfrazado de valor por defecto.
  it("una ruta que ningún módulo declara no es de nadie", () => {
    expect(activeModuleFor("/reportes")).toBeNull();
    expect(activeModuleFor("/vacantes-archivadas")).toBeNull();
  });

  // `MODULES.find` se queda con el primero que matchea: si dos módulos se
  // pisan una ruta, la barra pinta el módulo equivocado sin error ninguno.
  it("ningún par de módulos se pisa una ruta", () => {
    for (const a of MODULES) {
      for (const b of MODULES) {
        if (a === b) continue;
        for (const ruta of routesOf(a)) {
          expect(routesOf(b).some((r) => ruta === r || ruta.startsWith(`${r}/`))).toBe(false);
        }
      }
    }
  });
});

describe("itemsForRole", () => {
  it("ningún módulo se queda sin pantallas, en ningún rol", () => {
    for (const modulo of MODULES) {
      for (const rol of ["gestor", "admin", "super_admin"] as const) {
        expect(modulo.itemsForRole(rol).length).toBeGreaterThan(0);
      }
    }
  });

  // El Inicio y el engranaje los pone la barra. Un módulo que los repita
  // duplica el ancla y choca de `key` con ella.
  it("ningún módulo declara el Inicio ni los Ajustes como pantalla propia", () => {
    for (const modulo of MODULES) {
      for (const rol of ["gestor", "admin", "super_admin"] as const) {
        const hrefs = modulo.itemsForRole(rol).map((i) => i.href);
        expect(hrefs).not.toContain(HOME_ITEM.href);
        expect(hrefs).not.toContain("/configuracion");
      }
    }
  });

  // Dos controles de la misma barra con el mismo nombre vuelven ambiguo un
  // "tocá X" por voz. Las anclas cuentan: Inicio y Ajustes están siempre.
  it("ninguna pantalla se llama como otra ni como un ancla de la barra", () => {
    const etiquetas = MODULES.flatMap((m) => m.itemsForRole("super_admin").map((i) => i.label));
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
    for (const reservada of [HOME_ITEM.label, "Ajustes"]) {
      expect(etiquetas).not.toContain(reservada);
    }
    // `settingsItemFor` arma "Ajustes de X" para el engranaje propio de un
    // módulo: una pantalla no puede llamarse igual que ese ítem tampoco.
    const deModulo = MODULES.map((m) => `Ajustes de ${m.shortLabel}`);
    for (const etiqueta of etiquetas) {
      expect(deModulo).not.toContain(etiqueta);
    }
  });

  it("la bolsa es solo de super admin", () => {
    expect(RECLUTAMIENTO.itemsForRole("admin").map((i) => i.href)).not.toContain("/bolsa");
    expect(RECLUTAMIENTO.itemsForRole("super_admin").map((i) => i.href)).toContain("/bolsa");
  });

  it("un gestor ve vacantes y candidatos, y el muro", () => {
    expect(RECLUTAMIENTO.itemsForRole("gestor").map((i) => i.href)).toEqual(["/vacantes", "/candidatos"]);
    expect(CONECTADOS.itemsForRole("gestor").map((i) => i.href)).toEqual(["/conectados"]);
  });
});

describe("ModuleConfig", () => {
  // WCAG 2.5.3: el botón muestra `shortLabel` y se anuncia con `label`.
  it("el nombre largo contiene al corto", () => {
    for (const modulo of MODULES) {
      expect(modulo.label).toContain(modulo.shortLabel);
    }
  });

  // En el mapa la pantalla va justo debajo del módulo: el mismo glifo las
  // vuelve dos filas iguales.
  it("ninguna pantalla repite el ícono de su propio módulo", () => {
    for (const modulo of MODULES) {
      for (const pantalla of modulo.itemsForRole("super_admin")) {
        expect(pantalla.icon).not.toBe(modulo.icon);
      }
    }
  });
});

describe("settingsItemFor", () => {
  it("un gestor no tiene engranaje", () => {
    expect(settingsItemFor(RECLUTAMIENTO, "gestor")).toBeNull();
    expect(settingsItemFor(null, "gestor")).toBeNull();
  });

  // Sin módulo, el engranaje no puede nombrar uno: la barra acaba de decidir
  // no nombrarlo.
  it("sin módulo, va a la configuración general", () => {
    const item = settingsItemFor(null, "admin");
    expect(item?.href).toBe("/configuracion");
    expect(item?.label).toBe("Ajustes");
  });
});

// `activeByPathname` decide qué ítem del menú se marca como actual, en la barra
// flotante y en las secciones de Ajustes. Las dos hacían su propia copia de esta
// comparación, y la de Ajustes usaba `===`: dentro del asistente de plantillas
// no se marcaba ninguna sección y el menú dejaba de decir dónde estabas.
describe("activeByPathname", () => {
  const ITEMS = [
    { href: "/configuracion/plantillas-vacante" },
    { href: "/configuracion/plantillas-mensaje" },
    { href: "/vacantes" },
  ];

  it("marca la sección estando en una ruta hija", () => {
    expect(activeByPathname(ITEMS, "/configuracion/plantillas-vacante/nueva")?.href).toBe(
      "/configuracion/plantillas-vacante",
    );
    expect(activeByPathname(ITEMS, "/vacantes/abc/pipeline")?.href).toBe("/vacantes");
  });

  it("marca la sección en su ruta exacta", () => {
    expect(activeByPathname(ITEMS, "/vacantes")?.href).toBe("/vacantes");
  });

  // Un hermano que comparte prefijo NO es una ruta hija.
  it("no confunde un prefijo con un padre", () => {
    expect(activeByPathname(ITEMS, "/vacantes-archivadas")).toBeUndefined();
    expect(activeByPathname(ITEMS, "/otra")).toBeUndefined();
  });

  // Con dos coincidencias, gana la más larga: quedarse con la primera marcaría
  // el ítem equivocado (y en la barra flotante monta dos elementos con el mismo
  // `layoutId`, que framer-motion no sabe resolver).
  it("con rutas anidadas gana la más específica", () => {
    const anidados = [{ href: "/conectados" }, { href: "/conectados/ajustes" }];
    expect(activeByPathname(anidados, "/conectados/ajustes")?.href).toBe("/conectados/ajustes");
    expect(activeByPathname(anidados, "/conectados")?.href).toBe("/conectados");
  });
});
