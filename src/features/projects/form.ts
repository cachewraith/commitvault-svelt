import type { Project } from './types';

/** Raw (string) values of the project form, as typed by the user. */
export interface ProjectFormValues {
  name: string;
  slug: string;
  description: string;
  repository_url: string;
  default_branch: string;
  tag_ids: string[];
}

export function projectFormValues(project?: Project): ProjectFormValues {
  return {
    name: project?.name ?? '',
    slug: project?.slug ?? '',
    description: project?.description ?? '',
    repository_url: project?.repository_url ?? '',
    default_branch: project?.default_branch ?? 'main',
    tag_ids: project?.tags.map((tag) => tag.id) ?? [],
  };
}
