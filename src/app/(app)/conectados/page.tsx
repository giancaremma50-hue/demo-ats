import { requireProfile } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { getProfilesForSelect } from "@/lib/departments/get-departments-admin";
import { getPosts, getDepartmentsForAudience, getOwnPostPermissions } from "@/lib/conectados/queries";
import { ConectadosFeed } from "@/components/conectados/conectados-feed";

export default async function ConectadosPage() {
  const profile = await requireProfile();
  const isAdminOrAbove = ADMIN_ROLES.has(profile.role);

  const [posts, departments, mentionable, ownPermissions] = await Promise.all([
    getPosts(),
    getDepartmentsForAudience(profile.organization_id),
    getProfilesForSelect(profile.organization_id),
    getOwnPostPermissions(profile.id),
  ]);

  const canPost = isAdminOrAbove || (ownPermissions?.can_post ?? false);

  return (
    // La columna y el título viven acá, en el servidor: el feed es cliente
    // solo por su estado (Realtime, composición), no por su layout. El
    // encabezado también le da nombre a la pantalla — sin él, entrar a
    // Conectados desde el selector de módulos dejaba una pantalla que
    // arrancaba directo en el cuadro de escribir, sin decir dónde estabas.
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="font-serif text-[32px] leading-tight">AJE Conectados</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lo que pasa en la empresa, en un solo lugar.</p>
      </header>
      <ConectadosFeed
        initialPosts={posts}
        viewer={{
          id: profile.id,
          organizationId: profile.organization_id,
          departmentId: profile.department_id,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          isAdminOrAbove,
          canPost,
        }}
        departments={departments}
        mentionable={mentionable.filter((m) => m.id !== profile.id)}
      />
    </div>
  );
}
