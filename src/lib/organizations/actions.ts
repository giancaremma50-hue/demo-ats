"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { contrastRatio } from "@/lib/color-contrast";
import { zodFieldError } from "@/lib/forms/zod-error";
import { optionalText } from "@/lib/zod-helpers";
import { randomUUID } from "node:crypto";
import {
  BRAND_MEDIA_FIELDS,
  BRAND_FIELD_COPY,
  BRAND_FIELD_SPEC,
  BRAND_EXTENSION_BY_MIME,
  brandMediaPrefix,
  brandMediaExtensions,
  brandRejectionMessage,
  type BrandMediaField,
} from "./brand-fields";

// El fondo claro de la app (--background en globals.css). El foco de
// teclado se dibuja con este mismo acento (--ring: var(--accent)) — un
// color demasiado parecido al fondo lo vuelve invisible para cualquiera
// que navegue con teclado, violando la regla "foco visible siempre".
const APP_BACKGROUND = "#faf9f7";
const MIN_FOCUS_CONTRAST = 3; // mínimo WCAG para indicadores de UI/foco.

const BrandingSchema = z.object({
  platform_name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(60),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "El color debe ser un hexadecimal válido, ej. #1F4D3D." })
    .refine((hex) => contrastRatio(hex, APP_BACKGROUND) >= MIN_FOCUS_CONTRAST, {
      error: "Este color es muy parecido al fondo: el foco de teclado no se vería. Prueba uno más oscuro o más saturado.",
    }),
});

// Las leyendas de la bolsa pública se guardan aparte desde que la bolsa dejó
// de vivir dentro del configurador general (ver `/bolsa`): son dos pantallas
// distintas, así que son dos formularios y dos acciones. Mandarlas juntas
// obligaba a que cada una reenviara los campos de la otra.
const CareersSchema = z.object({
  careers_headline: optionalText(120),
  careers_intro: optionalText(500),
});

export type BrandingActionState = { error?: string; success?: string; field?: string } | undefined;

export async function updateBranding(
  _prevState: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const profile = await requireSuperAdmin();

  const parsed = BrandingSchema.safeParse({
    platform_name: formData.get("platform_name"),
    accent_color: formData.get("accent_color"),
  });

  if (!parsed.success) {
    return zodFieldError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo guardar. Inténtalo de nuevo en unos segundos." };
  }

  // Las tres superficies: `platform_name` y `accent_color` se pintan también
  // en /login y en /empleos, no solo en el layout de la app.
  revalidateBrandSurfaces();
  return { success: "Marca actualizada" };
}

export async function updateCareersContent(
  _prevState: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const profile = await requireSuperAdmin();

  const parsed = CareersSchema.safeParse({
    careers_headline: formData.get("careers_headline"),
    careers_intro: formData.get("careers_intro"),
  });

  if (!parsed.success) {
    return zodFieldError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      // undefined en un .update() de Supabase omite la columna en vez de
      // limpiarla — si el campo se dejó vacío a propósito, hay que mandar
      // null explícito para que sí se borre (mismo gotcha de Fase 9 con
      // normalizeDepartmentFields). `||` y no `??`: optionalText solo
      // convierte "" a undefined ANTES de recortar espacios — un valor de
      // puros espacios sobrevive el preprocess y llega aquí ya recortado a ""
      // (no undefined), que `??` no habría capturado.
      careers_headline: parsed.data.careers_headline || null,
      careers_intro: parsed.data.careers_intro || null,
    })
    .eq("id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo guardar. Inténtalo de nuevo en unos segundos." };
  }

  revalidateBrandSurfaces();
  return { success: "Bolsa de empleo actualizada" };
}

const BrandMediaFieldSchema = z.enum(BRAND_MEDIA_FIELDS);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Toda pantalla que pinta marca, no solo el layout raíz. `/empleos` es ISR
 * (`export const revalidate = 60` en su page) y `/login` se renderiza con la
 * organización: sin nombrarlas, cambiar la portada podía seguir sirviéndose
 * vieja — y después de un borrado, apuntando a un archivo que ya no existe.
 */
function revalidateBrandSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/login");
  revalidatePath("/empleos");
}

