export type MentionableProfile = { id: string; display_name: string };

export type ConectadosViewer = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  /** Para el avatar del compositor: quién está a punto de publicar. */
  displayName: string;
  avatarUrl: string | null;
  isAdminOrAbove: boolean;
  canPost: boolean;
};
