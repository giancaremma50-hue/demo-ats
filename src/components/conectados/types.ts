export type MentionableProfile = { id: string; display_name: string };

export type ConectadosViewer = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  isAdminOrAbove: boolean;
  canPost: boolean;
};
