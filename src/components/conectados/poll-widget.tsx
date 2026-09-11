"use client";

import { useTransition } from "react";
import { votePoll } from "@/lib/conectados/actions";
import { notifyError } from "@/lib/notifications/toast";
import { useConectados } from "./conectados-feed";
import type { Poll } from "@/lib/conectados/queries";

export function PollWidget({
  postId,
  poll,
  onOptimisticVote,
}: {
  postId: string;
  poll: Poll;
  onOptimisticVote: (optionIndex: number) => void;
}) {
  const { viewer } = useConectados();
  const [, startTransition] = useTransition();
  const total = poll.options.reduce((acc, o) => acc + o.votes.length, 0);
  const myVoteIndex = poll.options.findIndex((o) => o.votes.includes(viewer.id));

  function handleVote(index: number) {
    if (index === myVoteIndex) return;
    onOptimisticVote(index);
    startTransition(async () => {
      const result = await votePoll(postId, index);
      if (result.error) notifyError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {poll.options.map((option, i) => {
        const pct = total === 0 ? 0 : Math.round((option.votes.length / total) * 100);
        const mine = i === myVoteIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleVote(i)}
            className="relative w-full overflow-hidden rounded-md border border-border px-3 py-2 text-left text-sm"
          >
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 ${mine ? "bg-accent/25" : "bg-muted"}`}
              style={{ width: `${pct}%` }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className={mine ? "font-semibold" : ""}>{option.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs tabular-nums text-muted-foreground">
        {total} {total === 1 ? "voto" : "votos"}
      </p>
    </div>
  );
}
