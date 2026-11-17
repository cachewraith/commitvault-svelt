/**
 * Shared, feature-agnostic components. Import from `$lib/components`.
 * Raw shadcn-svelte primitives live in `$lib/components/ui/<name>`.
 */
export { default as PageHeader } from './PageHeader.svelte';
export type { Breadcrumb } from './PageHeader.svelte';
export { default as EmptyState } from './EmptyState.svelte';
export { default as ErrorState } from './ErrorState.svelte';
export { default as Pagination } from './Pagination.svelte';
export { default as SearchInput } from './SearchInput.svelte';
export { default as FormField } from './FormField.svelte';
export type { FieldControlProps } from './FormField.svelte';
export { default as FilterBar } from './FilterBar.svelte';
export { default as DateRangeFilter } from './DateRangeFilter.svelte';
export type { DateRange } from './DateRangeFilter.svelte';
export { default as Combobox } from './Combobox.svelte';
export { default as MultiCombobox } from './MultiCombobox.svelte';
export type { ComboboxOption } from './combobox';

export { default as StatusBadge } from './StatusBadge.svelte';
export { STATUS_PRESENTATION, TONE_CLASSES, statusPresentation } from './status';
export { default as HashChip } from './HashChip.svelte';
export { default as BranchBadge } from './BranchBadge.svelte';
export { default as EnvironmentBadge } from './EnvironmentBadge.svelte';
export { default as TagBadge } from './TagBadge.svelte';
export { default as DateTime } from './DateTime.svelte';
export { default as CopyButton } from './CopyButton.svelte';

export { default as RichTextEditor } from './RichTextEditor.svelte';
export { default as RichTextViewer } from './RichTextViewer.svelte';
export { docToPlainText, isEmptyDoc, sanitizeDoc, toDoc } from './rich-text/doc';

export * from './skeletons';
export * from './data-table';
export * from './timeline';
export { confirm, ConfirmDialogHost } from './confirm';
export type { ConfirmOptions } from './confirm';
export { toast, toastError } from './toast';
