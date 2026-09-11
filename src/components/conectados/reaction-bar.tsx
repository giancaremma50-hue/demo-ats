"use client";

import { useTransition } from "react";
import { Flame, Heart, PartyPopper, ThumbsUp } from "lucide-react";
import { toggleReaction, toggleCommentReaction } from "@/lib/conectados/actions";
import { notifyError } from "@/lib/notifications/toast";
import { useConectados } from "./conectados-feed";
import type { ReactionType } from "@/lib/conectados/schema";
import type { Reactions } from "@/lib/conectados/queries";

const REACTION_ICON: Record<ReactionType, typeof ThumbsUp> = {
  like: ThumbsUp,
  corazon: Heart,
  aplauso: PartyPopper,
  fuego: Flame,
};

/**
 * Reacción: toggle de baja fricción, sin `notifySuccess` (el propio ícono
 * resaltado ya confirma — un toast por cada "me gusta" sería ruido, no
 * información). El cambio se aplica en el ESTADO DEL PADRE
 * (`onOptimisticToggle`) antes de esperar la respuesta del servidor: la
 * actualización autoritativa llega después por Realtime (`posts`/
 * `post_comments` UPDATE) y siempre pisa este valor optimista.
 */
export function ReactionBar({
  targetId,
  reactions,
  scope,
  onOptimisticToggle,
}: {
  targetId: string;
  reactions: Reactions;
  scope: "post" | "comment";
  onOptimisticToggle: (type: ReactionType) => void;
}) {
  const { viewer } = useConectados();
  const [, startTransition] = useTransition();
  const mine = reactions[viewer.id] as ReactionType | undefined;

  const counts = Object.values(reactions).reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  function handleClick(type: ReactionType) {
    onOptimisticToggle(type);
    startTransition(async () => {
      const action = scope === "post" ? toggleReaction : toggleCommentReaction;
      const result = await action(targetId, type);
      if (result.error) {
        notifyError(result.error);
        onOptimisticToggle(type); // revertir el toggle optimista
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(REACTION_ICON) as ReactionType[]).map((type) => {
        const Icon = REACTION_ICON[type];
        const active = mine === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleClick(type)}
            aria-pressed={active}
            className={`flex size-7 items-center justify-center rounded-full ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="size-3.5" strokeWidth={active ? 2.5 : 2} aria-hidden />
          </button>
        );
      })}
      {Object.keys(counts).length > 0 && (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {Object.values(counts).reduce((a, b) => a + b, 0)}
        </span>
      )}
    </div>
  );
}
