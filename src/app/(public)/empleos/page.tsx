import { createPublicClient } from "@/lib/supabase/public";
import { getPublicOrganization } from "@/lib/organizations/get-organization";
import { JobsBoard, type FilterOption } from "@/components/empleos/jobs-board";
import { CareersHero } from "@/components/empleos/careers-hero";
import { WORK_MODE_LABEL } from "@/lib/jobs/schema";
import type { WorkMode } from "@/lib/jobs/schema";
import { Card } from "@/components/ui/card";

// Portal público de solo lectura, sin sesión — cachear 60s evita que cada
// visita (antes incluso de postular) le pegue en vivo a Postgres. El nonce
// de CSP por request (src/proxy.ts) NO bloquea esto — el middleware puede
// decorar una respuesta ya cacheada con un header nuevo en cada request sin
// romper el caché de la página. Lo que sí lo bloqueaba: el layout RAÍZ
// (src/app/layout.tsx) llamaba al cliente de sesión (cookies()) para el
// acento de marca — eso forzaba dinámico a TODO el sitio, /empleos incluido.
// Corregido usando createPublicClient() ahí también (organizations tiene
// una sola fila, RLS pública para cualquiera — mismo resultado sin sesión).
export const revalidate = 60;

type JobRow = {
  id: string;
  slug: string | null;
  title: string;
  country: string | null;
  location: string | null;
  work_mode: string | null;
  department_id: string | null;
  departments: { name: string } | null;
};

function distinctOptions(values: (string | null)[], labelFor: (v: string) => string): FilterOption[] {
  const unique = [...new Set(values.filter((v): v is string => Boolean(v)))];
  return unique.map((value) => ({ value, label: labelFor(value) })).sort((a, b) => a.label.localeCompare(b.label));
}

export default async function EmpleosPage() {
  const supabase = createPublicClient();
  const [{ data: jobsData }, organization] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, slug, title, country, location, work_mode, department_id, departments(name)")
      .eq("status", "abierta")
      .eq("visibility", "publica")
      .order("published_at", { ascending: false }),
    getPublicOrganization(),
  ]);

  const allJobs = (jobsData ?? []) as JobRow[];

  const countryOptions = distinctOptions(
    allJobs.map((j) => j.country),
    (v) => v,
  );
  const workModeOptions = distinctOptions(
    allJobs.map((j) => j.work_mode),
    (v) => WORK_MODE_LABEL[v as WorkMode] ?? v,
  );
  // dedupe por id, no por nombre — dos departamentos distintos podrían compartir nombre.
  const departmentMap = new Map<string, string>();
  for (const j of allJobs) {
    if (j.department_id && j.departments?.name) departmentMap.set(j.department_id, j.departments.name);
  }
  const departmentOptions: FilterOption[] = [...departmentMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasCover = Boolean(organization?.careers_cover_image_url || organization?.careers_cover_video_url);

  const stats: { n: number; label: string }[] = [];
  if (allJobs.length > 0) stats.push({ n: allJobs.length, label: allJobs.length === 1 ? "vacante abierta" : "vacantes abiertas" });
  if (countryOptions.length > 1) stats.push({ n: countryOptions.length, label: "países" });
  if (departmentOptions.length > 1) stats.push({ n: departmentOptions.length, label: "áreas contratando" });

  return (
    <div>
      {/* La portada la pinta `CareersHero`, el MISMO componente que usa la
          vista previa de /bolsa: si el degradado o el respaldo del título
          vivieran escritos en los dos lados, oscurecer este héroe dejaría a
          la vista previa aprobando portadas que acá quedan ilegibles. Las
          cifras y el botón van como `children` porque son de esta pantalla,
          no de la portada. */}
      <CareersHero
        headline={organization?.careers_headline ?? null}
        intro={organization?.careers_intro ?? null}
        imageUrl={organization?.careers_cover_image_url ?? null}
        videoUrl={organization?.careers_cover_video_url ?? null}
        accentColor={organization?.accent_color || "#1f4d3d"}
        priority
      >
        {hasCover && allJobs.length > 0 && (
          <a
            href="#vacantes"
            className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground"
          >
            Ver vacantes abiertas
          </a>
        )}
        {stats.length > 0 &&
          (hasCover ? (
            <div className="mt-8 flex border-t border-background/25">
              {stats.map((s) => (
                <div key={s.label} className="flex-1 border-r border-background/25 pt-4 pr-5 last:border-r-0" data-numeric>
                  <span className="font-serif block text-[26px] leading-none">{s.n}</span>
                  <span className="mt-1.5 block text-[11.5px] text-background/70">{s.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <Card className="mt-8 flex rounded-md">
              {stats.map((s) => (
                <div key={s.label} className="flex-1 border-r border-border p-4 last:border-r-0" data-numeric>
                  <span className="font-serif block text-2xl leading-none">{s.n}</span>
                  <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </Card>
          ))}
      </CareersHero>

      <div id="vacantes" className="mx-auto max-w-4xl scroll-mt-6 px-6 py-14">
        {allJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay vacantes abiertas por ahora. Vuelve a revisar pronto.</p>
        ) : (
          <JobsBoard
            jobs={allJobs.map((job) => ({
              id: job.id,
              slug: job.slug,
              title: job.title,
              country: job.country,
              location: job.location,
              work_mode: job.work_mode,
              department_id: job.department_id,
              department_name: job.departments?.name ?? null,
            }))}
            countries={countryOptions}
            workModes={workModeOptions}
            departments={departmentOptions}
          />
        )}
      </div>
    </div>
  );
}
