import Image from "next/image";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { BrandingForm } from "@/components/configuracion/branding-form";
import { BrandMediaField } from "@/components/configuracion/brand-media-field";
import { HeroBackgroundMedia } from "@/components/layout/hero-background-media";
import { Card } from "@/components/ui/card";
import { DEFAULT_ACCENT } from "@/lib/color-contrast";

export default async function MarcaPage() {
  const [, organization] = await Promise.all([requireSuperAdmin(), getOrganization()]);

  const org = organization ?? {
    platform_name: "Demo AJE",
    accent_color: DEFAULT_ACCENT,
    logo_url: null,
    login_image_url: null,
    login_video_url: null,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[560px_1fr]">
      <Card as="section" className="p-6">
        <h2 className="font-extrabold tracking-heading text-2xl">Identidad visual</h2>
        <p className="mt-1 mb-6 text-[13px] leading-relaxed text-muted-foreground">
          Los cambios se aplican de inmediato para todos al guardar.
        </p>

        <div className="flex flex-col gap-5">
          <BrandMediaField field="logo_url" currentUrl={org.logo_url} />
          <BrandMediaField field="login_image_url" currentUrl={org.login_image_url} />
          <BrandMediaField field="login_video_url" currentUrl={org.login_video_url} />

          <div className="border-t border-border pt-5">
            {/* La portada y las leyendas de la bolsa ya no están acá: se
                fueron a /bolsa, que es una pantalla del módulo de
                Reclutamiento. Esta pantalla es la identidad de la plataforma
                y nada más. */}
            <BrandingForm
              key={`${org.platform_name}-${org.accent_color}`}
              platformName={org.platform_name}
              accentColor={org.accent_color}
            />
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Vista previa en vivo</p>
        <Card className="grid grid-cols-2" style={{ height: 340 }}>
          <div className="flex flex-col justify-center bg-background p-7">
            {/* El logo también acá, no solo en su campo: la vista previa es
                donde se confirma que lo que se acaba de subir se ve como uno
                esperaba, con el nombre al lado y al tamaño real del
                encabezado. Mismo respaldo que AppHeader (la inicial en un
                cuadro) para que la pantalla sin logo no mienta. */}
            <div className="flex items-center gap-2.5">
              {org.logo_url ? (
                <Image src={org.logo_url} alt="" width={24} height={24} className="shrink-0 object-contain" />
              ) : (
                <div className="flex size-6 flex-none items-center justify-center border border-foreground">
                  <span className="font-bold tracking-heading text-[15px] leading-none">{org.platform_name.charAt(0)}</span>
                </div>
              )}
              <span className="font-bold tracking-heading text-lg">{org.platform_name}</span>
            </div>
            <p className="mt-6 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Reclutamiento</p>
            <p className="font-extrabold tracking-heading mt-2 text-2xl leading-tight">Bienvenido de vuelta</p>
          </div>
          <div
            className="relative flex items-end p-7"
            style={{ backgroundColor: org.accent_color }}
          >
            <HeroBackgroundMedia videoUrl={org.login_video_url} imageUrl={org.login_image_url} />
            <p className="font-extrabold tracking-heading relative z-10 text-[19px] leading-snug text-accent-foreground">
              Contratar bien es la decisión más cara que toma una empresa.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-3.5 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
            Cómo se ven los componentes con este acento
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {/* El botón primario NO sigue al acento: usa el verde AJE fijo con
                tinta oscura (ver AGENTS.md). Pintarlo con el acento acá era
                prometer algo que la app no hace — y era justo la pantalla que
                existe para mostrar qué cambia este ajuste. */}
            <span className="inline-flex h-[38px] items-center rounded-full bg-primary px-4.5 text-[13px] font-medium text-primary-foreground">
              Botón primario (no cambia)
            </span>
            <span className="inline-flex h-[38px] items-center rounded-full border border-border bg-background px-4.5 text-[13px]">
              Secundario
            </span>
            <span
              className="inline-flex h-[26px] items-center rounded-sm border px-2.5 text-xs"
              style={{ borderColor: org.accent_color, color: org.accent_color }}
            >
              Etiqueta activa
            </span>
          </div>
        </Card>
      </section>
    </div>
  );
}
