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

export const BRAND_MEDIA_FIELDS = [
  "logo_url",
  "login_image_url",
  "careers_cover_image_url",
  "login_video_url",
  "careers_cover_video_url",
] as const;
export type BrandMediaField = (typeof BRAND_MEDIA_FIELDS)[number];

/**
 * La extensión sale de esta tabla, NUNCA del nombre del archivo que manda el
 * cliente — un nombre como "x.png/../../otro-campo" no debe poder alterar la
 * ruta de Storage.
 *
 * Sin SVG a propósito: el bucket es público y sirve el archivo tal cual, sin
 * CSP propio, así que un SVG con `<script>` se ejecutaría al abrir su URL
 * directa. El bucket tampoco lo acepta (migración `marca_publico_sin_svg`).
 */
export const BRAND_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export type BrandFieldSpec = {
  kind: "imagen" | "video";
  /** Los MIME admitidos para ESTE campo. También arma el `accept` del input. */
  mimeTypes: string[];
  maxBytes: number;
  /**
   * Nombre del archivo en Storage, sin extensión. No siempre coincide con la
   * columna: `login_video_url` usa el stem `login_video` porque ya hay videos
   * subidos bajo esa ruta y renombrarlo los dejaría huérfanos.
   */
  stem: string;
};

const MB = 1024 * 1024;
const IMAGEN_MIMES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm"];

export const BRAND_FIELD_SPEC: Record<BrandMediaField, BrandFieldSpec> = {
  logo_url: { kind: "imagen", mimeTypes: IMAGEN_MIMES, maxBytes: 5 * MB, stem: "logo_url" },
  login_image_url: { kind: "imagen", mimeTypes: IMAGEN_MIMES, maxBytes: 5 * MB, stem: "login_image_url" },
  careers_cover_image_url: {
    kind: "imagen",
    mimeTypes: IMAGEN_MIMES,
    maxBytes: 5 * MB,
    stem: "careers_cover_image_url",
  },
  login_video_url: { kind: "video", mimeTypes: VIDEO_MIMES, maxBytes: 20 * MB, stem: "login_video" },
  careers_cover_video_url: {
    kind: "video",
    mimeTypes: VIDEO_MIMES,
    maxBytes: 20 * MB,
    stem: "careers_cover_video",
  },
};

/**
 * Prefijo de todas las versiones de un campo dentro de la carpeta de la
 * organización: `logo_url-`, `login_video-`, …
 *
 * La ruta lleva un uuid al final (`{org}/{stem}-{uuid}.{ext}`) y NO se
 * sobrescribe nunca. Antes era fija y se subía con `upsert: true`, y eso tenía
 * dos agujeros: (a) el archivo bueno quedaba pisado apenas empezaba una subida
 * nueva, así que cualquier fallo posterior —de red, de permisos, de la propia
 * confirmación— dejaba la imagen REEMPLAZADA en vivo mientras la pantalla
 * decía que no se había guardado; y (b) rechazar el archivo después de subirlo
 * obligaba a borrar esa ruta, que era justo la que la columna estaba
 * referenciando: el logo quedaba en 404 en todo el producto. Con una ruta
 * nueva por subida, lo guardado no se toca hasta que la columna apunta al
 * archivo nuevo, y recién ahí se limpian las versiones viejas.
 */
export function brandMediaPrefix(field: BrandMediaField): string {
  return `${BRAND_FIELD_SPEC[field].stem}-`;
}

/** Extensiones válidas de un campo, para validar una ruta ya generada. */
export function brandMediaExtensions(field: BrandMediaField): string[] {
  return BRAND_FIELD_SPEC[field].mimeTypes.map((mime) => BRAND_EXTENSION_BY_MIME[mime]);
}

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
    hint: "Mínimo 240 px de ancho.",
    uploaded: "Logo actualizado",
    removed: "Logo eliminado",
    confirm: "Se quitará de la plataforma hasta que subas uno nuevo.",
  },
  login_image_url: {
    label: "Imagen del inicio de sesión",
    hint: "Recomendado 1200 × 1600 px, vertical.",
    uploaded: "Imagen del inicio de sesión actualizada",
    removed: "Imagen del inicio de sesión eliminada",
    confirm: "Se quitará de la plataforma hasta que subas una nueva.",
  },
  login_video_url: {
    label: "Video del inicio de sesión",
    hint: "Reemplaza a la imagen de fondo si subes uno — se reproduce en bucle, sin sonido. Ideal 10-15 segundos.",
    uploaded: "Video del inicio de sesión actualizado",
    removed: "Video del inicio de sesión eliminado",
    confirm: "Se quitará y volverá la imagen del inicio de sesión.",
  },
  careers_cover_image_url: {
    label: "Foto de portada",
    hint: "Recomendado 1920 × 1080 px o más ancho, horizontal.",
    uploaded: "Foto de portada actualizada",
    removed: "Foto de portada eliminada",
    confirm: "Se quitará de la plataforma hasta que subas una nueva.",
  },
  careers_cover_video_url: {
    label: "Video de portada",
    hint: "Reemplaza a la foto de portada si subes uno — se reproduce en bucle, sin sonido. Ideal 10-15 segundos.",
    uploaded: "Video de portada actualizado",
    removed: "Video de portada eliminado",
    confirm: "Se quitará de la plataforma y volverá la foto de portada.",
  },
};

/** Los tres motivos por los que un archivo se rechaza antes de subir. Viven
 * acá, junto a la spec que los decide, y los usan por igual el componente y
 * la Server Action — escritos por separado, el tope en texto ("5 MB") se
 * desincronizaba de `maxBytes` sin que nada avisara. */
export function brandRejectionMessage(field: BrandMediaField, motivo: "formato" | "tamano" | "vacio"): string {
  const spec = BRAND_FIELD_SPEC[field];
  const esVideo = spec.kind === "video";
  if (motivo === "vacio") return "Ese archivo está vacío. Elige otro.";
  if (motivo === "formato") {
    return esVideo ? "Formato no admitido. Usa MP4 o WebM." : "Formato no admitido. Usa PNG, JPG o WebP.";
  }
  const mb = Math.round(spec.maxBytes / (1024 * 1024));
  return esVideo
    ? `El video pesa más de ${mb} MB. Usa uno más corto o comprímelo.`
    : `La imagen pesa más de ${mb} MB. Prueba con una más liviana.`;
}

/** La pista que ve el usuario, con los formatos y el tope sacados de la spec
 * en vez de escritos a mano — si `maxBytes` cambia, la pantalla cambia con él.
 * Antes el número vivía en el texto y podía quedar prometiendo un tope que el
 * servidor ya no aplicaba. */
export function brandFieldHint(field: BrandMediaField): string {
  const spec = BRAND_FIELD_SPEC[field];
  const mb = Math.round(spec.maxBytes / (1024 * 1024));
  const formatos = spec.kind === "video" ? "MP4 o WebM" : "PNG, JPG o WebP";
  return `${formatos}, máx. ${mb} MB. ${BRAND_FIELD_COPY[field].hint}`;
}
