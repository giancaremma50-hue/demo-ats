import { HeroBackgroundMedia } from "@/components/layout/hero-background-media";

/**
 * La portada de la bolsa de empleo, compartida entre la bolsa publicada
 * (`/empleos`) y su vista previa en `/bolsa`.
 *
 * Compartida y no copiada porque una vista previa que no replica el destino
 * real no sirve para lo único que existe: decidir si la portada que se acaba
 * de subir deja el título legible. Cuando el degradado y el respaldo del
 * título vivían escritos en los dos lados, bastaba oscurecer el héroe real
 * para que la vista previa siguiera aprobando portadas ilegibles.
 *
 * Las dos ramas también son del destino real: sin foto ni video, `/empleos`
 * no pinta un héroe oscuro sino un encabezado normal sobre el fondo de la
 * página. La vista previa tiene que mostrar eso mismo.
 */
const GRADIENTE = "linear-gradient(180deg, rgba(10,12,9,.15) 0%, rgba(10,12,9,.55) 62%, rgba(10,12,9,.88) 100%)";

export const CAREERS_HEADLINE_FALLBACK = "Vacantes abiertas";

export function CareersHero({
  headline,
  intro,
  imageUrl,
  videoUrl,
  accentColor,
  priority = false,
  sizes,
  /** `true` para la vista previa: la misma composición, a escala de tarjeta. */
  compact = false,
  children,
}: {
  headline: string | null;
  intro: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  accentColor: string;
  priority?: boolean;
  sizes?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const titulo = headline || CAREERS_HEADLINE_FALLBACK;
  const hasCover = Boolean(imageUrl || videoUrl);

  if (!hasCover) {
    return (
      <div className={compact ? "px-7 py-8" : "mx-auto max-w-4xl px-6 pt-16"}>
        <h1 className={compact ? "font-serif text-[26px] leading-tight" : "font-serif text-[40px]"}>{titulo}</h1>
        {intro && (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
            {intro}
          </p>
        )}
        {children}
      </div>
    );
  }

  return (
    <section
      className={`relative flex flex-col overflow-hidden text-background ${compact ? "min-h-[340px]" : "min-h-[72vh]"}`}
      style={{ backgroundColor: accentColor }}
    >
      {/* Fondo sólido del acento, siempre debajo — si solo hay video y el
          visitante pidió prefers-reduced-motion (sin imagen de respaldo),
          HeroBackgroundMedia no renderiza nada; sin este color de base el
          héroe quedaría vacío en vez de caer a un panel de marca sólido,
          mismo patrón que ya usa /login. */}
      <div className="absolute inset-0">
        <HeroBackgroundMedia videoUrl={videoUrl} imageUrl={imageUrl} priority={priority} sizes={sizes} />
        <div className="absolute inset-0" style={{ background: GRADIENTE }} />
      </div>
      <div
        className={`relative z-10 flex w-full flex-1 flex-col justify-end ${compact ? "p-7" : "mx-auto max-w-4xl px-6 pb-14"}`}
      >
        <h1
          className={
            compact
              ? "font-serif max-w-[16ch] text-[28px] leading-[1.08]"
              : "font-serif max-w-[16ch] text-[clamp(34px,5vw,56px)] leading-[1.08]"
          }
        >
          {titulo}
        </h1>
        {intro && (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-background/85">{intro}</p>
        )}
        {children}
      </div>
    </section>
  );
}
