import Image from "next/image";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { BrandingForm } from "@/components/configuracion/branding-form";
import { BrandImageField } from "@/components/configuracion/brand-image-field";
import { BrandVideoField } from "@/components/configuracion/brand-video-field";
import { HeroBackgroundMedia } from "@/components/layout/hero-background-media";
import { Card } from "@/components/ui/card";

export default async function MarcaPage() {
  const [, organization] = await Promise.all([requireSuperAdmin(), getOrganization()]);

  const org = organization ?? {
    platform_name: "Demo AJE",
    accent_color: "#1f4d3d",
    logo_url: null,
    login_image_url: null,
    login_video_url: null,
    careers_headline: null,
    careers_intro: null,
    careers_cover_image_url: null,
    careers_cover_video_url: null,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[560px_1fr]">
      <Card as="section" className="rounded-md p-6">
        <h2 className="font-serif text-2xl">Identidad visual</h2>
        <p className="mt-1 mb-6 text-[13px] leading-relaxed text-muted-foreground">
          Los cambios se aplican de inmediato para todos al guardar.
        </p>

        <div className="flex flex-col gap-5">
          <BrandImageField field="logo_url" currentUrl={org.logo_url} />
          <BrandImageField field="login_image_url" currentUrl={org.login_image_url} />
          <BrandVideoField field="login_video_url" currentUrl={org.login_video_url} />

          <div className="border-t border-border pt-5">
            <h3 className="font-serif text-lg">Bolsa de empleo pública</h3>
            <p className="mt-1 mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Foto o video de portada de /empleos — si subes un video, reemplaza a la foto.
            </p>
            <div className="flex flex-col gap-5">
              <BrandImageField field="careers_cover_image_url" currentUrl={org.careers_cover_image_url} />
              <BrandVideoField field="careers_cover_video_url" currentUrl={org.careers_cover_video_url} />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <BrandingForm
              key={`${org.platform_name}-${org.accent_color}-${org.careers_headline}-${org.careers_intro}`}
              platformName={org.platform_name}
              accentColor={org.accent_color}
              careersHeadline={org.careers_headline}
              careersIntro={org.careers_intro}
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
                  <span className="font-serif text-[15px] leading-none">{org.platform_name.charAt(0)}</span>
                </div>
              )}
              <span className="font-serif text-lg">{org.platform_name}</span>
            </div>
            <p className="mt-6 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Reclutamiento</p>
            <p className="font-serif mt-2 text-2xl leading-tight">Bienvenido de vuelta</p>
          </div>
          <div
            className="relative flex items-end p-7"
            style={{ backgroundColor: org.accent_color }}
          >
            <HeroBackgroundMedia videoUrl={org.login_video_url} imageUrl={org.login_image_url} />
            <p className="font-serif relative z-10 text-[19px] leading-snug text-white">
              Contratar bien es la decisión más cara que toma una empresa.
            </p>
          </div>
        </Card>

        <Card className="rounded-md p-5">
          <p className="mb-3.5 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
            Cómo se ven los componentes con este acento
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex h-[38px] items-center rounded-full px-4.5 text-[13px] font-medium text-white"
              style={{ backgroundColor: org.accent_color }}
            >
              Botón primario
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