/**
 * NINGÚN archivo de marca viaja dentro del cuerpo de una Server Action.
 *
 * Los videos ya iban por URL firmada; las imágenes no, y ahí estaba el bug
 * reportado el 2026-09-11: se elegía el logo, se tocaba "Subir" y no pasaba
 * nada — ni imagen, ni error. Una Server Action es una función serverless, y
 * en Vercel el cuerpo de una petición a una función tiene un tope de ~4.5 MB
 * que `serverActions.bodySizeLimit` de Next NO puede subir (es de la
 * plataforma, no del framework). Una foto o una captura de un teléfono de hoy
 * lo pasa fácil, y cuando eso ocurre la petición se rechaza ANTES de que
 * corra una sola línea de este archivo: `useActionState` nunca cambia de
 * estado, así que no hay ni éxito ni error que mostrar. Silencio.
 *
 * Con URL firmada el navegador sube directo a Storage y el servidor solo
 * autoriza la ruta y confirma. El tope real pasa a ser el del bucket (20 MB),
 * que es el que la interfaz promete.
 */
export type CreateUploadUrlState =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

// Una Server Action es un endpoint invocable por red y sus parámetros son
// entrada del cliente como cualquier otra: el tipo de TypeScript no existe en
// runtime (AGENTS.md, Seguridad: "Validación Zod en cada Server Action").
const CreateUploadInputSchema = z.object({
  field: BrandMediaFieldSchema,
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().finite(),
});
const ConfirmUploadInputSchema = z.object({
  field: BrandMediaFieldSchema,
  path: z.string().min(1).max(300),
});

