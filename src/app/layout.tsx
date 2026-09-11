import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getPublicOrganization } from "@/lib/organizations/get-organization";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Demo AJE",
  description: "Plataforma de reclutamiento y seguimiento de candidatos.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Esto es lo que realmente aplica el acento configurable en toda la app,
  // no solo en la vista previa del configurador. Cliente sin cookies a
  // propósito: `organizations` tiene una sola fila, RLS `using(true)` para
  // cualquiera (con o sin sesión) — el resultado es idéntico sin importar
  // quién pregunta, así que usar el cliente de sesión acá solo obligaba a
  // TODA página de la app (incluidas las públicas) a ser dinámica sin
  // ganar nada a cambio. getPublicOrganization() está memoizado con
  // cache() igual que el original.
  const organization = await getPublicOrganization();

  const accentStyle = organization
    ? ({ "--accent": organization.accent_color } as CSSProperties)
    : undefined;

  return (
    <html lang="es" style={accentStyle}>
      <body className={`${geist.variable} ${instrumentSerif.variable}`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
        {/* Sin esto no había forma de medir si la app se siente lenta o
            no — todo era "se siente lento" sin datos reales. Usa
            next/script por debajo, que recoge el nonce de CSP (`x-nonce`,
            ver src/lib/supabase/proxy.ts) automáticamente, sin plumbing
            manual. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
