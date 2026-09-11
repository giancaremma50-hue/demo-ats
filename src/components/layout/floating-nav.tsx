"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MODULES, activeModuleFor, isModulelessPath, settingsItemFor, type NavItem } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];

/** Ancho del lomo plegado. */
const ANCHO_PLEGADA = 108;
/** Aire mínimo a los lados de la píldora abierta (8 px a cada lado). */
const AIRE_LATERAL = 16;
/**
 * El padding horizontal de la píldora abierta (`p-1.5` a cada lado). No se lee
 * del DOM a propósito: plegada vale 0 (`p-0`) y una medición hecha en ese
 * momento saldría 12 px corta. Si cambia la clase, cambia esta constante.
 */
const RELLENO = 12;
/**
 * Lo que tarda el contenido en aparecer: 150 ms de espera + 150 de fundido.
 * Es la copia en JS de `delay-150 duration-150` del div del contenido, allá
 * abajo — si una cambia, cambia la otra (hay un comentario gemelo ahí).
 */
const MS_APARICION = 300;

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
 * Menú principal flotante: acompaña la pantalla sin invadirla. Nunca una
 * sidebar.
 *
 * Composición `[⊞ Nombre del módulo] · [Home] [submenús] · [⚙]` — ver el
 * comentario de `src/lib/modules.ts` para por qué el nombre vive dentro del
 * selector y por qué esos tres son anclas que no desaparecen.
 *
 * **Al bajar se PLIEGA, no desaparece** (mockup "Lomo", aprobado el
 * 2026-09-11). Antes se desmontaba entera y no quedaba rastro de que fuera a
 * volver: el usuario reportó que "desapareció". Ahora la misma píldora se
 * contrae a un bloque de 12 px —con su sombra, así que se lee como un objeto
 * cerrado y no como una raya decorativa— y se despliega al subir o al tocarla.
 * Es el MISMO elemento cambiando de tamaño, no otra cosa que aparece en su
 * lugar; por eso tampoco se desmonta.
 */