export async function createBrandUploadUrl(
  fieldInput: BrandMediaField,
  mimeType: string,
  sizeBytes: number,
): Promise<CreateUploadUrlState> {
  const profile = await requireSuperAdmin();

  const parsed = CreateUploadInputSchema.safeParse({ field: fieldInput, mimeType, sizeBytes });
  if (!parsed.success) return { ok: false, error: "Campo de marca inválido." };
  const { field } = parsed.data;
  const spec = BRAND_FIELD_SPEC[field];

  if (!spec.mimeTypes.includes(parsed.data.mimeType)) {
    return { ok: false, error: brandRejectionMessage(field, "formato") };
  }
  // Vacío y demasiado grande son dos problemas distintos y merecen dos
  // mensajes distintos: "pesa más de 5 MB" sobre un archivo de 0 bytes dice
  // justo lo contrario de lo que pasó (regla de interacción 5).
  if (parsed.data.sizeBytes <= 0) return { ok: false, error: brandRejectionMessage(field, "vacio") };
  if (parsed.data.sizeBytes > spec.maxBytes) return { ok: false, error: brandRejectionMessage(field, "tamano") };

  // Ruta nueva en cada subida (ver `brandMediaPrefix`): lo que está publicado
  // no se toca hasta que la columna apunte al archivo nuevo.
  const extension = BRAND_EXTENSION_BY_MIME[parsed.data.mimeType];
  const path = `${profile.organization_id}/${brandMediaPrefix(field)}${randomUUID()}.${extension}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("marca-publico").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida. Inténtalo de nuevo." };

  return { ok: true, path: data.path, token: data.token };
}

export type ConfirmUploadState = { error?: string; success?: string } | undefined;

export async function confirmBrandUpload(fieldInput: BrandMediaField, path: string): Promise<ConfirmUploadState> {
  const profile = await requireSuperAdmin();

  const parsed = ConfirmUploadInputSchema.safeParse({ field: fieldInput, path });
  if (!parsed.success) return { error: "Campo de marca inválido." };
  const { field } = parsed.data;
  const spec = BRAND_FIELD_SPEC[field];

  // La ruta tiene que ser una que ESTE servidor generó para ESTA organización
  // y ESTE campo: `{org}/{stem}-{uuid}.{ext}`. Se valida con operaciones de
  // string y no armando un RegExp con datos de entrada adentro.
  const carpeta = profile.organization_id;
  const archivo = parsed.data.path.startsWith(`${carpeta}/`) ? parsed.data.path.slice(carpeta.length + 1) : null;
  const prefijo = brandMediaPrefix(field);
  if (!archivo || archivo.includes("/") || !archivo.startsWith(prefijo)) {
    return { error: "Ruta de archivo inválida." };
  }
  const punto = archivo.lastIndexOf(".");
  if (punto <= 0) return { error: "Ruta de archivo inválida." };
  if (!UUID_RE.test(archivo.slice(prefijo.length, punto))) return { error: "Ruta de archivo inválida." };
  if (!brandMediaExtensions(field).includes(archivo.slice(punto + 1))) {
    return { error: "Ruta de archivo inválida." };
  }

  const supabase = await createClient();

  // El tamaño que se validó al pedir la URL lo declaró el CLIENTE: nada impide
  // pedir permiso para 1 MB y subir 19 MB (el bucket admite 20). Storage es la
  // única fuente de verdad de que el archivo llegó y de cuánto pesa.
  //
  // Ojo con la interpretación del resultado: si la consulta FALLA (red, 5xx)
  // NO se puede concluir que el archivo no llegó — descartarlo ahí perdería
  // una subida buena y dejaría un huérfano. Solo una respuesta correcta y
  // vacía prueba que no está. Y `search` es coincidencia parcial: hay que
  // exigir el nombre exacto.
  const { data: objetos, error: listError } = await supabase.storage
    .from("marca-publico")
    .list(carpeta, { search: archivo });
  const subido = objetos?.find((o) => o.name === archivo);
  if (!listError && !subido) return { error: "El archivo no llegó completo. Inténtalo de nuevo." };

  // `metadata.size` ausente = no verificable, NO cero: tratarlo como 0 dejaba
  // pasar cualquier tamaño con la verificación puesta y sin dejar rastro.
  const tamanoReal = subido?.metadata?.size;
  if (typeof tamanoReal === "number" && tamanoReal > spec.maxBytes) {
    // Se puede borrar sin miedo porque la ruta es nueva: nada la referencia
    // todavía, y lo que está publicado sigue en su propia ruta.
    await supabase.storage.from("marca-publico").remove([parsed.data.path]);
    return { error: brandRejectionMessage(field, "tamano") };
  }

  const { data: publicUrl } = supabase.storage.from("marca-publico").getPublicUrl(parsed.data.path);

  const update: Partial<Record<BrandMediaField, string>> = { [field]: publicUrl.publicUrl };
  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", profile.organization_id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { error: "El archivo se subió pero no se pudo guardar. Inténtalo de nuevo." };
  }

  // Recién con la columna apuntando al archivo nuevo se limpian las versiones
  // anteriores del mismo campo. Best-effort: si falla, quedan objetos
  // huérfanos en el bucket, que es inofensivo — nada los referencia.
  await removeOtherVersions(supabase, carpeta, field, archivo);

  revalidateBrandSurfaces();
  return { success: BRAND_FIELD_COPY[field].uploaded };
}

/** Borra todas las versiones de un campo salvo la que se indique. Con
 * `conservar` en `null` las borra todas (al quitar el archivo del campo). */
async function removeOtherVersions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  carpeta: string,
  field: BrandMediaField,
  conservar: string | null,
) {
  const prefijo = brandMediaPrefix(field);
  const { data: objetos } = await supabase.storage.from("marca-publico").list(carpeta, { search: prefijo });
  const sobrantes = (objetos ?? [])
    .filter((o) => o.name.startsWith(prefijo) && o.name !== conservar)
    .map((o) => `${carpeta}/${o.name}`);
  if (sobrantes.length > 0) await supabase.storage.from("marca-publico").remove(sobrantes);
}

export async function removeBrandMedia(fieldInput: BrandMediaField): Promise<string> {
  const profile = await requireSuperAdmin();

  const parsedField = BrandMediaFieldSchema.safeParse(fieldInput);
  if (!parsedField.success) throw new Error("Campo de marca inválido.");
  const field = parsedField.data;

  const supabase = await createClient();

  // La base se actualiza primero: si esto falla, nunca se toca Storage y el
  // campo sigue apuntando a un archivo que sigue existiendo. Al revés, un
  // remove() fallido después de guardar solo deja un archivo huérfano —
  // inofensivo, nada lo referencia ya.
  const update: Partial<Record<BrandMediaField, null>> = { [field]: null };
  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", profile.organization_id)
    .select("id");
  if (error || !data || data.length === 0) throw new Error("No se pudo quitar el archivo.");

  await removeOtherVersions(supabase, profile.organization_id, field, null);

  revalidateBrandSurfaces();
  return BRAND_FIELD_COPY[field].removed;
}
