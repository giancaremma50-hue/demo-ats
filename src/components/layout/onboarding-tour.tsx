"use client";

import { useEffect } from "react";
import { markTutorialSeen } from "@/lib/profile/tutorial-actions";

/**
 * Los pasos se filtran por si el elemento existe en el DOM, no por rol —
 * FloatingNav ya decide qué ítems renderiza según el rol; duplicar esa lógica
 * aquí solo crearía una segunda fuente de verdad que se desincroniza con el
 * tiempo.
 *
 * **Pero ese filtro se come en silencio lo que no esté en la pantalla donde el
 * tour arranca** — y esa pantalla no está garantizada: este componente se monta
 * en `(app)/layout.tsx`, así que corre en la primera ruta autenticada que
 * cargue, que puede ser `/inicio`, un enlace a `/postulaciones/<id>` desde una
 * notificación, o `/conectados`. Desde el 2026-09-13 la barra tampoco muestra
 * lo mismo en todas: las pantallas de un módulo aparecen solo dentro de ese
 * módulo. Apuntarle a `nav-vacantes` era pedir un elemento que en media app no
 * existe: el paso se descartaba sin avisar y `markTutorialSeen()` lo daba por
 * visto para siempre.
 *
 * **La regla que queda: un paso solo puede apuntar a algo que esté en TODA ruta
 * autenticada** — las tres anclas de la barra, la campana y Mi cuenta. Nunca a
 * un submenú de módulo.
 */
const STEP_DEFS: { selector: string; title: string; description: string }[] = [
  { selector: '[data-tour="nav-inicio"]', title: "Inicio", description: "Un resumen rápido de tu actividad." },
  {
    selector: '[data-tour="nav-modulos"]',
    title: "Tus módulos",
    // Describe al BOTÓN, no a lo que guarda: driver.js lo ilumina con el
    // popover cerrado, así que prometer "acá están las vacantes" señalaría un
    // ícono y hablaría de algo que no está en pantalla.
    description: "Tocá acá para moverte entre Reclutamiento y AJE Conectados, y entre sus pantallas.",
  },
  {
    selector: '[data-tour="nav-configuracion"]',
    // "Ajustes", como lo llaman el engranaje de la barra y el título de la
    // pantalla a la que lleva (AGENTS.md, regla 11).
    title: "Ajustes",
    description: "Marca, usuarios y el centro de errores viven aquí.",
  },
  { selector: '[data-tour="bell"]', title: "Notificaciones", description: "Avisos en tiempo real de lo que te toca." },
  {
    selector: '[data-tour="mi-cuenta"]',
    title: "Mi cuenta",
    description: "Cambia tu foto de perfil y tus preferencias de notificación.",
  },
];

export function OnboardingTour({ hasSeenTutorial }: { hasSeenTutorial: boolean }) {
  useEffect(() => {
    if (hasSeenTutorial) return;

    const steps = STEP_DEFS.filter((s) => document.querySelector(s.selector)).map((s) => ({
      element: s.selector,
      popover: { title: s.title, description: s.description },
    }));
    if (steps.length === 0) return;

    // driver.js (JS + CSS) solo se descarga si el tour de verdad va a
    // correr — antes se importaba estático acá, así que TODA ruta
    // autenticada lo cargaba aunque el tour ya se hubiera visto una vez
    // (el caso normal). Hallado en la auditoría de performance.
    let cancelado = false;
    Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]).then(([{ driver }]) => {
      if (cancelado) return;

      const tour = driver({
        showProgress: true,
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        doneBtnText: "Listo",
        steps: [
          {
            popover: {
              title: "Bienvenido a Talento AJE",
              description: "Un recorrido de un minuto antes de empezar. Puedes cerrarlo cuando quieras.",
            },
          },
          ...steps,
        ],
        // Se marca al cerrar el tour de cualquier forma (terminarlo o
        // saltarlo) — no solo al completar el último paso — para que a
        // nadie le vuelva a aparecer en su siguiente visita.
        onDestroyed: () => {
          markTutorialSeen();
        },
      });

      tour.drive();
    });

    return () => {
      cancelado = true;
    };
  }, [hasSeenTutorial]);

  return null;
}
