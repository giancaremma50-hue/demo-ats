"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import type { FeedPost, Poll, Reactions, AudienceDepartment } from "@/lib/conectados/queries";
import type { Database } from "@/lib/supabase/database.types";
import type { ConectadosViewer, MentionableProfile } from "./types";

type AppRole = Database["public"]["Enums"]["app_role"];

type ConectadosContextValue = {
  viewer: ConectadosViewer;
  departments: AudienceDepartment[];
  mentionable: MentionableProfile[];
};

const ConectadosContext = createContext<ConectadosContextValue | null>(null);

/** Cualquier componente bajo `<ConectadosFeed>` (compositor, tarjeta,
 * comentarios) llama esto en vez de recibir los mismos 3 datos por props en
 * cada nivel — son de solo lectura para toda la sesión del feed. */
export function useConectados(): ConectadosContextValue {
  const ctx = useContext(ConectadosContext);
  if (!ctx) throw new Error("useConectados debe usarse dentro de <ConectadosFeed>");
  return ctx;
}

type PostRow = {
  id: string;
  organization_id: string;
  author_id: string | null;
  author_name: string;
  author_title: string;
  author_avatar_url: string | null;
  department_id: string | null;
  roles: AppRole[] | null;
  publish_at: string | null;
  content: string;
  attachments: unknown;
  poll: Poll | null;
  reactions: Reactions;
  mentions: string[];
  edited: boolean;
  created_at: string;
};

function mergePost(current: FeedPost[], incoming: PostRow): FeedPost[] {
  const existing = current.find((p) => p.id === incoming.id);
  // Un post que llega por Realtime nunca trae `attachments` con URL firmada
  // (esa hidratación es server-side) — se conserva la lista de adjuntos que
  // el cliente ya tenía y solo se actualizan los campos que Realtime sí
  // trae completos y al día (reacciones, poll, contenido).
  const attachments = existing?.attachments ?? [];
  const merged: FeedPost = { ...incoming, attachments, poll: incoming.poll ?? null, reactions: incoming.reactions ?? {} };
  if (!existing) return [merged, ...current].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return current.map((p) => (p.id === incoming.id ? merged : p));
}

export function ConectadosFeed({
  initialPosts,
  viewer,
  departments,
  mentionable,
}: {
  initialPosts: FeedPost[];
  viewer: ConectadosViewer;
  departments: AudienceDepartment[];
  mentionable: MentionableProfile[];
}) {
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conectados:${viewer.organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `organization_id=eq.${viewer.organizationId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setPosts((current) => current.filter((p) => p.id !== (payload.old as { id: string }).id));
            return;
          }
          setPosts((current) => mergePost(current, payload.new as PostRow));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewer.organizationId]);

  function handleCreated(post: FeedPost) {
    setPosts((current) => (current.some((p) => p.id === post.id) ? current : [post, ...current]));
  }

  function handleDeleted(postId: string) {
    setPosts((current) => current.filter((p) => p.id !== postId));
  }

  return (
    <ConectadosContext.Provider value={{ viewer, departments, mentionable }}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-6">
        {viewer.canPost && <PostComposer onCreated={handleCreated} />}
        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones. {viewer.canPost ? "Sé la primera persona en publicar algo." : ""}
          </p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)
        )}
      </div>
    </ConectadosContext.Provider>
  );
}
