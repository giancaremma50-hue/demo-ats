import { Briefcase, Home, MessageCircle, Settings, Store, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];
export type NavItem = { href: string; label: string; icon: LucideIcon };

export type ModuleConfig = {
  id: string;
  /** Nombre largo, para el selector de módulos. */
  label: string;
  /** Nombre corto, el que va en la barra al lado del selector. */
  shortLabel: string;
  icon: LucideIcon;
  accentColor: string;
  /** El Home del módulo. */
  basePath: string;
  /** Solo el Home y los submenús: el engranaje lo pone la barra, siempre al final. */
  itemsForRole: (role: Role) => NavItem[];
  /** Configuración propia del módulo. Sin esto, el engranaje lleva a la general. */
  settingsHref?: string;
};

/**
 * Composición de la barra flotante (mockup aprobado por el usuario el
 * 2026-09-11, variante B):
 *
 *   `[⊞ Nombre del módulo] · [Home] [submenús…] · [⚙]`
 *
 * - **Tres anclas que no se mueven nunca**: el selector de módulos, el Home y
 *   el engranaje. En toda pantalla, en la misma posición. Que Inicio
 *   desapareciera al entrar a Configuración fue el reporte que originó esto.
 * - **El nombre del módulo vive DENTRO del selector**, no en una ficha aparte:
 *   ese botón ya es el que te dice en cuál estás y el que te deja cambiar, y
 *   así ahorra el lugar que en un teléfono se agota primero.
 * - **Lo que cambia son los submenús**, que son del módulo.
 * - **El engranaje sigue al módulo** cuando el módulo tiene configuración
 *   propia (`settingsHref`); si no, va a la general. Solo para admin+: un
 *   gestor no tiene ninguna pantalla de configuración a la que llegar.
 */
function reclutamientoItemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
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

function conectadosItemsForRole(): NavItem[] {
  return [{ href: "/conectados", label: "Inicio", icon: Home }];
}

export const MODULES: ModuleConfig[] = [
  {
    id: "reclutamiento",
    label: "Reclutamiento AJE",
    shortLabel: "Reclutamiento",
    icon: Briefcase,
    // `--primary` es el verde AJE fijo (#00b348 claro / #2fd66f oscuro), NO
    // el acento que configura la organización — ese es `--accent`, que
    // `src/app/layout.tsx` inyecta en <html>. La barra se queda en el verde a
    // propósito: el nombre del módulo va en tinta oscura y necesita un fondo
    // claro conocido, y `BrandingSchema` admite acentos oscuros (solo exige
    // 3:1 contra el fondo claro de la app). Seguir al acento configurable
    // exigiría resolver antes ese par.
    accentColor: "var(--primary)",
    basePath: "/inicio",
    itemsForRole: reclutamientoItemsForRole,
  },
  {
    id: "conectados",
    label: "AJE Conectados",
    shortLabel: "Conectados",
    icon: MessageCircle,
    accentColor: "var(--aje-orange)",
    basePath: "/conectados",
    itemsForRole: conectadosItemsForRole,
    // Sin `settingsHref`: hoy lo único propio de Conectados es quién puede
    // publicar (`post_permissions`), que todavía no tiene pantalla. Su
    // engranaje va a la configuración general hasta que la tenga.
  },
];

/** El engranaje, el tercer ancla. Fuera de `itemsForRole` porque no es un
 * submenú del módulo: está siempre, y al final. Se devuelve una copia en las
 * dos ramas — si una entregara la constante por referencia, cualquiera que
 * retoque el objeto la corrompería para todos los demás. */
const SETTINGS_ITEM: NavItem = { href: "/configuracion", label: "Ajustes", icon: Settings };

export function settingsItemFor(module: ModuleConfig, role: Role): NavItem | null {
  if (!ADMIN_ROLES.has(role)) return null;
  if (!module.settingsHref) return { ...SETTINGS_ITEM };
  return { ...SETTINGS_ITEM, href: module.settingsHref, label: `Ajustes de ${module.shortLabel}` };
}

/**
 * Rutas que no son de ningún módulo: la configuración de la plataforma y las
 * pantallas personales. La barra sigue mostrando sus tres anclas ahí, pero
 * **sin el nombre del módulo** — el nombre existe para decir dónde estás, y
 * en estas pantallas decir "Reclutamiento" sería falso para quien llegó desde
 * AJE Conectados. Es el mismo motivo por el que `activeModuleFor` cae en
 * Reclutamiento como fallback: alguien tiene que poner el Home y los
 * submenús, pero eso no autoriza a afirmar en qué módulo está el usuario.
 */
const RUTAS_SIN_MODULO = ["/configuracion", "/mi-cuenta", "/notificaciones"];

export function isModulelessPath(pathname: string): boolean {
  return RUTAS_SIN_MODULO.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

// Reclutamiento no tiene un solo prefijo de ruta (/vacantes, /candidatos,
// /configuracion son hermanas, no hijas de /inicio) — por eso es el
// fallback, no un match por basePath. La exclusión ata al mismo objeto
// (MODULES[0]) que el fallback, no a un string "reclutamiento" aparte, para
// que reordenar/renombrar el id no los desincronice en silencio.
export function activeModuleFor(pathname: string): ModuleConfig {
  const match = MODULES.find((m) => m !== MODULES[0] && pathname.startsWith(m.basePath));
  return match ?? MODULES[0];
}
