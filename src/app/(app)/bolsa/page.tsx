import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { BrandMediaField } from "@/components/configuracion/brand-media-field";
import { CareersForm } from "@/components/bolsa/careers-form";
import { CareersHero } from "@/components/empleos/careers-hero";
import { Card } from "@/components/ui/card";

/**
 * La bolsa de empleo pública, como pantalla propia del módulo de
 * Reclutamiento y no como una sección perdida dentro del configurador
 * general (pedido del usuario, 2026-09-11): configurar la portada y las
 * leyendas de /empleos es operación de reclutamiento.
 *
 * Sigue siendo de super admin, igual que la marca: los archivos van al mismo
 * bucket `marca-publico`, cuyas políticas de Storage son de super admin.
 * Ofrecérsela a un `admin` sería un botón que lleva a una pantalla donde no
 * puede guardar nada.
 */
export default async function BolsaPage() {
  const [, organization] = await Promise.all([requireSuperAdmin(), getOrganization()]);

  const org = organization ?? {
    accent_color: "#1f4d3d",
    careers_headline: null,
    careers_intro: null,
    careers_cover_image_url: null,
    careers_cover_video_url: null,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[38px] leading-tight">Bolsa de empleo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo que ve quien entra a la bolsa pública, antes de postularse.
          </p>
        </div>
        <Link
          href="/empleos"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-[38px] items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-medium"
        >
          Ver la bolsa publicada
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[560px_1fr]">
        <Card as="section" className="rounded-md p-6">
          <h2 className="font-serif text-2xl">Portada</h2>
          <p className="mt-1 mb-6 text-[13px] leading-relaxed text-muted-foreground">
            Si subes un video, reemplaza a la foto. Los cambios se aplican de inmediato.
          </p>

          <div className="flex flex-col gap-5">
            <BrandMediaField field="careers_cover_image_url" currentUrl={org.careers_cover_image_url} />
            <BrandMediaField field="careers_cover_video_url" currentUrl={org.careers_cover_video_url} />
          </div>

          <div className="mt-7 border-t border-border pt-6">
            <h2 className="font-serif text-2xl">Bienvenida</h2>
            <p className="mt-1 mb-6 text-[13px] leading-relaxed text-muted-foreground">
              El título y el texto que acompañan a la portada.
            </p>
            <CareersForm
              key={`${org.careers_headline}-${org.careers_intro}`}
              careersHeadline={org.careers_headline}
              careersIntro={org.careers_intro}
            />
          </div>
        </Card>

        <section className="flex flex-col gap-4">
          <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Vista previa en vivo</p>
          {/* El MISMO componente que pinta la bolsa publicada, a escala de
              tarjeta: si la portada no está subida todavía, acá se ve el
              encabezado simple que /empleos realmente muestra, no un héroe
              oscuro que nadie va a ver. `sizes` propio para no bajar la
              variante de 2560px en una tarjeta de ~560px. */}
          <Card className="overflow-hidden">
            <CareersHero
              headline={org.careers_headline}
              intro={org.careers_intro}
              imageUrl={org.careers_cover_image_url}
              videoUrl={org.careers_cover_video_url}
              accentColor={org.accent_color}
              sizes="(max-width: 1024px) 100vw, 560px"
              compact
            />
          </Card>
        </section>
      </div>
    </div>
  );
}
