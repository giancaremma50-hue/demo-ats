import { requireProfile } from "@/lib/auth/dal";

export default async function ConectadosPage() {
  await requireProfile();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 pt-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-aje-orange/10 text-aje-orange">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="size-8"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          />
        </svg>
      </span>
      <h1 className="text-xl font-extrabold">AJE Conectados</h1>
      <p className="text-sm text-muted-foreground">
        El muro social interno está en construcción. Pronto vas a poder publicar, comentar y reaccionar acá mismo.
      </p>
    </div>
  );
}
