import { FileText } from "lucide-react";
import { kindOfMime } from "@/lib/media-kind";
import type { Attachment } from "@/lib/conectados/queries";

export function AttachmentGallery({ attachments }: { attachments: (Attachment & { url: string })[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className={`grid gap-1.5 overflow-hidden rounded-md ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((a, i) => {
        const kind = kindOfMime(a.mimeType);
        if (kind === "imagen") {
          // aspect-square, no aspect-video: la mayoría de fotos que se suben
          // desde un teléfono son retrato o cuadradas — forzar 16:9 (la
          // proporción de un video, no de una foto) recortaría de más el
          // contenido vertical. El video de abajo usa el MISMO aspect-square
          // (no su 16:9 nativo) a propósito: en una grilla de 2 columnas, una
          // foto cuadrada junto a un video 16:9 en la misma fila queda con
          // celdas de alturas distintas y desalineadas.
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, con TTL de 1h: <Image> de Next la cachearía más allá de su vencimiento.
          return <img key={i} src={a.url} alt={a.name} className="aspect-square w-full object-cover" />;
        }
        if (kind === "video") {
          return <video key={i} src={a.url} controls className="aspect-square w-full object-cover" />;
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{a.name}</span>
          </a>
        );
      })}
    </div>
  );
}
