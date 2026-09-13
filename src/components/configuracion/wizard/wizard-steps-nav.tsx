const STEPS = [
  { n: 1, label: "Detalles" },
  { n: 2, label: "Candidatura" },
  { n: 3, label: "Preguntas" },
  { n: 4, label: "Etapas" },
  { n: 5, label: "Permisos y usos" },
  { n: 6, label: "Cierre" },
];

/**
 * Solo lectura por ahora: el wizard es estrictamente secuencial (sin salto
 * libre), así que ningún paso salvo el actual y los ya completados es un
 * link — y hasta que existan los pasos 2-6 (Fase 18, siguientes entregas),
 * tampoco hay a dónde saltar.
 *
 * **Dos formas, un solo landmark.** Hasta `md:` no se pinta la columna de seis
 * pasos: apilada ocupaba toda la pantalla antes del primer campo, y su
 * contenedor de 192px fijos empujaba el formulario fuera del ancho. Ahí va el
 * contador con su barra de avance. Las dos ramas viven DENTRO del mismo
 * `<nav aria-label>` para que el landmark de navegación exista en los dos
 * tamaños; solo una está visible a la vez, así que un lector anuncia una sola.
 *
 * El resumen **no repite la etiqueta del paso**: el encabezado que va justo
 * abajo ya la dice ("Preguntas", "Etapas"), y decirla dos veces seguidas se lee
 * como un tartamudeo. Lo que ese encabezado no puede decir es cuántos faltan.
 */
export function WizardStepsNav({ current }: { current: number }) {
  // Acotado: un `current` fuera de rango pintaba "Paso 7 de 6" con la barra al
  // 117%, en silencio. El `isFinite` no es paranoia — el clamp solo no alcanza:
  // `Math.round(NaN)` es NaN, sobrevive a `min`/`max`, y `STEPS[NaN - 1].label`
  // de dos líneas abajo tira TypeError en pleno render. Un `Number(params.paso)`
  // de una ruta futura llega acá sin avisar.
  const paso = Number.isFinite(current) ? Math.min(Math.max(Math.round(current), 1), STEPS.length) : 1;
  const avance = (paso / STEPS.length) * 100;

  return (
    <nav aria-label="Pasos de la plantilla">
      {/* Teléfono y tableta angosta: en qué paso estoy y cuánto falta. */}
      <div className="md:hidden">
        <p className="text-[11px] tracking-[0.13em] tabular-nums text-muted-foreground uppercase">
          Paso {paso} de {STEPS.length}
        </p>
        <div
          role="progressbar"
          aria-valuenow={paso}
          // `aria-valuemin={0}` y no 1: el porcentaje que anuncia un lector es
          // (now − min) / (max − min), así que con min=1 el paso 1 se anunciaba
          // como 0% mientras la barra pintaba 17%. Con 0 los dos coinciden, y
          // el `aria-label` ya lleva el "Paso N de 6" en humano.
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-label={`Paso ${paso} de ${STEPS.length}: ${STEPS[paso - 1].label}`}
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
        >
          {/* `width` y no `transform`: es una barra estática que se pinta una
              vez por navegación, no una animación — no hay nada que
              interrumpir ni ningún cuadro que perder. */}
          <div className="h-full rounded-full bg-foreground" style={{ width: `${avance}%` }} />
        </div>
      </div>

      {/* Desde `md:`: la lista entera, al costado del formulario. */}
      <div className="hidden flex-col gap-1 md:flex">
        {STEPS.map((step) => {
          const state = step.n === paso ? "current" : step.n < paso ? "done" : "upcoming";
          return (
            <div key={step.n} className="flex items-center gap-3 py-2">
              <span
                aria-hidden
                className={`flex size-6 flex-none items-center justify-center rounded-full border text-[11px] tabular-nums ${
                  state === "current"
                    ? "border-foreground bg-foreground font-medium text-background"
                    : state === "done"
                      ? "border-accent text-accent"
                      : "border-border text-muted-foreground"
                }`}
              >
                {step.n}
              </span>
              <span
                className={`text-[13px] ${state === "current" ? "font-medium text-foreground" : "text-muted-foreground"}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
