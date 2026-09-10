import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";

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
  if (authHeader !== `Bearer ${cronSecret}`) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: resumenRaw, error } = await admin.rpc("release_scheduled_posts", { p_dry_run: false });
  if (error) {
    console.error("[release-scheduled-posts] falló:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumen = (resumenRaw ?? {}) as Record<string, unknown>;
  const avisos = (Array.isArray(resumen.avisos) ? resumen.avisos : []) as AvisoPost[];

  for (const aviso of avisos) {
    await notify({
      organizationId: aviso.organization_id,
      recipientId: aviso.recipient_id,
      type: aviso.kind,
      title: aviso.kind === "post_mencion" ? "Te mencionaron en una publicación" : "Nueva publicación",
      body: aviso.preview,
      url: "/conectados",
    });
  }

  return NextResponse.json({ ok: true, liberados: resumen.liberados ?? 0, avisos: avisos.length });
}
