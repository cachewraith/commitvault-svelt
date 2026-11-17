/**
 * Autosave for the note editor.
 *
 * The editor holds the truth while it is open: local state is only ever sent
 * to the server, never overwritten by a response. Saves are serialised (one
 * request in flight at a time), so an earlier, slower response can never land
 * on top of a newer save, and each request carries only the fields that differ
 * from what the server last acknowledged.
 */
import type { RichTextDoc } from '$lib/types';
import { debounce, type Debounced } from '$lib/utils/debounce';
import type { UpdateNoteInput } from './types';
import { categoryError, titleError } from './validation';

/** Everything the editor can change. */
export interface NoteDraft {
  title: string;
  project_id: string | null;
  category: string;
  is_pinned: boolean;
  tag_ids: string[];
  content_json: RichTextDoc;
}

export type SaveStatus =
  /** Nothing to send. */
  | 'saved'
  /** Local changes are waiting for the debounce. */
  | 'dirty'
  | 'saving'
  /** The last request failed; the changes are still held locally. */
  | 'error'
  /** Local changes cannot be sent (e.g. empty title); autosave is paused. */
  | 'invalid';

const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const normaliseCategory = (category: string) => category.trim() || null;

/** The fields of `current` that differ from `base`, in API form. */
export function diffDraft(base: NoteDraft, current: NoteDraft): UpdateNoteInput {
  const patch: UpdateNoteInput = {};
  if (current.title.trim() !== base.title.trim()) patch.title = current.title.trim();
  if (current.project_id !== base.project_id) patch.project_id = current.project_id;
  if (normaliseCategory(current.category) !== normaliseCategory(base.category)) {
    patch.category = normaliseCategory(current.category);
  }
  if (current.is_pinned !== base.is_pinned) patch.is_pinned = current.is_pinned;
  if (!sameIds(current.tag_ids, base.tag_ids)) patch.tag_ids = [...current.tag_ids];
  // The editor emits a new object for every edit, so identity is a cheap and
  // sufficient "did the document change" check.
  if (current.content_json !== base.content_json) patch.content_json = current.content_json;
  return patch;
}

export const isEmptyPatch = (patch: UpdateNoteInput) => Object.keys(patch).length === 0;

export interface NoteAutosaveOptions<Result> {
  /** The state the server currently has. */
  baseline: NoteDraft;
  /** Reads the editor's current state. */
  read: () => NoteDraft;
  /** Sends the changed fields. */
  save: (patch: UpdateNoteInput) => Promise<Result>;
  /** Called after each successful save with the response and what was sent. */
  onsaved?: (result: Result, patch: UpdateNoteInput) => void;
  /** Debounce after the last change, in ms. */
  delay?: number;
}

export class NoteAutosave<Result = unknown> {
  status = $state<SaveStatus>('saved');
  /** When the last successful save completed. */
  savedAt = $state<Date | null>(null);
  /** The error of the last failed save. */
  error = $state.raw<unknown>(null);

  #baseline: NoteDraft;
  readonly #read: () => NoteDraft;
  readonly #save: (patch: UpdateNoteInput) => Promise<Result>;
  readonly #onsaved?: (result: Result, patch: UpdateNoteInput) => void;
  readonly #schedule: Debounced<[]>;
  #inFlight: Promise<void> | null = null;
  #disposed = false;

  constructor(options: NoteAutosaveOptions<Result>) {
    this.#baseline = { ...options.baseline, tag_ids: [...options.baseline.tag_ids] };
    this.#read = options.read;
    this.#save = options.save;
    this.#onsaved = options.onsaved;
    this.#schedule = debounce(() => void this.#run(), options.delay ?? 1000);
  }

  /** True while there is anything unsaved or a request is running. */
  get busy(): boolean {
    return this.status !== 'saved';
  }

  /** Call after every local change. */
  touch(): void {
    if (this.#disposed) return;
    const current = this.#read();
    if (isEmptyPatch(diffDraft(this.#baseline, current))) {
      this.#schedule.cancel();
      if (!this.#inFlight) {
        this.status = 'saved';
        this.error = null;
      }
      return;
    }
    if (!this.#isValid(current)) {
      // Never send a request the server would reject; wait for the user.
      this.#schedule.cancel();
      if (!this.#inFlight) this.status = 'invalid';
      return;
    }
    // Keep showing the failure (and its Retry button) until the next attempt starts.
    if (!this.#inFlight && this.status !== 'error') this.status = 'dirty';
    this.#schedule();
  }

  /** Save pending changes now (Ctrl/Cmd+S, "Done"). */
  flush(): Promise<void> {
    this.#schedule.cancel();
    return this.#run();
  }

  /**
   * Last-chance save when the editor is going away: fields that cannot be
   * saved (an emptied title) are left as they are on the server so the rest
   * of the work — above all the document — is not lost with them.
   */
  flushValid(): Promise<void> {
    this.#schedule.cancel();
    return this.#run(true);
  }

  /** Try the failed save again. */
  retry(): Promise<void> {
    return this.flush();
  }

  /** Stop timers. Does not save — call `flush()` first if needed. */
  dispose(): void {
    this.#disposed = true;
    this.#schedule.cancel();
  }

  #isValid(draft: NoteDraft): boolean {
    return titleError(draft.title) === null && categoryError(draft.category) === null;
  }

  #run(dropInvalid = false): Promise<void> {
    // One request at a time: when one is running, the changes made meanwhile
    // are picked up by the follow-up check at the end of that request.
    if (this.#inFlight) return this.#inFlight.then(() => this.#run(dropInvalid));

    const current = this.#read();
    const patch = diffDraft(this.#baseline, current);
    if (dropInvalid) {
      if (titleError(current.title) !== null) delete patch.title;
      if (categoryError(current.category) !== null) delete patch.category;
    } else if (!isEmptyPatch(patch) && !this.#isValid(current)) {
      this.status = 'invalid';
      return Promise.resolve();
    }
    if (isEmptyPatch(patch)) {
      if (!dropInvalid) {
        this.status = 'saved';
        this.error = null;
      }
      return Promise.resolve();
    }

    this.status = 'saving';
    this.#inFlight = this.#save(patch)
      .then((result) => {
        // The server now has exactly what was sent — not what it returned and
        // not what the user has typed since.
        const base = this.#baseline;
        this.#baseline = {
          title: patch.title ?? base.title,
          project_id: patch.project_id !== undefined ? patch.project_id : base.project_id,
          category: patch.category !== undefined ? (patch.category ?? '') : base.category,
          is_pinned: patch.is_pinned ?? base.is_pinned,
          tag_ids: patch.tag_ids ? [...patch.tag_ids] : base.tag_ids,
          content_json: patch.content_json ?? base.content_json,
        };
        this.savedAt = new Date();
        this.error = null;
        this.#inFlight = null;
        this.#onsaved?.(result, patch);
        this.status = 'saved';
        // Pick up edits made while the request was running.
        if (!this.#disposed) this.touch();
      })
      .catch((error: unknown) => {
        this.#inFlight = null;
        this.error = error;
        this.status = 'error';
      });
    return this.#inFlight;
  }
}
