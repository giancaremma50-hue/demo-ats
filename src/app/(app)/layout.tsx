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
    <div className="min-h-screen">
      <AppHeader
        organization={organization ?? { platform_name: "Demo AJE", logo_url: null }}
        profile={profile}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
      {/* pb calculado igual que el padding del propio FloatingNav (7rem +
          safe-area-inset-bottom) — con solo pb-28 el borde de la píldora en
          un iPhone con home indicator queda más alto que el aire reservado.

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
  );
}
