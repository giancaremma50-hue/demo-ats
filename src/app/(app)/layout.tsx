import { MotionConfig } from "framer-motion";
import { requireProfile } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications/get-notifications";
import { AppHeader } from "@/components/layout/app-header";
import { FloatingNav } from "@/components/layout/floating-nav";
import { OnboardingTour } from "@/components/layout/onboarding-tour";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, organization, notifications, unreadCount] = await Promise.all([
    requireProfile(),
    getOrganization(),
    getRecentNotifications(),
    getUnreadCount(),
  ]);

  return (
    // framer-motion vive acá y no en el layout raíz: el único consumidor
    // real es FloatingNav, exclusivo de este layout — las rutas públicas
    // (/login, /empleos, /privacidad) no lo usan y no tienen por qué cargar
    // ni ejecutar el MotionConfig. Hallado en la auditoría de performance.
    // reducedMotion="user" respeta prefers-reduced-motion también para las
    // animaciones de framer-motion (transform/opacity vía WAAPI), que la
    // regla CSS de globals.css no puede alcanzar.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        <AppHeader
          organization={organization ?? { platform_name: "Demo AJE", logo_url: null }}
          profile={profile}
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
        />
        {/* El aire de abajo se reserva contra la barra flotante DESPLEGADA, que
            es su tamaño máximo: 10px de separación (`bottom-2.5`) + 56 de alto
            = 66px. El `pb-28` que pide AGENTS.md son 112, así que sobra.
            El término `env(safe-area-inset-bottom)` hoy vale 0 —la app no
            declara `viewport-fit=cover`, así que iOS ya recorta el viewport él
            mismo— y está para que la cuenta siga cerrando si algún día se
            declara: es el mismo término que respeta la barra. No se quita
            justamente por eso.

            Los gutters horizontales usan la misma escala que AppHeader
            (`px-4 sm:px-6 lg:px-10`): antes el main arrancaba en `px-6` fijo,
            así que en un teléfono el contenido quedaba 8px más adentro que el
            encabezado y cada pantalla perdía 16px de ancho útil — las "franjas"
            laterales que se ven en móvil. Ojo: la alineación exacta con el
            encabezado solo se da mientras el viewport sea más angosto que
            `max-w-6xl`; pasado eso el main se centra y el header sigue a lo
            ancho completo, que es lo buscado. */}
        <main className="mx-auto max-w-6xl px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10">
          {children}
        </main>
        <FloatingNav role={profile.role} />
        <OnboardingTour hasSeenTutorial={profile.has_seen_tutorial} />
      </div>
    </MotionConfig>
  );
}
