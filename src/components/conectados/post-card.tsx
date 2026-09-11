"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { deletePost } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { MentionText } from "./mention-text";
import { AttachmentGallery } from "./attachment-gallery";
import { ReactionBar } from "./reaction-bar";
import { PollWidget } from "./poll-widget";
import { CommentThread } from "./comment-thread";
import type { FeedPost, Poll } from "@/lib/conectados/queries";
import type { ReactionType } from "@/lib/conectados/schema";

export function PostCard({ post: initialPost, onDeleted }: { post: FeedPost; onDeleted: (id: string) => void }) {
  const { viewer, departments } = useConectados();
  const [post, setPost] = useState(initialPost);
  // `initialPost` cambia de referencia cuando ConectadosFeed mezcla un
  // evento de Realtime para ESTE post (reacción/voto/contenido de OTRO
  // usuario) — sin este ajuste, `useState(initialPost)` solo lee el valor
  // inicial una vez y la tarjeta queda congelada para siempre en lo que
  // tenía al montarse, porque `key={post.id}` es estable y React nunca la
  // vuelve a montar. No pisa el estado optimista propio (reaccionar/votar)
  // porque esas mutaciones locales nunca cambian la referencia de
  // `initialPost` en el padre — solo lo hace un cambio real que sí venga de
  // afuera, que es exactamente cuando debe ganarle al valor optimista.
  // Ajustar estado a partir de un prop DURANTE el render (no en un efecto)
  // es el patrón que React recomienda para esto — un `setState` síncrono
  // dentro de un efecto es además un error de build en este proyecto.
  const [syncedPost, setSyncedPost] = useState(initialPost);
  if (syncedPost !== initialPost) {
    setSyncedPost(initialPost);
    setPost(initialPost);
  }
  const [commentsOpen, setCommentsOpen] = useState(false);

  const canDelete = post.author_id === viewer.id || viewer.isAdminOrAbove;
  // Viene calculado del servidor (o del manejador de Realtime): significa
  // "todavía no lo ve nadie más", que NO es lo mismo que `publish_at != null`
  // — ver el comentario de `FeedPost.scheduled` en queries.ts.
  const scheduled = post.scheduled;
  const audienceLabel = post.department_id
    ? (departments.find((d) => d.id === post.department_id)?.name ?? "un departamento")
    : null;

  function setOwnReaction(type: ReactionType | null) {
    setPost((p) => {
      const reactions = { ...p.reactions };
      if (type === null) delete reactions[viewer.id];
      else reactions[viewer.id] = type;
      return { ...p, reactions };
    });
  }

  function applyPollVote(optionIndex: number | null) {
    setPost((p) => {
      if (!p.poll) return p;
      const options = p.poll.options.map((o, i) => {
        const votes = o.votes.filter((v) => v !== viewer.id);
        if (optionIndex !== null && i === optionIndex) votes.push(viewer.id);
        return { ...o, votes };
      });
      return { ...p, poll: { options } as Poll };
    });
  }

  async function handleDelete() {
    // Sin notifyError acá: DeleteButton ya muestra su propio toast genérico
    // si `onDelete` lanza — un segundo `notifyError` acá duplicaría el aviso.
    const result = await deletePost(post.id);
    if (result.error) throw new Error(result.error);
    onDeleted(post.id);
  }

  return (
    // `overflow-visible` pisa el `overflow-hidden` de `Card`: el desplegable
    // de @menciones del formulario de comentario se posiciona `absolute`
    // dentro de esta tarjeta y quedaba recortado contra su borde. Lo que sí
    // necesita recorte interno (galería de adjuntos, avatar, barras de la
    // encuesta) ya lo trae en su propio contenedor.
    <Card className="flex flex-col gap-3 overflow-visible p-4">
      <div className="flex items-start gap-3">
        <Avatar name={post.author_name} src={post.author_avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="text-sm font-semibold">{post.author_name}</p>
            {audienceLabel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Solo {audienceLabel}
              </span>
            )}
            {scheduled && (
              // Un post programado solo lo ve su autor (posts_select deja
              // pasar al autor siempre) — sin esta insignia se ve idéntico a
              // uno publicado y se lee como que ya salió para todos.
              <span className="rounded-full bg-aje-yellow/20 px-2 py-0.5 text-[10px] font-medium text-foreground">
                Programada
              </span>
            )}
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {/* Fecha absoluta, no relativa: `formatDistanceToNow` sobre una
                fecha ya pasada (programada para hoy a las 13:00, son las
                16:00, el cron diario todavía no corrió) imprimiría el
                absurdo "Se publica hace 3 horas". */}
            {scheduled && post.publish_at
              ? `Se publica el ${format(new Date(post.publish_at), "d 'de' MMMM, HH:mm", { locale: es })}`
              : formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
          </p>
        </div>
        {canDelete && (
          <DeleteButton itemLabel="esta publicación" iconOnly onDelete={handleDelete} successMessage="Publicación eliminada" />
        )}
      </div>

      {post.content && (
        <p className="whitespace-pre-wrap text-sm">
          <MentionText body={post.content} />
        </p>
      )}

      <AttachmentGallery attachments={post.attachments} />
      {post.poll && <PollWidget postId={post.id} poll={post.poll} onOptimisticVote={applyPollVote} />}

      <div className="flex items-center justify-between border-t border-border pt-2">
        <ReactionBar targetId={post.id} reactions={post.reactions} scope="post" onOptimisticSet={setOwnReaction} />
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          Comentarios
        </button>
      </div>

      {commentsOpen && <CommentThread postId={post.id} />}
    </Card>
  );
}
