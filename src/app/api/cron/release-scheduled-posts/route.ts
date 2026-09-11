import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";

// sha256 antes de comparar: timingSafeEqual exige buffers del mismo largo, y
// hashear primero evita tener que ramificar por longitud (esa rama sería en
// sí misma un canal lateral de tiempo, lo mismo que se cerró en /api/postular).
function secretMatches(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

interface AvisoPost {
  organization_id: string;
  recipient_id: string;
  preview: string;
  kind: "post_nuevo" | "post_mencion";
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new NextResponse("CRON_SECRET not configured", { status: 500 });
  if (!authHeader || !secretMatches(authHeader, `Bearer ${cronSecret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: resumenRaw, error } = await admin.rpc("release_scheduled_posts", { p_dry_run: false });
  if (error) {
    console.error("[release-scheduled-posts] falló:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumen = (resumenRaw ?? {}) as Record<string, unknown>;
  const avisos = (Array.isArray(resumen.avisos) ? resumen.avisos : []) as AvisoPost[];

  // allSettled, no un for...await: los posts ya quedaron liberados (el RPC
  // ya hizo commit) antes de este punto, así que un aviso que falla no puede
  // frenar a los demás ni perderse en silencio — se loguea cada fallo por
  // separado en vez de que uno corte el resto de la tanda.
  const results = await Promise.allSettled(
    avisos.map((aviso) =>
      notify({
        organizationId: aviso.organization_id,
        recipientId: aviso.recipient_id,
        type: aviso.kind,
        title: aviso.kind === "post_mencion" ? "Te mencionaron en una publicación" : "Nueva publicación",
        body: aviso.preview,
        url: "/conectados",
      }),
    ),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[release-scheduled-posts] falló el aviso para ${avisos[i].recipient_id}:`, result.reason);
    }
  });

  return NextResponse.json({ ok: true, liberados: resumen.liberados ?? 0, avisos: avisos.length });
}