export function FloatingNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const activeModule = activeModuleFor(pathname);
  const items = activeModule.itemsForRole(role);
  const settings = settingsItemFor(activeModule, role);
  const sinModulo = isModulelessPath(pathname);
  const [plegada, setPlegada] = useState(false);
  // "El contenido se ve y se puede usar", que NO es lo mismo que "no está
  // plegada": al desplegar, el contenido tarda 300 ms en aparecer (espera +
  // fundido). Una sola bandera para las tres cosas que dependen de eso, porque
  // desincronizarlas fue justo lo que rompió el foco:
  //   · `inert` — enlaces invisibles que igual reciben el clic (el mismo clic
  //     con el que se abrió la barra) son peores que un cuarto de segundo sin
  //     poder tocar nada;
  //   · si la píldora puede tener el foco — mientras el contenido no sirve,
  //     ella es lo único de la barra que puede tenerlo;
  //   · cuándo devolverle el foco al contenido.
  const [contenidoListo, setContenidoListo] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const reducido = useReducedMotion();
  const lastY = useRef(0);
  const pastillaRef = useRef<HTMLDivElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  // Adónde mandar el foco en el próximo commit. Se anota SIEMPRE antes de que
  // el commit ocurra, porque después ya no hay nada que preguntar: el
  // navegador suelta en <body> el foco de un elemento que dejó de ser
  // focusable (la regla de "focus fixup" del HTML) sin dejar rastro de dónde
  // estaba. `"pastilla"` lo anota el manejador de scroll al plegar;
  // `"contenido"` el temporizador, justo antes de devolverle la vida a la
  // barra. Cada valor se consume en el efecto siguiente, así que nunca queda
  // uno viejo dando vueltas.
  const focoPendiente = useRef<"pastilla" | "contenido" | null>(null);

  // El ancho abierto se MIDE y se escribe como variable CSS, porque CSS no
  // sabe animar de `auto` a un tamaño fijo: sin un número de partida, la
  // píldora saltaría a los 108 px en vez de contraerse. Se escribe en el DOM
  // (no es `setState`, que en un efecto es error de build acá).
  useEffect(() => {
    const pastilla = pastillaRef.current;
    const contenido = contenidoRef.current;
    if (!pastilla || !contenido) return;

    // Función de expresión y no declarada: TypeScript conserva el estrechamiento
    // de `pastilla`/`contenido` (ya comprobados arriba) en una closure creada
    // después, no en una declaración que se iza sobre la comprobación.
    const medir = () => {
      // `scrollWidth` y no la caja medida: cuando el contenido no cabe se le
      // pone scroll propio (abajo), y desde ahí su caja mide lo que el recorte
      // le deja — medir eso encogería la píldora un poco más en cada vuelta.
      const natural = contenido.scrollWidth + RELLENO;
      const disponible = document.documentElement.clientWidth - AIRE_LATERAL;
      const ancho = `${Math.min(natural, disponible)}px`;

      if (pastilla.style.getPropertyValue("--ancho-abierto") !== ancho) {
        // La transición existe para plegar y desplegar, no para re-medir: sin
        // apagarla, cambiar de pantalla animaría el ancho durante 300 ms con
        // el contenido NUEVO ya pintado, que se vería asomar fuera de la
        // píldora. El `getBoundingClientRect()` de en medio fuerza el
        // recálculo para que el ancho nuevo quede aplicado sin animar.
        pastilla.style.transitionProperty = "none";
        pastilla.style.setProperty("--ancho-abierto", ancho);
        pastilla.getBoundingClientRect();
        pastilla.style.transitionProperty = "";
      }

      // Scroll propio SOLO cuando el contenido no cabe (un teléfono de 320 con
      // el nombre del módulo y cuatro submenús). Nunca por defecto: un
      // contenedor que recorta un eje recorta el otro (CSS Overflow 3), y
      // arriba de la píldora viven los tooltips, que son la única etiqueta de
      // los íconos. Donde no cabe, tampoco hay hover que los muestre.
      const apretada = natural > disponible;
      if ((contenido.dataset.apretada === "true") !== apretada) {
        contenido.dataset.apretada = String(apretada);
      }
    };

    // `ResizeObserver` y no el `resize` de la ventana: el ancho también cambia
    // cuando llega la tipografía (las etiquetas se re-miden), cuando el
    // usuario agranda el texto del navegador y cuando cambia de módulo o de
    // rol — y nada de eso dispara `resize`. `documentElement` cubre el
    // viewport. No hay bucle: se reescribe solo cuando el valor cambió.
    const observer = new ResizeObserver(medir);
    observer.observe(contenido);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Sembrar la posición real: si el navegador restaura el scroll a media
    // página, un `0` de partida haría que el primer gesto hacia arriba se
    // leyera como uno hacia abajo y la barra parpadearía.
    lastY.current = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY.current && y > 80;
        if (goingDown) {
          // Cerrar el selector al plegar: el Popover quedaría abierto sobre
          // una píldora de 12 px, anclado a un disparador que ya no se ve.
          setSwitcherOpen(false);
          setContenidoListo(false);
          // El foco se decide acá, antes del commit. (Con el selector abierto
          // el foco vive en el popover, que es un portal fuera de la barra:
          // ese caso lo atiende `onCloseAutoFocus`.)
          const foco = document.activeElement;
          if (foco instanceof HTMLElement && contenidoRef.current?.contains(foco)) {
            focoPendiente.current = "pastilla";
          }
        }
        setPlegada(goingDown);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // El contenido vuelve a ser usable recién cuando terminó de aparecer. Con
  // `prefers-reduced-motion` no hay fundido que esperar (globals.css deja las
  // transiciones en 0), así que tampoco hay espera. `useReducedMotion` de
  // framer-motion y no un `matchMedia` a mano: ya es dependencia, ya está el
  // `<MotionConfig reducedMotion="user">` del layout raíz, y además se
  // suscribe a los cambios en vez de leer la preferencia una sola vez.
  useEffect(() => {
    if (plegada) return;
    const t = setTimeout(
      () => {
        // Justo antes de que la píldora deje de ser focusable: si tiene el
        // foco, hay que devolverlo adentro. Un tick después ya sería <body>.
        if (document.activeElement === pastillaRef.current) focoPendiente.current = "contenido";
        setContenidoListo(true);
      },
      reducido ? 0 : MS_APARICION,
    );
    return () => clearTimeout(t);
  }, [plegada, reducido]);

  // Los dos movimientos de foco de la barra. `preventScroll` en los dos: la
  // barra es `fixed` y siempre está a la vista, así que no hay nada legítimo
  // que desplazar — y en iOS un foco cerca del borde inferior corre la página
  // unos píxeles, lo que dispara el manejador de scroll y vuelve a plegar la
  // barra recién abierta.
  useEffect(() => {
    if (!contenidoListo) {
      // Al plegar: el contenido queda `inert`, y la píldora es lo único de la
      // barra que puede tener el foco. El que venía de un enlace se queda en
      // ella en vez de caerse a <body>, desde donde la siguiente tabulación
      // arrancaría en el encabezado de la página.
      if (focoPendiente.current === "pastilla") {
        focoPendiente.current = null;
        pastillaRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    // Al terminar de desplegarse: la píldora acaba de dejar de ser focusable
    // (adentro hay enlaces otra vez, y un botón no puede contenerlos), así que
    // el foco que estaba en ella pasa al primer control real — que es además
    // lo que el lector de pantalla anuncia para decir que la barra volvió.
    if (focoPendiente.current !== "contenido") return;
    focoPendiente.current = null;
    contenidoRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
  }, [plegada, contenidoListo]);

  // El ítem activo es el de la ruta MÁS ESPECÍFICA que coincide, no el
  // primero: con `/conectados` (Home) y un hipotético `/conectados/ajustes`
  // los dos coincidirían por prefijo y se montarían dos elementos con el
  // mismo `layoutId`, que framer-motion no sabe resolver.
  const candidatos = [...items, ...(settings ? [settings] : [])];
  const hrefActivo = candidatos
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  function desplegar() {
    if (!plegada) return;
    setPlegada(false);
  }

  return (
    <nav
      aria-label="Menú principal"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      // `bottom-2.5` (10 px) y no los 24 de antes: pedido del usuario, más
      // pegada al pie. Se suma al `safe-area-inset-bottom`, así que en un
      // iPhone con barra de inicio no queda debajo de ella.
      // `pointer-events-none`: la franja ocupa todo el ancho y solo la píldora
      // (y su parche táctil) tienen que recibir el clic — si no, el aire a los
      // lados se traga los toques de lo que haya abajo.
      className="pointer-events-none fixed inset-x-0 bottom-2.5 z-40 flex justify-center"
    >
      {/* `relative` ajustado a la píldora: es el marco contra el que se mide el
          parche táctil de abajo. El tope de ancho va acá, sobre el ítem flex,
          para que el `100%` sea el ancho del <nav> —el mismo
          `documentElement.clientWidth` que usa la medición— y no `100vw`, que
          en un escritorio con barra de scroll clásica es ~15px más. */}
      <div className="relative max-w-[calc(100%-1rem)]">
        {/* Plegada, la píldora ES el botón que la despliega — el mismo objeto,
            no un control aparte. Desplegada no puede serlo: adentro hay
            enlaces, y un botón no puede contenerlos. */}
        <div
          ref={pastillaRef}
          onClick={desplegar}
          onKeyDown={(e) => {
            if (plegada && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              desplegar();
            }
          }}
          // Botón mientras el contenido no sirva, no solo mientras está
          // plegada. Las tres cosas van juntas y con la misma bandera: durante
          // los 300 ms del despliegue, quitarle el `tabIndex` haría que el
          // navegador soltara el foco que está en ella, y dejárselo sin `role`
          // ni nombre deja al lector de pantalla con un elemento anónimo
          // enfocado (WCAG 4.1.2). `aria-expanded` dice la verdad en los dos
          // tramos. Cuando el contenido ya sirve, deja de ser un control: es
          // un contenedor de enlaces, y el foco ya se fue adentro.
          role={contenidoListo ? undefined : "button"}
          tabIndex={contenidoListo ? undefined : 0}
          aria-label={contenidoListo ? undefined : plegada ? "Mostrar el menú" : "Menú"}
          aria-expanded={contenidoListo ? undefined : !plegada}
          style={{
            backgroundColor: activeModule.accentColor,
            width: plegada ? `${ANCHO_PLEGADA}px` : "var(--ancho-abierto, auto)",
          }}
          className={cn(
            "pointer-events-auto flex items-center gap-0.5 rounded-full shadow-nav",
            // Tope en CSS además del que calcula la medición: hasta que hidrate
            // —y para siempre si la hidratación falla— el ancho es `auto`, y en
            // un teléfono de 320 la píldora se sale por los dos lados. Centrada
            // como está, lo que sobra por la izquierda no se puede alcanzar ni
            // con scroll, y ahí vive el selector de módulos.
            "max-w-full",
            // `duration-300` y una curva que frena al final: la píldora se
            // pliega y se abre, no parpadea. `motion-reduce` la deja instantánea.
            "transition-[height,width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            // El recorte solo mientras está plegada. Desplegada tiene que ser
            // `visible`: los tooltips de los íconos viven ARRIBA de la píldora
            // (`-top-9`) y cualquier overflow distinto de `visible` los corta —
            // por CSS Overflow 3, fijar un eje arrastra al otro.
            plegada ? "h-3 cursor-pointer overflow-hidden p-0" : "h-14 overflow-visible p-1.5",
          )}
        >
          {/* `inert` mientras el contenido no se ve: sin esto se puede tabular
              hacia enlaces invisibles de 0 px de alto. El contenido se desvanece
              antes de que la píldora termine de encogerse para que no se vea
              aplastado. */}
          <div
            ref={contenidoRef}
            inert={!contenidoListo}
            className={cn(
              "flex items-center gap-0.5 transition-opacity duration-150 motion-reduce:transition-none",
              // El scroll es el valor POR DEFECTO y la medición lo levanta
              // (`data-apretada="false"`) cuando comprueba que la barra cabe.
              // Al revés no sirve: hasta que hidrate no hay atributo, y en un
              // teléfono de 320 el contenido —que no puede encogerse, sus
              // hijos son `flex-none`— se sale de la píldora y lo recorta el
              // `overflow-x: hidden` del <body>, sin scroll con el que
              // alcanzarlo. Se levanta porque un contenedor que recorta un eje
              // recorta el otro (CSS Overflow 3) y arriba de la píldora viven
              // los tooltips, que son la única etiqueta de los íconos.
              // `scrollbar-width` no existe antes de Safari 18.2 ni de Chrome
              // 121, así que también se esconde la de WebKit: en esos motores
              // se pintaría encima de los íconos.
              "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "data-[apretada=false]:overflow-x-visible",
              // Al plegar se desvanece primero (sin demora) para que no se vea
              // aplastado; al desplegar espera a que la píldora casi terminó de
              // crecer, o el contenido asomaría fuera de una píldora todavía
              // chica. `delay-150 + duration-150` = los `MS_APARICION` de
              // arriba, que es lo que decide cuándo se levanta el `inert`: si
              // cambia esta línea, cambia esa constante.
              plegada ? "opacity-0" : "opacity-100 delay-150",
            )}
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
              <PopoverContent
                side="top"
                align="start"
                className="w-64"
                onCloseAutoFocus={(e) => {
                  // Radix devuelve el foco al disparador. Si la barra se plegó
                  // con el selector abierto, ese disparador quedó `inert` y el
                  // foco se perdería en <body>: se queda en la píldora. La
                  // guardia pregunta por el `inert` del contenido porque es
                  // exactamente la condición que hace focusable a la píldora
                  // (las dos salen de `contenidoListo`) — preguntar por
                  // "plegada" fallaría durante los 300 ms del despliegue, que
                  // es justo cuando el selector puede estar terminando de
                  // cerrarse. Se le pregunta al DOM y no al estado porque esto
                  // corre al desmontar, con el render de entonces.
                  if (!contenidoRef.current?.hasAttribute("inert")) return;
                  e.preventDefault();
                  pastillaRef.current?.focus();
                }}
              >
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
        </div>

        {!contenidoListo && (
          // El lomo mide 12 px de alto: por debajo del mínimo de 24 que pide
          // WCAG 2.5.8 para un destino táctil. Este parche invisible lo lleva a
          // 26 sin cambiar nada de lo que se ve, y va AFUERA de la píldora
          // porque plegada recorta (`overflow-hidden`) cualquier cosa que le
          // cuelgue. No es focusable ni tiene rol: el control accesible sigue
          // siendo la píldora, esto es solo superficie para el dedo.
          // Crece 10 px hacia ABAJO (el aire que la barra ya ocupa) y apenas 4
          // hacia arriba: una franja gruesa por encima del lomo se tragaría los
          // toques de lo último de la página sin que se vea ningún control ahí.
          // Sigue a `contenidoListo` y no a `plegada`: durante los 300 ms del
          // despliegue la barra todavía se ve como un lomo, y desmontarlo en el
          // primer fotograma deja un segundo toque —el que todos damos cuando
          // el primero no parece haber hecho nada— cayendo en la página.
          <span
            aria-hidden
            onClick={desplegar}
            className="pointer-events-auto absolute inset-x-0 -top-1 -bottom-2.5 cursor-pointer"
          />
        )}
      </div>
    </nav>
  );
}
