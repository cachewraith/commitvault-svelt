import type { AnyStatus, Tone } from '$lib/types';

export interface StatusPresentation {
  label: string;
  tone: Tone;
}

/** Single source of truth for how each status is worded and coloured. */
export const STATUS_PRESENTATION: Record<AnyStatus, StatusPresentation> = {
  // Deployments
  successful: { label: 'Successful', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  rolled_back: { label: 'Rolled back', tone: 'warning' },
  pending: { label: 'Pending', tone: 'info' },
  // Releases
  draft: { label: 'Draft', tone: 'neutral' },
  released: { label: 'Released', tone: 'success' },
  deprecated: { label: 'Deprecated', tone: 'warning' },
  // Projects
  active: { label: 'Active', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/** Tailwind classes per tone (text, tinted background, border, solid dot). */
export const TONE_CLASSES: Record<Tone, { badge: string; dot: string; text: string }> = {
  success: { badge: 'border-success/25 bg-success/10 text-success', dot: 'bg-success', text: 'text-success' },
  danger: { badge: 'border-danger/25 bg-danger/10 text-danger', dot: 'bg-danger', text: 'text-danger' },
  warning: { badge: 'border-warning/25 bg-warning/10 text-warning', dot: 'bg-warning', text: 'text-warning' },
  info: { badge: 'border-info/25 bg-info/10 text-info', dot: 'bg-info', text: 'text-info' },
  neutral: { badge: 'border-border bg-muted text-muted-foreground', dot: 'bg-neutral', text: 'text-muted-foreground' },
};

export function statusPresentation(status: string): StatusPresentation {
  return (
    STATUS_PRESENTATION[status as AnyStatus] ?? {
      label: status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  );
}
