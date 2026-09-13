import { Briefcase, Home, MessageCircle, Newspaper, Settings, Store, UserSearch, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ROLES, ROLE_LABEL } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];
export type NavItem = { href: string; label: string; icon: LucideIcon };

export type ModuleConfig = {
  id: string;
  /** Nombre largo, para el selector de módulos. **Tiene que contener a
   *  `shortLabel`**: el botón muestra `shortLabel` y se anuncia con `label`, y
   *  WCAG 2.5.3 pide que lo visible esté contenido en lo anunciado. Hoy se
   *  cumple ("Reclutamiento" ⊂ "Reclutamiento AJE", "Conectados" ⊂ "AJE
   *  Conectados"); un par como `label: "Ventas AJE"` + `shortLabel:
   *  "Comercial"` lo rompería sin que nada avise. */
  label: string;
  /** Nombre corto, el que dice el selector desde `sm:`. Ojo: `settingsItemFor`
   *  también lo mete dentro de un label de ítem ("Ajustes de X"), y ESE se
   *  pinta al lado del selector en un teléfono cuando el ítem está activo —
   *  un `shortLabel` largo le come el ancho a la barra justo donde menos hay. */
  shortLabel: string;
  icon: LucideIcon;
  accentColor: string;
  /**
   * Rutas del módulo que **no** son destino de la barra, y que por eso no se
   * pueden deducir de `itemsForRole`: `/postulaciones/<id>` es la ficha de un
   * candidato, pantalla del ATS sin ítem propio en el menú. Todo lo demás lo
   * calcula `routesOf()` a partir de las pantallas, para que agregar una
   * pantalla no obligue a acordarse de una segunda lista — desincronizarlas
   * dejaría a esa pantalla sin su propio módulo justo al entrar.
   */
  extraRoutes?: string[];
  /** **Solo las pantallas del módulo.** El Inicio y el engranaje son anclas de
   *  la barra (`HOME_ITEM` / `settingsItemFor`) y los pone ella, siempre en el
   *  mismo lugar: un módulo que agregue acá su propio "Inicio" duplica el
   *  ancla y choca de `key` con ella. */
  itemsForRole: (role: Role) => NavItem[];
  /** Configuración propia del módulo. Sin esto, el engranaje lleva a la general. */
  settingsHref?: string;
};

/**
 * Composición de la barra flotante (mockup aprobado el 2026-09-13):
 *
 *   `[⊞ Módulo] · [Inicio] [pantallas del módulo…] · [⚙]`
 *
 * - **Tres anclas que no se mueven nunca**: el selector, el Inicio y el
 *   engranaje. En toda pantalla, en la misma posición. Que Inicio
 *   desapareciera al entrar a Configuración fue el reporte que originó esto.
 * - **Las pantallas del medio son del MÓDULO, y de nadie más.** Fuera de un
 *   módulo —Inicio, Ajustes, Mi cuenta, Notificaciones— no hay ninguna: la
 *   barra queda en sus tres anclas. Antes Inicio era una pantalla de
 *   Reclutamiento, así que estando ahí se veían Vacantes, Candidatos y Bolsa,
 *   que son del ATS; el usuario lo reportó y de ahí sale esta separación.
 * - **El selector es el mapa entero**: los módulos y, colgando de cada uno,
 *   sus pantallas. Por eso sacar los submenús de Inicio no deja nada
 *   inalcanzable — a Candidatos se llega en dos toques desde cualquier lado.
 * - **El nombre del módulo vive DENTRO del selector**, no en una ficha aparte,
 *   para ahorrar el lugar que en un teléfono se agota primero — y ahí se
 *   oculta del todo, porque ese lugar es del nombre de la pantalla, que va
 *   FUERA del botón para no nombrar al control equivocado (2026-09-13).
 * - **El engranaje sigue al módulo** cuando el módulo tiene configuración
 *   propia (`settingsHref`); si no, va a la general. Solo para admin+: un
 *   gestor no tiene ninguna pantalla de configuración a la que llegar.
 */
function reclutamientoItemsForRole(role: Role): NavItem[] {
  // Sin `/inicio`: es la portada de la plataforma, no una pantalla del ATS.
  const base: NavItem[] = [{ href: "/vacantes", label: "Vacantes", icon: Briefcase }];
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  // La bolsa comparte las políticas de Storage y de `organizations` con la
  // marca, que son de super admin: ofrecerla a un `admin` sería un botón que
  // lleva a una pantalla que no puede guardar nada.
  if (role === "super_admin") {
    base.push({ href: "/bolsa", label: "Bolsa", icon: Store });
  }
  return base;
}

/** "Muro" y no "Inicio": Inicio es uno solo y es la portada de la plataforma.
 *  Con los dos módulos llamando "Inicio" a su pantalla principal, el mapa del
 *  selector mostraba dos filas idénticas y en un teléfono la barra decía
 *  "Inicio" en los dos módulos sin que nada más los distinguiera. El ícono
 *  tampoco repite al del módulo (`MessageCircle`): en el mapa la pantalla va
 *  justo debajo de su módulo, y con el mismo glifo volvían a ser dos filas
 *  iguales — ahora por el dibujo en vez de por el texto. */
function conectadosItemsForRole(): NavItem[] {
  return [{ href: "/conectados", label: "Muro", icon: Newspaper }];
}

