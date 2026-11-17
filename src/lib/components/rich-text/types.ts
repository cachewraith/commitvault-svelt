import type { RichTextDoc } from '$lib/types';

export interface RichTextEditorProps {
  /**
   * Tiptap JSON document (`{ type: 'doc', content: [...] }`). Hold it in
   * `$state.raw` in the parent; pass `null`/`undefined` for an empty document.
   */
  value?: RichTextDoc | null;
  /** Called with the new document after every edit. */
  onchange?: (doc: RichTextDoc) => void;
  placeholder?: string;
  /** Read-only + dimmed; the toolbar is disabled. */
  disabled?: boolean;
  /** Accessible name of the editing surface. */
  label?: string;
  /** Focus the editor when it mounts. */
  autofocus?: boolean;
  /** Minimum height of the editing surface (CSS length). */
  minHeight?: string;
  /** Marks the surface invalid (validation error). */
  invalid?: boolean;
  /** id of the element describing the editor (error/hint text). */
  describedBy?: string;
  class?: string;
}

export interface RichTextViewerProps {
  /** Tiptap JSON document to render read-only. */
  value?: RichTextDoc | null;
  /** Shown when the document is empty. */
  emptyText?: string;
  class?: string;
}
