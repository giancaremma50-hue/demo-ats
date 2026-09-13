/** `<select>` con una opción por clave de un mapa de etiquetas (ej. WORK_MODE_LABEL) — evita repetir el Object.entries(...).map(...) en cada formulario que usa el mismo enum. */
export function LabelSelect({
  name,
  labels,
  defaultValue,
  className,
  ...props
}: {
  name: string;
  labels: Record<string, string>;
  defaultValue?: string;
  className?: string;
  // El resto pasa derecho al `<select>`. **`...props` no es opcional acá**:
  // `<Field>` le inyecta `id`, `aria-invalid` y `aria-describedby` por
  // `cloneElement`, y con una lista cerrada de props se los tragaba en
  // silencio — el campo quedaba con el borde rojo y el mensaje al lado, pero
  // sin nada que los atara para un lector de pantalla.
} & Omit<React.ComponentPropsWithoutRef<"select">, "name" | "defaultValue" | "className" | "children">) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={className} {...props}>
      <option value="" disabled>
        Elige una opción
      </option>
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
