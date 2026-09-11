"use client";

import { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { getInitials } from "@/lib/profile/initials";
import { cn } from "@/lib/utils";

/**
 * La foto de una persona, en cualquier lugar donde aparezca: encabezado,
 * publicaciones y comentarios de Conectados, seguimientos de un candidato,
 * lista de usuarios, centro de errores y la propia pantalla de "Mi cuenta".
 *
 * Un solo componente a propósito: antes cada pantalla repetía su propio
 * `<img>` con su propio tamaño, su propio color de respaldo y su propia
 * forma de sacar la inicial (una hacía `slice(0, 2)` sobre el nombre
 * completo, otra usaba `getInitials`), así que la misma persona se veía
 * distinta según dónde. El respaldo (inicial sobre el verde de marca) es el
 * que ya usaba el encabezado, el único lugar con un tratamiento decidido.
 *
 * `next/image` y no un `<img>` suelto: los dos orígenes posibles de la foto
 * (el bucket público de Storage y la foto de la cuenta de Google) están
 * declarados en `images.remotePatterns` de `next.config.ts`, así que pasan
 * por el optimizador; un `<img>` crudo se saltearía ese redimensionado y
 * bajaría la foto a tamaño completo para pintarla de 28px.
 */
export function Avatar({
  name,
  src,
  size = 36,
  label,
  className,
}: {
  name: string;
  src: string | null | undefined;
  /** Lado en px: define el tamaño que se le pide al optimizador y la caja,
   * esta última convertida a `rem` para que escale si alguien agranda la
   * tipografía del navegador (las clases `size-*` que había antes eran rem;
   * fijarlo en px dejaba el avatar quieto mientras el texto de al lado crecía). */
  size?: number;
  /**
   * Texto para lectores de pantalla. Se omite en la mayoría de los usos a
   * propósito: el nombre de la persona está escrito al lado, así que anunciar
   * la foto lo repetiría. Solo se pasa donde la foto ES el contenido y no hay
   * nombre que la explique — hoy, la pantalla de "Mi cuenta".
   */
  label?: string;
  className?: string;
}) {
  // `next/image` NO degrada solo: una URL fuera de `remotePatterns` revienta
  // el render en desarrollo y devuelve 400 en producción, mientras que el
  // `<img>` crudo que había antes pintaba cualquier cosa. Las dos fuentes
  // reales están declaradas, pero la copia congelada de un post viejo puede
  // traer cualquier host de otra época — ante un fallo se cae a la inicial,
  // que es exactamente lo que se vería si no hubiera foto.
  //
  // Se guarda la URL QUE FALLÓ, no un booleano: con un booleano, subir una
  // foto nueva después de un fallo dejaba el respaldo pegado (el componente
  // ocupa el mismo lugar del árbol, así que React conserva su estado) y la
  // foto nueva no aparecía hasta recargar la página entera.
  const [urlRota, setUrlRota] = useState<string | null>(null);
  const lado = `${size / 16}rem`;
  const base = "flex-none overflow-hidden rounded-full";
  const iniciales = getInitials(name);

  if (src && src !== urlRota) {
    return (
      <Image
        src={src}
        alt={label ?? ""}
        width={size}
        height={size}
        style={{ width: lado, height: lado }}
        onError={() => setUrlRota(src)}
        className={cn(base, "object-cover", className)}
      />
    );
  }

  return (
    <span
      // Sin nombre que lo explique al lado, el respaldo tiene que decir algo;
      // con nombre al lado es decorativo y se oculta para no repetirlo.
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      style={{ width: lado, height: lado, fontSize: `${Math.max(10, Math.round(size * 0.36)) / 16}rem` }}
      className={cn(base, "flex items-center justify-center bg-primary font-medium text-primary-foreground", className)}
    >
      {/* `getInitials` devuelve "" con un `display_name` vacío o que arranca
          con espacios — un estado real en esta base (ver el filtro de
          `resolveMentions`). Sin este ícono quedaba un círculo verde vacío. */}
      {iniciales === "" ? <User className="size-[55%]" aria-hidden /> : iniciales}
    </span>
  );
}
