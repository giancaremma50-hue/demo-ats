"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError } from "@/lib/notifications/toast";
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
  const [commentsOpen, setCommentsOpen] = useState(false);

  const canDelete = post.author_id === viewer.id || viewer.isAdminOrAbove;
  const audienceLabel = post.department_id
    ? (departments.find((d) => d.id === post.department_id)?.name ?? "un departamento")
    : null;

  function toggleOwnReaction(type: ReactionType) {
    setPost((p) => {
      const mine = p.reactions[viewer.id];
      const reactions = { ...p.reactions };
      if (mine === type) delete reactions[viewer.id];
      else reactions[viewer.id] = type;
      return { ...p, reactions };
    });
  }

  function applyPollVote(optionIndex: number) {
    setPost((p) => {
      if (!p.poll) return p;
      const options = p.poll.options.map((o, i) => {
        const votes = o.votes.filter((v) => v !== viewer.id);
        if (i === optionIndex) votes.push(viewer.id);
        return { ...o, votes };
      });
      return { ...p, poll: { options } as Poll };
    });
  }

  async function handleDelete() {
    const result = await deletePost(post.id);
    if (result.error) {
      notifyError(result.error);
      throw new Error(result.error);
    }
    onDeleted(post.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
          {post.author_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, mismo patrón que el resto de la app
            <img src={post.author_avatar_url} alt="" className="size-full object-cover" />
          ) : (
            post.author_name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="text-sm font-semibold">{post.author_name}</p>
            {audienceLabel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Solo {audienceLabel}
              </span>
            )}
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
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
        <ReactionBar targetId={post.id} reactions={post.reactions} scope="post" onOptimisticToggle={toggleOwnReaction} />
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
