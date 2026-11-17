/**
 * Hand-written domain primitives shared across features. Resource shapes
 * (Project, Commit, …) are generated from the backend's OpenAPI document into
 * `$lib/api/schema.d.ts` — do not duplicate them here.
 */

export const DEPLOYMENT_STATUSES = ['successful', 'failed', 'rolled_back', 'pending'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const RELEASE_STATUSES = ['draft', 'released', 'deprecated'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type AnyStatus = DeploymentStatus | ReleaseStatus | ProjectStatus;

/** Semantic tone → colour token (`success`, `danger`, …). */
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/** Tiptap/ProseMirror JSON document as stored in PostgreSQL JSONB. */
export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
}

export interface RichTextDoc extends RichTextNode {
  type: 'doc';
  content?: RichTextNode[];
}

export const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
