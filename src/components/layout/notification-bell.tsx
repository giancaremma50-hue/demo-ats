"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Bell } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "./notification-item";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/get-notifications";

type NotificationRow = {
  id: string;
  type: NotificationItemType["type"];
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

/** Extraído del efecto para poder abrirlo y cerrarlo (pestaña oculta) sin repetir los dos `.on()`. */
function subscribeToNotifications(
  supabase: SupabaseClient<Database>,
  profileId: string,
  setItems: Dispatch<SetStateAction<NotificationItemType[]>>,
  setUnreadCount: Dispatch<SetStateAction<number>>,
) {
  return supabase
    .channel(`notifications:${profileId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profileId}` },
      (payload) => {
        const row = payload.new as NotificationRow;
        setItems((current) =>
          [
            {
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              url: row.url,
              readAt: row.read_at,
              createdAt: row.created_at,
            },
            ...current,
          ].slice(0, 8),
        );
        setUnreadCount((count) => count + 1);
      },
    )
    .on(
      // markAsRead/markAllAsRead solo tocan filas con read_at aún null (ver
      // mark-read-actions.ts), así que cada UPDATE que llega aquí es
      // siempre una transición real de no-leída a leída — sin esto, el
      // badge se queda desactualizado en cuanto el usuario marca como
      // leído desde /notificaciones, ya que ese layout no se remonta al
      // navegar del lado del cliente.
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${profileId}` },
      (payload) => {
        const row = payload.new as NotificationRow;
        if (!row.read_at) return;
        setItems((current) => {
          const existing = current.find((i) => i.id === row.id);
          // Si ya estaba marcada como leída en este mismo cliente (clic
          // local que ya descontó el badge de forma optimista), el eco de
          // Realtime no debe volver a descontar.
          if (!existing || !existing.readAt) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
          return existing ? current.map((i) => (i.id === row.id ? { ...i, readAt: row.read_at } : i)) : current;
        });
      },
    )
    .subscribe();
}

export function NotificationBell({
  profileId,
  initialItems,
  initialUnreadCount,
}: {
  profileId: string;
  initialItems: NotificationItemType[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    // Se cierra el canal con la pestaña oculta y se reabre al volver — sin
    // esto, cada pestaña de fondo mantenía su WebSocket de Realtime abierto
    // sin ningún uso real. Al reabrir no se recupera lo que haya llegado
    // mientras tanto (Realtime no reproduce eventos pasados); es el mismo
    // costo aceptado que ya tiene cualquier recarga de página. Hallado en
    // la auditoría de performance.
    let channel: ReturnType<typeof subscribeToNotifications> | null = null;

    function handleVisibilityChange() {
      if (document.hidden) {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      } else if (!channel) {
        channel = subscribeToNotifications(supabase, profileId, setItems, setUnreadCount);
      }
    }

    if (!document.hidden) channel = subscribeToNotifications(supabase, profileId, setItems, setUnreadCount);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [profileId]);

  function handleItemRead(id: string) {
    setItems((current) =>
      current.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        data-tour="bell"
        className="relative flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <Card className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin notificaciones todavía.</p>
            ) : (
              items.map((item) => (
                <NotificationItem key={item.id} item={item} onRead={() => handleItemRead(item.id)} />
              ))
            )}
          </div>
          <a
            href="/notificaciones"
            className="block border-t border-border p-3 text-center text-xs text-accent underline"
          >
            Ver todas
          </a>
        </Card>
      )}
    </div>
  );
}
