import { requireAdminOrAbove } from "@/lib/auth/dal";
import { ConfigTabs } from "@/components/configuracion/config-tabs";

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminOrAbove();

  return (
    <div>
      {/* **"Ajustes", no "Configuración"**: es el nombre con el que el menú
          nombra esta pantalla (`SETTINGS_ITEM`), y la regla 11 de AGENTS.md pide
          que el `h1` empiece por ese nombre — en un teléfono la barra dice
          "Ajustes" y llegar a un título distinto no confirma que hayas llegado
          a donde tocaste.
          Sin escalón chico: "Configuración" medía ~289px a 38px contra los 288
          útiles de un teléfono de 320 y por eso lo llevaba; "Ajustes" mide la
          mitad, y encogerlo sería achicar un título por una medición muerta. */}
      <h1 className="font-black tracking-display text-[38px] leading-tight">Ajustes</h1>
      <div className="mt-5 mb-7">
        <ConfigTabs role={profile.role} />
      </div>
      {children}
    </div>
  );
}
