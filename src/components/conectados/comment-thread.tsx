"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError } from "@/lib/notifications/toast";
import { addComment, deleteComment, listComments } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { useMentionState } from "./mention-overlay";
import { MentionText } from "./mention-text";
import { ReactionBar } from "./reaction-bar";
import type { FeedComment, Reactions } from "@/lib/conectados/queries";
import type { ReactionType } from "@/lib/conectados/schema";

type CommentRow = {
  id: string;
  organization_id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  author_title: string | null;
  author_avatar_url: string | null;
  body: string;
  mentions: string[];
  reactions: Reactions;
  created_at: string;
  updated_at: string | null;
};

export function CommentThread({ postId }: { postId: string }) {
  const { viewer, mentionable } = useConectados();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const listaId = useId();
  const mention = useMentionState(mentionable);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listComments(postId).then((data) => {
      if (active) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conectados-comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setComments((current) => current.filter((c) => c.id !== (payload.old as { id: string }).id));
            return;
          }
          const row = payload.new as CommentRow;
          setComments((current) => {
            const merged: FeedComment = { ...row, reactions: row.reactions ?? {} };
            if (current.some((c) => c.id === row.id)) return current.map((c) => (c.id === row.id ? merged : c));
            return [...current, merged];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = mention.serialized();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addComment({ postId, body, mentions: mention.mentionIds() });
      if (result.error) {
        notifyError(result.error);
        return;
      }
      if (result.comment) {
        // El dedup se hace DENTRO del actualizador de `setComments`, contra
        // el array más reciente — no contra el `comments` cerrado por este
        // closure. Si el eco de Realtime del propio comentario ya llegó (y
        // ya lo agregó) antes de que esta promesa resuelva, `comments` acá
        // seguiría viendo el array viejo (sin el comentario) y lo
        // duplicaría; el actualizador siempre ve el estado más reciente.
        const newComment = result.comment;
        setComments((current) => (current.some((c) => c.id === newComment.id) ? current : [...current, newComment]));
      }
      mention.reset();
    });
  }

  function toggleOwnReaction(commentId: string, type: ReactionType | null) {
    setComments((current) =>
      current.map((c) => {
        if (c.id !== commentId) return c;
        const reactions = { ...c.reactions };
        if (type === null) delete reactions[viewer.id];
        else reactions[viewer.id] = type;
        return { ...c, reactions };
      }),
    );
  }

  async function handleDeleteComment(commentId: string) {
    // Sin notifyError acá: DeleteButton ya muestra su propio toast genérico
    // si `onDelete` lanza (ver `handleConfirm` en delete-button.tsx) — un
    // segundo `notifyError` acá duplicaría el aviso de error.
    const result = await deleteComment(commentId);
    if (result.error) throw new Error(result.error);
    setComments((current) => current.filter((c) => c.id !== commentId));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando comentarios…</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
              {comment.author_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar externo
                <img src={comment.author_avatar_url} alt="" className="size-full object-cover" />
              ) : (
                comment.author_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs font-semibold">{comment.author_name}</p>
                <p className="text-sm">
                  <MentionText body={comment.body} />
                </p>
              </div>
              <div className="mt-1 flex items-center gap-3 pl-3">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                </span>
                <ReactionBar
                  targetId={comment.id}
                  reactions={comment.reactions}
                  scope="comment"
                  onOptimisticSet={(type) => toggleOwnReaction(comment.id, type)}
                />
                {(comment.author_id === viewer.id || viewer.isAdminOrAbove) && (
                  <DeleteButton
                    itemLabel="este comentario"
                    iconOnly
                    onDelete={() => handleDeleteComment(comment.id)}
                    successMessage="Comentario eliminado"
                    className="size-6"
                  />
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words"
        >
          {mention.segments.map((s, i) =>
            s.esMencion ? (
              <span key={i} className="text-accent">
                {s.texto}
              </span>
            ) : (
              <span key={i}>{s.texto}</span>
            ),
          )}
        </div>
        <textarea
          ref={areaRef}
          rows={1}
          value={mention.body}
          onChange={(e) => {
            mention.handleChange(e.target.value);
            mention.setCursor(e.target.selectionStart);
            mention.setElegido(0);
            mention.setCerrada(false);
          }}
          onKeyUp={(e) => mention.setCursor(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (mention.sugerencias.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                mention.setElegido((i) => (i + 1) % mention.sugerencias.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                mention.setElegido((i) => (i - 1 + mention.sugerencias.length) % mention.sugerencias.length);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mention.insertMention(mention.sugerencias[mention.elegido] ?? mention.sugerencias[0], areaRef);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                mention.setCerrada(true);
                return;
              }
            }
          }}
          placeholder="Escribe un comentario… (@ para mencionar)"
          role="combobox"
          aria-expanded={mention.sugerencias.length > 0}
          aria-controls={listaId}
          className="relative w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-transparent caret-foreground placeholder:text-muted-foreground"
        />
        {mention.sugerencias.length > 0 && (
          <Card
            as="ul"
            id={listaId}
            role="listbox"
            aria-label="Personas que puedes mencionar"
            className="absolute z-10 mt-1 w-full max-w-xs rounded-md"
          >
            {mention.sugerencias.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === mention.elegido}
                onMouseDown={(e) => {
                  e.preventDefault();
                  mention.insertMention(m, areaRef);
                }}
                className={`cursor-pointer px-3 py-2 text-[13px] ${i === mention.elegido ? "bg-muted" : ""}`}
              >
                {m.display_name}
              </li>
            ))}
          </Card>
        )}
        <ActionButton type="submit" pending={isPending} className="mt-2 h-8 px-4 text-xs">
          Comentar
        </ActionButton>
      </form>
    </div>
  );
}
