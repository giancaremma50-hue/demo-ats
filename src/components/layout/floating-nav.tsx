"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MODULES, activeModuleFor } from "@/lib/modules";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];

/**
 * Menú principal flotante: acompaña la pantalla sin invadirla. Se oculta al
 * bajar y reaparece al subir. Nunca una sidebar.
 */
export function FloatingNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const activeModule = activeModuleFor(pathname);
  const items = activeModule.itemsForRole(role);
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
          {/* max-w + los tamaños reducidos de abajo: con 5 ítems (el tope de
              AGENTS.md) la píldora medía ~406px y en un teléfono de 390px se
              recortaba por los dos lados, dejando el selector de módulos y
              Ajustes cortados contra el borde. */}
          <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 rounded-full bg-primary p-1.5 shadow-nav">
            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Cambiar de módulo"
                  className="flex h-11 w-9 flex-none items-center justify-center rounded-full text-primary-foreground/70 hover:bg-white/10 sm:w-11"
                >
                  <LayoutGrid className="size-[18px]" strokeWidth={2.5} aria-hidden />
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
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white"
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

            <div className="mx-0.5 h-5 w-px bg-white/25" aria-hidden />

            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={`nav-${item.href.slice(1)}`}
                  aria-label={item.label}
                  className="group relative flex h-11 flex-none items-center gap-2 rounded-full px-3 text-sm font-medium sm:px-4"
                >
                  {active && (
                    <motion.span
                      layoutId="floating-nav-indicator"
                      className="absolute inset-0 rounded-full bg-background"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={`relative flex items-center gap-2 ${active ? "text-foreground" : "text-primary-foreground/60"}`}
                  >
                    <Icon className="size-[18px]" strokeWidth={2.5} aria-hidden />
                    {active && <span className="hidden sm:inline">{item.label}</span>}
                  </span>
                  {!active && (
                    <span
                      role="tooltip"
                      // z-10: sin esto, el indicador activo (bg-background
                      // opaco) de un ítem vecino puede pintarse encima y
                      // recortar visualmente este tooltip cuando es más
                      // ancho que su propio botón (ej. "Candidatos").
                      className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
