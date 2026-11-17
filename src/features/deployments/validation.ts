/**
 * Deployment record form rules. Limits mirror the backend
 * (`deployments/dto.rs`); the server remains the source of truth.
 */
import { z } from 'zod';
import { DEPLOYMENT_STATUSES } from '$lib/types';
import { optionalText, requiredText } from '$lib/validators';
import { localDateTime } from '$features/commits/validation';

export const deploymentFormSchema = z.object({
  project_id: z.string().min(1, 'Choose a project.'),
  environment_id: z.string().min(1, 'Choose an environment.'),
  commit_id: z.string().min(1, 'Choose a commit.'),
  deployment_title: requiredText('Title', 200),
  status: z.enum(DEPLOYMENT_STATUSES),
  deployed_at: localDateTime('Deployment time'),
  deployment_notes: optionalText('Notes', 20000),
  tag_ids: z.array(z.string()),
});

export type DeploymentFormData = z.output<typeof deploymentFormSchema>;

/** Suggested title once a commit and an environment are chosen. */
export function defaultDeploymentTitle(shortHash: string, environmentName: string): string {
  return `Deploy ${shortHash} to ${environmentName}`;
}
