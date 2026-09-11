"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImageUp, Loader2, Video } from "lucide-react";
import { kindOfMime, type MediaKind } from "@/lib/media-kind";
import { cn } from "@/lib/utils";

/**
 * La miniatura de un archivo — lo único que hace falta para que alguien
 * confirme de un vistazo QUÉ está a punto de subir. Compartida entre el
 * cuadro de subida de un solo archivo (`MediaPicker`) y la lista de adjuntos
 * del compositor de Conectados: dos interacciones distintas sobre la misma
 * necesidad.
 */
export function MediaThumb({
  url,
  kind,
  local = false,
  fit = "contain",
  sizes = "96px",
  fallback,
  className,
}: {
  url: string | null;
  kind: MediaKind;
  /** `true` para un `blob:` del archivo recién elegido en este navegador. */
  local?: boolean;
  /** `cover` donde el recorte es lo que se va a ver después (avatar). */
  fit?: "contain" | "cover";
  sizes?: string;
  /** Qué pintar cuando no hay nada que mostrar. Por defecto, un ícono. */
  fallback?: React.ReactNode;
  className?: string;
}) {
  // `next/image` NO degrada: una URL fuera de `remotePatterns` (la foto de
  // Google de una cuenta vieja, una URL de marca de otra época) revienta el
  // render en desarrollo y devuelve 400 en producción. Se guarda la URL QUE
  // FALLÓ y no un booleano — con un booleano, elegir otro archivo después de
  // un fallo dejaba el respaldo pegado. Mismo patrón que `<Avatar>`.
  const [urlFallida, setUrlFallida] = useState<string | null>(null);
  const Icono = kind === "video" ? Video : kind === "archivo" ? FileText : ImageUp;
  const roto = url !== null && url === urlFallida;

  if (!url || roto || kind === "archivo") {
    return (
      <span className={cn("flex items-center justify-center", className)}>
        {fallback ?? <Icono className="size-5 text-muted-foreground" aria-hidden />}
      </span>
    );
  }

  if (kind === "video") {
    // `preload="metadata"` pinta el primer fotograma sin bajar el video
    // entero; sin controles ni sonido — acá es una miniatura, no un
    // reproductor.
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        aria-hidden
        onError={() => setUrlFallida(url)}
        className={cn("object-cover", className)}
      />
    );
  }

  if (local) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob: del archivo recién elegido en este navegador: no hay nada que optimizar ni host que declarar en remotePatterns.
      <img
        src={url}
        alt=""
        onError={() => setUrlFallida(url)}
        className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
      />
    );
  }

  return (
    <span className={cn("relative block", className)}>
      <Image
        src={url}
        alt=""
        fill
        sizes={sizes}
        onError={() => setUrlFallida(url)}
        className={fit === "cover" ? "object-cover" : "object-contain"}
      />
    </span>
  );
}

/**
 * Un solo cuadro que es a la vez la vista previa y el selector de archivo.
 *
 * Reemplaza al par "miniatura decorativa + `<input type=file>` nativo" que
 * había en cada punto de subida: eran dos controles que parecían dos botones
 * distintos, y el nativo solo mostraba el NOMBRE del archivo elegido — nadie
 * podía verificar que había elegido la imagen correcta antes de guardarla
 * (reportado por el usuario el 2026-09-11).
 *
 * Cómo funciona:
 * - El `<input type="file">` es `sr-only` (nunca `hidden`: `display:none` lo
 *   saca del orden de tabulación y deja el campo inalcanzable por teclado) y
 *   sigue siendo el control real. El cuadro es su `<label>`, así que un clic
 *   en cualquier parte abre el diálogo, y el foco se ve con el anillo del
 *   contenedor (`focus-within:ring`).
 * - El nombre accesible sale de `aria-label`, NO del texto del `<label>`: el
 *   cuadro contiene la pista y el estado ("Sin guardar: foto.jpg"), y sin el
 *   `aria-label` ese bloque entero se convertía en el nombre del control y
 *   cambiaba cada vez que se elegía un archivo.
 * - Al elegir un archivo, el cuadro muestra ESE archivo y `onSelect` dispara
 *   la subida en el acto — no hay un segundo botón que se pueda olvidar. El
 *   estado `pending` que exige la regla de interacción 1 lo muestra el propio
 *   cuadro (`status="subiendo"`: spinner, `aria-busy`, input deshabilitado).
 * - Para vaciarlo (un archivo rechazado, un borrado), quien lo usa lo remonta
 *   con un `key` nuevo. Al guardar BIEN no se remonta: la vista previa local
 *   se queda hasta que la revalidación traiga la URL nueva, porque limpiarla
 *   de una deja el cuadro vacío justo después de guardar.
 * - El `value` del input se limpia en cada cambio: sin eso, volver a elegir
 *   EL MISMO archivo (después de que lo rechazaran, o para reemplazar una
 *   foto corregida con el mismo nombre) no dispara `change` y el cuadro se
 *   vuelve un clic muerto.
 */
