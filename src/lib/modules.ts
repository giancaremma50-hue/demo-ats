import { Briefcase, Home, MessageCircle, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];
export type NavItem = { href: string; label: string; icon: LucideIcon };

export type ModuleConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  accentColor: string;
  basePath: string;
  itemsForRole: (role: Role) => NavItem[];
};

/**
 * Ajustes NO pertenece a ningún módulo: es la configuración de la plataforma
 * entera (marca, usuarios, departamentos, motivos). Vivía solo dentro de
 * Reclutamiento, así que estando en AJE Conectados el botón desaparecía y
 * para cambiar el logo había que pasar primero por el ATS — reportado por el
 * usuario el 2026-09-11. Se agrega al final de CADA módulo, siempre en la
 * misma posición, para que no se mueva al cambiar de módulo.
 */
function conAjustes(items: NavItem[], role: Role): NavItem[] {
  if (!ADMIN_ROLES.has(role)) return items;
  return [...items, { href: "/configuracion", label: "Ajustes", icon: Settings }];
}

function reclutamientoItemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  // Con Ajustes son 4 ítems: dentro del tope de 5 que fija AGENTS.md para la
  // barra flotante (el selector de módulos no es un ítem de navegación).
  return conAjustes(base, role);
}

function conectadosItemsForRole(role: Role): NavItem[] {
  return conAjustes([{ href: "/conectados", label: "Inicio", icon: Home }], role);
}

/**
 * `/configuracion` no pertenece a ningún módulo: al entrar ahí desde AJE
 * Conectados, dejar la barra del módulo de Reclutamiento mentía dos veces —
 * el selector marcaba Reclutamiento como activo y su "Inicio" llevaba al ATS,
 * no de vuelta a Conectados. Mientras se está en Ajustes la barra ofrece la
 * puerta a los dos módulos y marca Ajustes como activo; el selector no marca
 * ninguno, que es la verdad.
 *
 * No entra en MODULES a propósito: no es un módulo entre el que cambiar, es
 * una zona compartida.
 */
const CONFIGURACION: ModuleConfig = {
  id: "configuracion",
  label: "Configuración",
  icon: Settings,
  accentColor: "var(--aje-yellow)",
  basePath: "/configuracion",
  itemsForRole: (role) =>
    conAjustes(
      [
        { href: "/inicio", label: "Reclutamiento", icon: Briefcase },
        { href: "/conectados", label: "Conectados", icon: MessageCircle },
      ],
      role,
    ),
};

export const MODULES: ModuleConfig[] = [
  {
    id: "reclutamiento",
    label: "Reclutamiento AJE",
    icon: Briefcase,
    accentColor: "var(--aje-green)",
    basePath: "/inicio",
    itemsForRole: reclutamientoItemsForRole,
  },
  {
    id: "conectados",
    label: "AJE Conectados",
    icon: MessageCircle,
    accentColor: "var(--aje-orange)",
    basePath: "/conectados",
    itemsForRole: conectadosItemsForRole,
  },
];

// Reclutamiento no tiene un solo prefijo de ruta (/vacantes, /candidatos,
// /configuracion son hermanas, no hijas de /inicio) — por eso es el
// fallback, no un match por basePath. La exclusión ata al mismo objeto
// (MODULES[0]) que el fallback, no a un string "reclutamiento" aparte, para
// que reordenar/renombrar el id no los desincronice en silencio.
export function activeModuleFor(pathname: string): ModuleConfig {
  if (pathname.startsWith(CONFIGURACION.basePath)) return CONFIGURACION;
  const match = MODULES.find((m) => m !== MODULES[0] && pathname.startsWith(m.basePath));
  return match ?? MODULES[0];
}
