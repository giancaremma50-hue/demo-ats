"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { activeByPathname } from "@/lib/modules";

const TABS = [
  { href: "/configuracion/marca", label: "Marca", roles: ["super_admin"] },
  { href: "/configuracion/usuarios", label: "Usuarios y roles", roles: ["admin", "super_admin"] },
  { href: "/configuracion/departamentos", label: "Departamentos", roles: ["admin", "super_admin"] },
  { href: "/configuracion/motivos-rechazo", label: "Motivos de rechazo", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-mensaje", label: "Plantillas de mensaje", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-vacante", label: "Plantillas de puesto", roles: ["admin", "super_admin"] },
  { href: "/configuracion/errores", label: "Centro de errores", roles: ["super_admin"] },
];

/**
 * Las secciones de Ajustes. **Dos formas, un solo `TABS` y un solo landmark.**
 *
 * Hasta `lg:` se agrupa en un desplegable: el nombre de la sección donde
 * estás, y al tocarlo la lista entera. Antes se deslizaba de costado, y eso no
 * es una barra de pestañas que se adapta — es una que no cabe: la sección
 * activa se iba fuera de la vista al desplazarse, así que la tira dejaba de
 * decir dónde estás, que es su único trabajo.
 *
 * **`<details>` nativo y no un popover**, y no es por pereza: un popover se
 * renderiza en un portal fuera del `<nav>`, así que en un teléfono el landmark
 * de navegación se quedaba sin un solo enlace adentro y las secciones existían
 * únicamente dentro de un `role="dialog"`. Además, al vivir en un portal
 * flotante hay que darle alto máximo y scroll propio o en un teléfono apaisado
 * las últimas secciones quedan recortadas; y hay que cerrarlo a mano si la
 * ventana cruza el punto de corte, o queda anclado a un disparador
 * `display:none`. Un desplegable en línea no tiene ninguno de esos tres
 * problemas: empuja el contenido, la página scrollea sola, y el navegador se
 * encarga del teclado.
 *
 * **El punto de corte sale de la aritmética, no de la costumbre**
 * (`AGENTS.md`, responsividad): las siete pestañas de un super admin miden
 * ~874px (los rótulos a 13px más seis `gap-6`). A `lg:` el `main` deja 944
 * (`max-w-6xl` con `lg:px-10`), que es el primer escalón donde entran. Un
 * `admin` ve cinco (~676px) y podría desplegarlas antes, pero un punto de
 * corte por rol haría que la misma pantalla se viera distinta según quién
 * mire, sin que nada lo explique.
 */
export function ConfigTabs({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => t.roles.includes(role));

  // El mismo helper que usa la barra flotante: con `===` a secas, estando en
  // `/configuracion/plantillas-vacante/nueva` ninguna sección quedaba marcada
  // y el menú no decía dónde estabas — justo dentro del asistente, que es
  // donde más se necesita.
  const actual = activeByPathname(visible, pathname);

  /** `page` solo cuando el enlace ES la pantalla actual; si coincide por ser su
   *  sección padre, `true` — que es lo que ARIA reserva para "estoy dentro de
   *  esto", no para "esto es la página". */
  const marca = (href: string) => (pathname === href ? "page" : href === actual?.href ? "true" : undefined);

  return (
    <nav aria-label="Secciones de ajustes">
      {/* Agrupado: hasta `lg:` */}
      {/* `key={pathname}`: `ConfigTabs` vive en el layout de Ajustes, que NO se
          remonta al cambiar de sección, y `open` es un atributo del DOM que
          React no reescribe. Sin esto el desplegable quedaba abierto después de
          elegir, empujando el contenido con las siete opciones todavía a la
          vista. La llave lo remonta cerrado en cada navegación. */}
      <details key={pathname} className="group lg:hidden">
        <summary
          // `list-none` + el pseudo de WebKit: sin eso el navegador dibuja su
          // propio triángulo al lado del que sí pertenece al diseño.
          className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground focus-visible:border-accent [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 truncate">{actual?.label ?? "Elegir sección"}</span>
          {/* `transition-[rotate]` y no `transition-transform`: en Tailwind v4
              `rotate-180` compila a la propiedad independiente `rotate`. */}
          <ChevronDown
            className="size-4 flex-none text-muted-foreground transition-[rotate] duration-150 ease-out group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="mt-1 flex flex-col rounded-md border border-border p-1">
          {visible.map((tab) => {
            const activa = tab.href === actual?.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={marca(tab.href)}
                className={`rounded-md px-3 py-2 text-[13px] hover:bg-muted ${activa ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </details>

      {/* Desplegado: desde `lg:`, donde las siete entran. El `overflow-x-auto`
          se queda como red de seguridad: ahí entran, pero un rótulo nuevo más
          largo no puede volver a desbordarse en silencio — `html` recorta el
          eje X sin barra. */}
      <div className="relative hidden lg:block">
        <div className="flex gap-6 overflow-x-auto border-b border-border">
          {visible.map((tab) => {
            const activa = tab.href === actual?.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={marca(tab.href)}
                className={`flex-none pb-3 text-[13px] whitespace-nowrap ${activa ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {/* Decorativo: la única pista de que hay más pestañas si alguna vez no
            entran. Sin él, la última visible se ve simplemente cortada. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </nav>
  );
}
