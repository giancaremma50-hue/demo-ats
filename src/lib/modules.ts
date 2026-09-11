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

function reclutamientoItemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  if (ADMIN_ROLES.has(role)) {
    base.push({ href: "/configuracion", label: "Ajustes", icon: Settings });
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
