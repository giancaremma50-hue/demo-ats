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
    <ConectadosFeed
      initialPosts={posts}
      viewer={{
        id: profile.id,
        organizationId: profile.organization_id,
        departmentId: profile.department_id,
        isAdminOrAbove,
        canPost,
      }}
      departments={departments}
      mentionable={mentionable.filter((m) => m.id !== profile.id)}
    />
  );
}
