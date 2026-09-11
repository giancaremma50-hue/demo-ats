"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MODULES, activeModuleFor, isModulelessPath, settingsItemFor, type NavItem } from "@/lib/modules";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];

/**
 * Un ítem de la barra. Ícono siempre; la etiqueta solo cuando está activo y
 * hay ancho — es lo más ancho de la barra y en un teléfono se come el lugar
 * que necesitan el selector y el engranaje. En móvil el fondo blanco alcanza
 * para marcar dónde estás, y el nombre del módulo ya está en el selector.
 */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      // Sin barras: una ruta anidada (`/conectados/ajustes`) daría
      // `nav-conectados/ajustes`, que ningún selector del tour encuentra.
      data-tour={`nav-${item.href.slice(1).replaceAll("/", "-")}`}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className="group relative flex h-11 flex-none items-center gap-2 rounded-full px-2 text-sm font-medium sm:px-4"
    >
      {active && (
        <motion.span
          layoutId="floating-nav-indicator"
          className="absolute inset-0 rounded-full bg-background"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {/* Tinta oscura sobre el color de la barra, no blanco al 60%: blanco
          sobre el verde AJE da 1.9:1 y sobre el naranja de Conectados menos
          todavía — y son los destinos de navegación, no adorno. Activo va
          sobre la píldora clara, así que ahí manda `text-foreground`. */}
      <span className={`relative flex items-center gap-2 ${active ? "text-foreground" : "text-aje-dark/80"}`}>
        <Icon className="size-[18px]" strokeWidth={2.5} aria-hidden />
        {active && <span className="hidden sm:inline">{item.label}</span>}
      </span>
      {!active && (
        <span
          role="tooltip"
          // z-10: sin esto, el indicador activo (bg-background opaco) de un
          // ítem vecino puede pintarse encima y recortar visualmente este
          // tooltip cuando es más ancho que su propio botón.
          className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

function Separador() {
  return <span className="mx-0.5 h-5 w-px flex-none bg-aje-dark/20" aria-hidden />;
}

/**
 * Menú principal flotante: acompaña la pantalla sin invadirla. Se oculta al
 * bajar y reaparece al subir. Nunca una sidebar.
 *
 * Composición `[⊞ Nombre] · [Home] [submenús] · [⚙]` — ver el comentario de
 * `src/lib/modules.ts` para por qué el nombre vive dentro del selector y por
 * qué esos tres son anclas que no desaparecen.
 */
export function FloatingNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const activeModule = activeModuleFor(pathname);
  const items = activeModule.itemsForRole(role);
  const settings = settingsItemFor(activeModule, role);
  const sinModulo = isModulelessPath(pathname);
  const [visible, setVisible] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY.current && y > 80;
        // Cerrar el selector de módulos al ocultar el nav: el Popover se
        // desmonta con <motion.nav> pero `switcherOpen` vive en este
        // componente (nunca se desmonta) — sin este reset, el Popover
        // controlado vuelve a montar con open=true al reaparecer el nav,
        // reabriéndose solo sin que nadie lo haya tocado.
        if (goingDown) setSwitcherOpen(false);
        setVisible(!goingDown);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // El ítem activo es el de la ruta MÁS ESPECÍFICA que coincide, no el
  // primero: con `/conectados` (Home) y un hipotético `/conectados/ajustes`
  // los dos coincidirían por prefijo y se montarían dos elementos con el
  // mismo `layoutId`, que framer-motion no sabe resolver.
  const candidatos = [...items, ...(settings ? [settings] : [])];
  const hrefActivo = candidatos
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center"
        >
          {/* `overflow-x-auto` como red de seguridad, no como diseño: con el
              nombre del módulo y 4 ítems la barra ronda los 360px y entra en
              un teléfono de 390, pero en uno de 320 se recortaría contra el
              borde. Así se desliza en vez de cortarse. El Popover del selector
              se renderiza en un portal, así que este overflow no lo recorta. */}
          {/* `overflow-x-auto` SOLO en móvil: con el nombre del módulo la barra
              ronda los 350px y entra en un teléfono de 390, pero en uno de 320
              se recortaría contra el borde; así se desliza en vez de cortarse.
              En `sm+` vuelve a `visible` porque un contenedor con overflow
              recorta también el eje vertical, y ahí viven los tooltips —que
              son la única etiqueta de los íconos— justo arriba de la píldora.
              El Popover del selector se renderiza en un portal, así que ese no
              lo recorta ningún overflow. */}
          <div
            style={{ backgroundColor: activeModule.accentColor }}
            className="flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full p-1.5 shadow-nav [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          >
            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger asChild>
                {/* Tinta oscura y no blanco: es el primer TEXTO sobre el color
                    de la barra, y blanco sobre el verde AJE da 2.8:1 — por
                    debajo de lo legible, justo en el elemento que tiene que
                    decirte dónde estás, y en un teléfono al sol. `--aje-dark`
                    es el mismo valor en los dos temas, y los dos fondos
                    posibles son claros: 6.5:1 sobre `#00b348`, 9.4:1 sobre el
                    `#2fd66f` del tema oscuro, 6.7:1 sobre el naranja. */}
                <button
                  type="button"
                  aria-label={
                    sinModulo ? "Cambiar de módulo" : `Módulo actual: ${activeModule.label}. Cambiar de módulo`
                  }
                  className="flex h-11 flex-none items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-aje-dark hover:bg-aje-dark/10 sm:px-3"
                >
                  <LayoutGrid className="size-[18px]" strokeWidth={2.5} aria-hidden />
                  {/* El nombre del módulo, el ancla que dice dónde estás — y
                      por eso mismo no aparece donde sería falso decirlo (ver
                      `isModulelessPath`). */}
                  {!sinModulo && <span>{activeModule.shortLabel}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-64">
                <div className="flex flex-col gap-1">
                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const isActive = mod.id === activeModule.id;
                    return (
                      <Link
                        key={mod.id}
                        href={mod.basePath}
                        onClick={() => setSwitcherOpen(false)}
                        className="flex items-center gap-3 rounded-lg p-2 text-sm font-medium hover:bg-muted"
                      >
                        {/* Misma tinta que la barra: el verde del tema oscuro
                            (`#2fd66f`) deja un ícono blanco en 1.8:1, y ese
                            ícono es lo único que distingue una fila de la
                            otra. */}
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-aje-dark"
                          style={{ backgroundColor: mod.accentColor }}
                        >
                          <Icon className="size-4" strokeWidth={2.5} aria-hidden />
                        </span>
                        {mod.label}
                        {isActive && <span className="ml-auto size-1.5 rounded-full bg-foreground" aria-hidden />}
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Separador />

            {items.map((item) => (
              <NavLink key={item.href} item={item} active={item.href === hrefActivo} />
            ))}

            {settings && (
              <>
                <Separador />
                <NavLink item={settings} active={settings.href === hrefActivo} />
              </>
            )}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
