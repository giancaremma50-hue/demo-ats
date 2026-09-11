import { FileText } from "lucide-react";
import type { Attachment } from "@/lib/conectados/queries";

export function AttachmentGallery({ attachments }: { attachments: (Attachment & { url: string })[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className={`grid gap-1.5 overflow-hidden rounded-md ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((a, i) => {
        if (a.mimeType.startsWith("image/")) {
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, con TTL de 1h: <Image> de Next la cachearía más allá de su vencimiento.
          return <img key={i} src={a.url} alt={a.name} className="aspect-video w-full object-cover" />;
        }
        if (a.mimeType.startsWith("video/")) {
          return <video key={i} src={a.url} controls className="aspect-video w-full" />;
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
