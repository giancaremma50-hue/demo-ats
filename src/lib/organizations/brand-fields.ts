/**
 * Listas blancas de campos de marca y TODA su copia, en un solo lugar.
 *
 * Vive fuera de `actions.ts` por una restricción de React: un módulo
 * "use server" solo puede exportar funciones async, así que un `Record` no
 * puede salir de ahí — y la etiqueta, la pista y el texto de confirmación de
 * borrado los necesita el cliente.
 *
 * Un registro por campo y no la copia repartida entre la página, el toast y
 * el diálogo: cuando estaban separados ya se habían desincronizado (el
 * diálogo decía "¿Eliminar foto de portada de la bolsa de empleo?" y el toast
 * siguiente "Foto de portada eliminada", dos nombres para lo mismo).
 *
 * Los mensajes están escritos uno por uno, sin plantilla: **la concordancia
 * de género no se puede interpolar.** El componente armaba
 * `` `${label} actualizado` `` y con etiquetas femeninas eso salía
 * "Imagen del inicio de sesión actualizado". Encontrado el 2026-09-11 al
 * quitar el campo del logo oscuro, que era la única etiqueta masculina y
 * tapaba el problema.
 */

export const BRAND_IMAGE_FIELDS = ["logo_url", "login_image_url", "careers_cover_image_url"] as const;
export type BrandImageField = (typeof BRAND_IMAGE_FIELDS)[number];

export const BRAND_VIDEO_FIELDS = ["login_video_url", "careers_cover_video_url"] as const;
export type BrandVideoField = (typeof BRAND_VIDEO_FIELDS)[number];

export type BrandMediaField = BrandImageField | BrandVideoField;

export type BrandFieldCopy = {
  /** Etiqueta visible. El diálogo de borrado la reusa en minúsculas. */
  label: string;
  /** Debajo del campo. Nombra los formatos que el servidor realmente acepta. */
  hint: string;
  /** Lo devuelve la mutación al subir (regla de interacción 2). */
  uploaded: string;
  /** Lo devuelve la mutación al quitar. */
  removed: string;
  /** Segunda línea del diálogo de confirmación: qué pasa si se confirma. */
  confirm: string;
};

export const BRAND_FIELD_COPY: Record<BrandMediaField, BrandFieldCopy> = {
  logo_url: {
    label: "Logo",
    hint: "PNG, JPG o WebP, mínimo 240 px de ancho",
    uploaded: "Logo actualizado",
    removed: "Logo eliminado",
    confirm: "Se quitará de la plataforma hasta que subas uno nuevo.",
  },
  login_image_url: {
    label: "Imagen del inicio de sesión",
    hint: "Recomendado 1200 × 1600 px, vertical",
    uploaded: "Imagen del inicio de sesión actualizada",
    removed: "Imagen del inicio de sesión eliminada",
    confirm: "Se quitará de la plataforma hasta que subas una nueva.",
  },
  login_video_url: {
    label: "Video del inicio de sesión",
    hint: "Reemplaza a la imagen de fondo si subes uno — se reproduce en bucle, sin sonido. MP4 o WebM, máx. 20 MB, ideal 10-15 segundos.",
    uploaded: "Video del inicio de sesión actualizado",
    removed: "Video del inicio de sesión eliminado",
    confirm: "Se quitará y volverá la imagen del inicio de sesión.",
  },
  careers_cover_image_url: {
    label: "Foto de portada",
    hint: "Recomendado 1920 × 1080 px o más ancho, horizontal",
    uploaded: "Foto de portada actualizada",
    removed: "Foto de portada eliminada",
    confirm: "Se quitará de la plataforma hasta que subas una nueva.",
  },
  careers_cover_video_url: {
    label: "Video de portada",
    hint: "Reemplaza a la foto de portada si subes uno — se reproduce en bucle, sin sonido. MP4 o WebM, máx. 20 MB, ideal 10-15 segundos.",
    uploaded: "Video de portada actualizado",
    removed: "Video de portada eliminado",
    confirm: "Se quitará de la plataforma y volverá la foto de portada.",
  },
};
