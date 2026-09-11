import { Briefcase, Home, MessageCircle, Settings, Store, Users } from "lucide-react";
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
 * Composición de la barra flotante, según el reporte del usuario del
 * 2026-09-11:
 *
 * - **Inicio y el selector de módulos son fijos siempre.** Entrar a
 *   Configuración hacía desaparecer Inicio (la barra se reemplazaba por una
 *   "neutral" con la puerta a los dos módulos), y eso dejaba sin salida
 *   obvia: el botón de volver a la pantalla principal no estaba.
 * - **El resto se adapta al módulo**: en el ATS salen sus submenús (Vacantes,
 *   Candidatos, Bolsa), en Conectados el suyo.
 * - **Ajustes es la configuración general** y cierra la barra. La bolsa de
 *   empleo dejó de vivir dentro de él: es una pantalla del ATS (`/bolsa`),
 *   porque configurar la portada y las leyendas de la bolsa es operación de
 *   reclutamiento, no configuración de la plataforma.
 *
 * Tope de AGENTS.md: 5 ítems. Un super admin en el ATS ve exactamente 5
 * (Inicio, Vacantes, Candidatos, Bolsa, Ajustes); el selector de módulos no
 * cuenta como ítem de navegación.
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
  // La bolsa comparte las políticas de Storage y de `organizations` con la
  // marca, que son de super admin: ofrecerla a un `admin` sería un botón que
  // lleva a una pantalla que no puede guardar nada.
  if (role === "super_admin") {
    base.push({ href: "/bolsa", label: "Bolsa", icon: Store });
  }
  return conAjustes(base, role);
}

function conectadosItemsForRole(role: Role): NavItem[] {
  return conAjustes([{ href: "/conectados", label: "Inicio", icon: Home }], role);
}

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
  const match = MODULES.find((m) => m !== MODULES[0] && pathname.startsWith(m.basePath));
  return match ?? MODULES[0];
}