export const MODULES: ModuleConfig[] = [
  {
    id: "reclutamiento",
    label: "Reclutamiento AJE",
    shortLabel: "Reclutamiento",
    // `UserSearch` y no el `Briefcase` de Vacantes: en el mapa la pantalla va
    // justo debajo de su módulo, y con el mismo glifo son dos filas iguales.
    // El maletín se queda donde ya lo reconocen, que es el ítem de la barra.
    icon: UserSearch,
    // `--primary` es el verde AJE fijo, #00b348 (el bloque `.dark` define otro
    // valor, pero ese tema hoy no se puede encender — ver el napkin). NO
    // el acento que configura la organización — ese es `--accent`, que
    // `src/app/layout.tsx` inyecta en <html>. La barra se queda en el verde a
    // propósito: el nombre del módulo va en tinta oscura y necesita un fondo
    // claro conocido, y `BrandingSchema` exige 4.5:1 contra el fondo
    // claro, que no dice nada sobre el contraste contra ESTA barra. Seguir al
    // acento configurable exigiría resolver antes ese par.
    accentColor: "var(--primary)",
    // `/vacantes`, `/candidatos` y `/bolsa` salen solas de `itemsForRole`.
    extraRoutes: ["/postulaciones"],
    itemsForRole: reclutamientoItemsForRole,
  },
  {
    id: "conectados",
    label: "AJE Conectados",
    shortLabel: "Conectados",
    icon: MessageCircle,
    accentColor: "var(--aje-orange)",
    itemsForRole: conectadosItemsForRole,
    // Sin `settingsHref`: hoy lo único propio de Conectados es quién puede
    // publicar (`post_permissions`), que todavía no tiene pantalla. Su
    // engranaje va a la configuración general hasta que la tenga.
  },
];

/** El Inicio, la segunda ancla. Fuera de `itemsForRole` por la misma razón que
 * el engranaje: no es una pantalla de ningún módulo, es la portada de la
 * plataforma, y la barra lo pone siempre en el mismo lugar. Congelado en vez
 * de copiado en cada render: es la misma protección contra que alguien lo
 * retoque, sin fabricar un objeto nuevo cada vez. */
export const HOME_ITEM: Readonly<NavItem> = Object.freeze({ href: "/inicio", label: "Inicio", icon: Home });

/** El engranaje, el tercer ancla. Fuera de `itemsForRole` porque no es un
 * submenú del módulo: está siempre, y al final. Éste sí se copia en vez de
 * congelarse como `HOME_ITEM`: una de sus ramas le pisa `href` y `label` para
 * el engranaje propio de un módulo, y congelar el molde de esa copia no
 * protegería nada. */
const SETTINGS_ITEM: NavItem = { href: "/configuracion", label: "Ajustes", icon: Settings };

/**
 * `module` es `null` fuera de todo módulo (Inicio, Ajustes, Mi cuenta,
 * Notificaciones) y ahí el engranaje va a la configuración general. Sin esa
 * rama, una ruta sin módulo heredaría el `settingsHref` del módulo que la
 * barra acaba de decidir NO nombrar: un ítem diciendo "Ajustes de
 * Reclutamiento" en una pantalla que no es de Reclutamiento.
 */
export function settingsItemFor(module: ModuleConfig | null, role: Role): NavItem | null {
  if (!ADMIN_ROLES.has(role)) return null;
  if (!module?.settingsHref) return { ...SETTINGS_ITEM };
  return { ...SETTINGS_ITEM, href: module.settingsHref, label: `Ajustes de ${module.shortLabel}` };
}

/** Todos los roles del enum. Sale de `ROLE_LABEL` y no de una lista a mano
 *  porque ese `Record` es exhaustivo sobre el enum y TypeScript lo obliga a
 *  seguir siéndolo: una lista aparte compilaría igual si el enum crece, y
 *  entonces las pantallas que solo viera ese rol quedarían fuera de
 *  `rutasDe()` — o sea, su ruta sin módulo y su barra sin submenús. */
const ROLES = Object.keys(ROLE_LABEL) as Role[];

/** Las rutas del módulo: las de sus pantallas en TODOS los roles (la ruta es
 *  del módulo aunque este usuario no vea su ítem) más las que no son destino
 *  del menú. Derivadas y no declaradas a mano: una pantalla nueva en
 *  `itemsForRole` trae su ruta consigo. */
function rutasDe(module: ModuleConfig): string[] {
  const dePantallas = ROLES.flatMap((r) => module.itemsForRole(r).map((i) => i.href));
  return [...new Set([...dePantallas, ...(module.extraRoutes ?? [])])];
}

/** Calculadas una sola vez: `MODULES` es una constante de módulo, así que sus
 *  rutas no cambian nunca — y `activeModuleFor` corre en cada render de la
 *  barra, incluidos los de cada cuadro de scroll mientras se pliega. */
const RUTAS_POR_MODULO: ReadonlyMap<ModuleConfig, string[]> = new Map(MODULES.map((m) => [m, rutasDe(m)]));

/** Las rutas de un módulo, para comprobar en tests que ningún par se pisa. */
export function routesOf(module: ModuleConfig): string[] {
  return RUTAS_POR_MODULO.get(module) ?? rutasDe(module);
}

/**
 * En qué módulo estás, o `null` si en ninguno.
 *
 * Se decide por las rutas de cada módulo, no por un fallback ni por una lista
 * aparte de rutas "sin módulo". Esa lista existió y era una trampa: toda
 * pantalla nueva que no fuera de ningún módulo nacía heredando los submenús de
 * Reclutamiento hasta que alguien se acordara de anotarla — exactamente el bug
 * que originó este cambio, listo para repetirse. Ahora la pertenencia sale de
 * las pantallas que el módulo ya declara (más `extraRoutes` para las que no
 * son destino del menú), y lo que nadie declaró no es de nadie, que es la
 * respuesta segura.
 */
export function activeModuleFor(pathname: string): ModuleConfig | null {
  return MODULES.find((m) => routesOf(m).some((r) => pathname === r || pathname.startsWith(`${r}/`))) ?? null;
}
