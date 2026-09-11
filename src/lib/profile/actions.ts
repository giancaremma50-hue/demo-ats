"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  AVATAR_EXTENSION_BY_MIME,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarRejectionMessage,
} from "./avatar-fields";

// Sin SVG a propósito, mismo motivo que las imágenes de marca: el bucket es
// público y sirve el archivo tal cual, sin CSP propio. Los límites y los
// mensajes viven en `avatar-fields.ts` porque los comparte el cliente.
const EXTENSION_BY_MIME = AVATAR_EXTENSION_BY_MIME;
const ALLOWED_TYPES = new Set(AVATAR_MIME_TYPES);

function avatarPaths(profileId: string) {
  return Object.values(EXTENSION_BY_MIME).map((ext) => `${profileId}/avatar.${ext}`);
}

// El texto de confirmación lo devuelve la mutación, no lo arma el cliente
// (regla de interacción 2).
export type UploadAvatarState = { error?: string; success?: string } | undefined;

export async function uploadAvatar(_prevState: UploadAvatarState, formData: FormData): Promise<UploadAvatarState> {
  const profile = await requireProfile();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "Selecciona una foto primero." };
  }
  if (file.size === 0) {
    return { error: avatarRejectionMessage("vacio") };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: avatarRejectionMessage("tamano") };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: avatarRejectionMessage("formato") };
  }

  const supabase = await createClient();
  const extension = EXTENSION_BY_MIME[file.type];
  const path = `${profile.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatares")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return { error: "No se pudo subir la foto. Inténtalo de nuevo." };
  }

  const { data: publicUrl } = supabase.storage.from("avatares").getPublicUrl(path);
  // Cache-busting: sin esto, el navegador (y cualquier <Image> ya cacheada)
  // seguiría mostrando la foto vieja aunque el archivo en Storage ya haya
  // cambiado — la URL pública en sí es siempre la misma ruta.
  const cacheBusted = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: cacheBusted })
    .eq("id", profile.id);
  if (updateError) {
    return { error: "La foto se subió pero no se pudo guardar. Inténtalo de nuevo." };
  }

  // Limpieza best-effort: si el formato cambió (ej. .jpg -> .png), el
  // archivo anterior queda huérfano en otra ruta porque upsert solo
  // sobrescribe una ruta idéntica.
  const stalePaths = avatarPaths(profile.id).filter((p) => p !== path);
  await supabase.storage.from("avatares").remove(stalePaths);

  revalidatePath("/", "layout");
  return { success: "Foto de perfil actualizada" };
}

export async function removeAvatar(): Promise<string> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
  if (error) throw new Error("No se pudo quitar la foto.");

  await supabase.storage.from("avatares").remove(avatarPaths(profile.id));
  revalidatePath("/", "layout");
  return "Foto de perfil eliminada";
}
