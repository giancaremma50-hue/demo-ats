export type MediaKind = "imagen" | "video" | "archivo";

/**
 * Qué es un archivo a ojos de la interfaz, según su MIME. Una sola definición
 * para todo el producto: el compositor clasifica lo que se VA a subir y
 * `AttachmentGallery` lo que YA se subió — con una cadena de `startsWith` en
 * cada uno, el mismo adjunto podía verse distinto antes y después de
 * publicarlo.
 *
 * En un módulo sin "use client" a propósito: una función exportada desde un
 * archivo "use client" se convierte en una referencia de cliente, y llamarla
 * desde un componente de servidor no funciona.
 */
export function kindOfMime(mimeType: string): MediaKind {
  if (mimeType.startsWith("image/")) return "imagen";
  if (mimeType.startsWith("video/")) return "video";
  return "archivo";
}
