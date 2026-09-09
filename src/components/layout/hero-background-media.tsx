"use client";

import { useLayoutEffect, useState } from "react";
import Image from "next/image";

/**
 * `prefers-reduced-motion` es una regla no negociable de AGENTS.md — un
 * video en bucle autoplay no puede ignorarla. Cuando el visitante lo pide,
 * cae a la foto de fondo (si hay una) en vez de reproducir el video.
 */
export function HeroBackgroundMedia({
  videoUrl,
  imageUrl,
  priority = false,
}: {
  videoUrl: string | null;
  imageUrl: string | null;
  /** Solo para un hero real (login, bolsa de empleo) — una miniatura de
   * vista previa en /configuracion/marca no está sobre el pliegue y no
   * debe precargarse. */
  priority?: boolean;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);

  // useLayoutEffect, no useEffect: corre antes de que el navegador pinte —
  // reduce a casi cero la ventana en la que un video autoplay alcanzaría a
  // arrancar para alguien con prefers-reduced-motion activado antes de que
  // el componente cambie a la imagen estática. No se puede eliminar del
  // todo sin renderizar distinto en servidor y cliente (el servidor no
  // conoce esta preferencia), así que sigue habiendo una ventana mínima
  // entre el primer pintado y este efecto.
  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Valor genuinamente solo-de-cliente, sin prop de la que depender (el
    // servidor no conoce la preferencia de movimiento del navegador) — no
    // hay forma de leerlo fuera de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  if (videoUrl && !reducedMotion) {
    return (
      <video
        src={videoUrl}
        // La misma imagen de portada (cuando la organización subió una)
        // sirve de cuadro visible mientras el video todavía está bajando —
        // sin esto, la sección se ve vacía sobre el color de fondo hasta que
        // el video carga lo suficiente para pintar su primer frame.
        poster={imageUrl ?? undefined}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 size-full object-cover"
      />
    );
  }

  if (imageUrl) {
    // Hero a todo el ancho del viewport, siempre — sin `sizes`, next/image
    // ignora el viewport real y sirve el tamaño más grande configurado
    // (gasta ancho de banda de más en cada visita a un portal público).
    return <Image src={imageUrl} alt="" fill sizes="100vw" className="object-cover" priority={priority} />;
  }

  return null;
}
