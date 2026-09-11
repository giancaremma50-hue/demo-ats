import { useState } from "react";
import { activeMentionQuery, buildMentionToken } from "@/lib/mentions";
import { normalizarTexto } from "@/lib/utils";
import type { MentionableProfile } from "./types";

export type MentionRange = { start: number; end: number; nombre: string; profileId: string };

/** Mismo algoritmo que `NoteForm` (ver `.claude/napkin.md`, entradas de
 * 2026-09-09 sobre el overlay de menciones): una mención que se solapa con
 * un tramo editado se descarta, nunca queda apuntando a texto que ya no
 * dice ese nombre. */
export function adjustMentions(
  mentions: MentionRange[],
  oldStart: number,
  oldEnd: number,
  newLength: number,
): MentionRange[] {
  const delta = newLength - (oldEnd - oldStart);
  const result: MentionRange[] = [];
  for (const m of mentions) {
    if (m.end <= oldStart) result.push(m);
    else if (m.start >= oldEnd) result.push({ ...m, start: m.start + delta, end: m.end + delta });
  }
  return result;
}

export function changedRange(before: string, after: string): { oldStart: number; oldEnd: number; newLength: number } {
  const maxCommon = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxCommon && before[prefix] === after[prefix]) prefix++;
  const maxSuffix = Math.min(before.length - prefix, after.length - prefix);
  let suffix = 0;
  while (suffix < maxSuffix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return { oldStart: prefix, oldEnd: before.length - suffix, newLength: after.length - suffix - prefix };
}

export function serializeMentions(body: string, mentions: MentionRange[]): string {
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const m of sorted) {
    out += body.slice(cursor, m.start);
    out += buildMentionToken(m.nombre, m.profileId);
    cursor = m.end;
  }
  out += body.slice(cursor);
  return out;
}

const MAX_SUGGESTIONS = 6;

/**
 * Todo el estado del textarea-con-overlay (referencia: `NoteForm`,
 * `src/components/postulaciones/note-form.tsx`) en un hook para no
 * reescribirlo en cada formulario nuevo que necesite @menciones.
 */
export function useMentionState(candidates: MentionableProfile[]) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionRange[]>([]);
  const [cursor, setCursor] = useState(0);
  const [elegido, setElegido] = useState(0);
  const [cerrada, setCerrada] = useState(false);

  const activa = cerrada ? null : activeMentionQuery(body, cursor);
  const q = activa ? normalizarTexto(activa.query) : "";
  const sugerencias =
    activa === null ? [] : candidates.filter((c) => normalizarTexto(c.display_name).includes(q)).slice(0, MAX_SUGGESTIONS);

  function handleChange(nuevoBody: string) {
    const { oldStart, oldEnd, newLength } = changedRange(body, nuevoBody);
    setMentions((prev) => adjustMentions(prev, oldStart, oldEnd, newLength));
    setBody(nuevoBody);
  }

  function insertMention(m: MentionableProfile | undefined, areaRef: React.RefObject<HTMLTextAreaElement | null>) {
    if (!m || !activa) return;
    const nombreLimpio = m.display_name.replace(/[[\]()]/g, "").trim();
    const oldStart = activa.desde;
    const oldEnd = cursor;
    const nuevoBody = `${body.slice(0, oldStart)}${nombreLimpio} ${body.slice(oldEnd)}`;
    const fin = oldStart + nombreLimpio.length;
    setMentions((prev) => [
      ...adjustMentions(prev, oldStart, oldEnd, nombreLimpio.length + 1),
      { start: oldStart, end: fin, nombre: nombreLimpio, profileId: m.id },
    ]);
    setBody(nuevoBody);
    setElegido(0);
    const posicion = fin + 1;
    requestAnimationFrame(() => {
      areaRef.current?.setSelectionRange(posicion, posicion);
      areaRef.current?.focus();
      setCursor(posicion);
    });
  }

  function reset() {
    setBody("");
    setMentions([]);
    setCursor(0);
    setElegido(0);
    setCerrada(false);
  }

  const segments: { texto: string; esMencion: boolean }[] = [];
  {
    const ordered = [...mentions].sort((a, b) => a.start - b.start);
    let cur = 0;
    for (const m of ordered) {
      if (m.start > cur) segments.push({ texto: body.slice(cur, m.start), esMencion: false });
      segments.push({ texto: body.slice(m.start, m.end), esMencion: true });
      cur = m.end;
    }
    if (cur < body.length) segments.push({ texto: body.slice(cur), esMencion: false });
  }

  return {
    body,
    mentions,
    sugerencias,
    elegido,
    segments,
    setCursor,
    setElegido,
    setCerrada,
    handleChange,
    insertMention,
    reset,
    serialized: () => serializeMentions(body, mentions),
    mentionIds: () => mentions.map((m) => m.profileId),
  };
}