export function MediaPicker({
  label,
  labelHidden = false,
  hint,
  accept,
  currentUrl,
  kind = "imagen",
  shape = "rect",
  fallback,
  describedBy,
  status = "idle",
  onSelect,
}: {
  /** Nombre accesible del control y, salvo `labelHidden`, texto visible. */
  label: string;
  /** Para cuando la pantalla ya tiene un encabezado con el mismo nombre. */
  labelHidden?: boolean;
  hint: string;
  accept: string;
  /** Lo que ya está guardado en el servidor, si hay algo. */
  currentUrl: string | null;
  kind?: MediaKind;
  shape?: "rect" | "circle";
  /** Respaldo del cuadro cuando no hay nada guardado ni elegido. */
  fallback?: React.ReactNode;
  /** Ids de textos adicionales que describen el campo (ej. la nota de licencia). */
  describedBy?: string;
  /**
   * El cuadro ES el control que muta: la subida arranca al elegir el archivo,
   * así que el estado `pending` de la regla de interacción 1 se muestra acá y
   * no en un botón aparte. `guardado` mantiene la vista previa local mientras
   * el valor del servidor llega por revalidación — limpiarla de una dejaba el
   * cuadro vacío justo después de guardar, que es exactamente lo que se lee
   * como "no se guardó".
   */
  status?: "idle" | "subiendo" | "guardado";
  onSelect?: (file: File | null) => void;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [elegido, setElegido] = useState<{ file: File; url: string } | null>(null);
  // La URL de objeto se crea y se revoca en el MANEJADOR, nunca en un efecto
  // ni dentro de un actualizador de estado: en este proyecto `setState` en un
  // efecto es error de build, y un actualizador tiene que ser puro. El ref
  // guarda la vigente para revocarla al cambiar de archivo y al desmontar
  // (sin eso, cada archivo elegido queda retenido en memoria).
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function elegir(file: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setElegido(file && urlRef.current ? { file, url: urlRef.current } : null);
    onSelect?.(file);
  }

  const previewUrl = elegido?.url ?? currentUrl;
  const previewKind: MediaKind = elegido ? kindOfMime(elegido.file.type) : kind;
  const subiendo = status === "subiendo";

  return (
    <label
      htmlFor={inputId}
      aria-busy={subiendo}
      className={cn(
        "flex items-center gap-3.5 rounded-md border border-dashed border-border bg-background p-3.5",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        subiendo ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "relative flex flex-none items-center justify-center overflow-hidden border border-border bg-muted",
          shape === "circle" ? "size-16 rounded-full" : "h-16 w-24 rounded-md",
        )}
      >
        {subiendo && (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin text-foreground" aria-hidden />
          </span>
        )}
        <MediaThumb
          url={previewUrl}
          kind={previewKind}
          local={Boolean(elegido)}
          // En redondo el recorte manda: es exactamente lo que se va a ver
          // después en el encabezado y en las publicaciones. Una vista previa
          // con bandas grises prometería una foto completa que nadie verá.
          fit={shape === "circle" ? "cover" : "contain"}
          fallback={fallback}
          className="size-full"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {!labelHidden && (
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</span>
        )}
        <span id={hintId} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </span>
        {/* El estado del cuadro en palabras: sin esto, "elegido pero sin
            guardar" y "ya guardado" se ven igual — la misma imagen en el
            mismo lugar. */}
        <span aria-live="polite" className="truncate text-xs font-medium text-foreground">
          {subiendo
            ? "Subiendo…"
            : status === "guardado"
              ? "Guardado"
              : elegido
                ? `Sin guardar: ${elegido.file.name}`
                : currentUrl
                  ? "Elegir otro archivo"
                  : "Elegir un archivo"}
        </span>
      </span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={subiendo}
        aria-label={label}
        aria-describedby={describedBy ? `${hintId} ${describedBy}` : hintId}
        onChange={(e) => {
          elegir(e.target.files?.[0] ?? null);
          // Ver el comentario de arriba: sin esto, reelegir el mismo archivo
          // no dispara `change`. El `File` ya quedó capturado por `elegir`.
          e.target.value = "";
        }}
        className="sr-only"
      />
    </label>
  );
}
