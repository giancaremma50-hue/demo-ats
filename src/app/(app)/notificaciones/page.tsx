import { requireProfile } from "@/lib/auth/dal";
import { getAllNotifications } from "@/lib/notifications/get-notifications";
import { NotificationItem } from "@/components/layout/notification-item";
import { MarkAllReadButton } from "@/components/layout/mark-all-read-button";
import { Card } from "@/components/ui/card";

export default async function NotificacionesPage() {
  await requireProfile();
  const notifications = await getAllNotifications();

  return (
    <div>
      {/* `flex-wrap` + `gap`: el título es una sola palabra y no envuelve,
          así que sin esto el control de la derecha se iba fuera de la
          pantalla — y `html` recorta el eje X sin barra. El `min-w-0` va
          con `break-words`: solo, deja que el título se recorte en silencio
          en vez de desbordarse. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 font-black tracking-display text-[32px] break-words">Notificaciones</h1>
        {/* `shrink-0`: el botón no puede encogerse hasta partir su texto
            adentro de una píldora de alto fijo (AGENTS.md, responsividad). */}
        {notifications.some((n) => !n.readAt) && (
          <div className="shrink-0">
            <MarkAllReadButton />
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Sin notificaciones todavía.</p>
      ) : (
        <Card className="mt-8">
          {notifications.map((item) => (
            <NotificationItem key={item.id} item={item} />
          ))}
        </Card>
      )}
    </div>
  );
}
