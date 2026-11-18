import { router } from './router.svelte';

/** History-state marker of an entry pushed by opening a detail panel. */
const PANEL_STATE = 'cvDetailPanel';

export interface DetailPanelState {
  /** Id in the query string (`?view=<id>`), or `null` when closed. */
  readonly id: string | null;
  open(id: string): void;
  close(): void;
}

/**
 * URL state of a list page's slide-in detail panel. Opening pushes a history
 * entry, so the panel can be linked and reloaded and the browser's Back
 * button closes it; switching to another record while it is open replaces
 * the entry instead of stacking them.
 *
 *   const panel = detailPanel();
 *   panel.open(commit.id);   // → ?view=<id>
 */
export function detailPanel(key = 'view'): DetailPanelState {
  return {
    get id() {
      return router.query.get(key) || null;
    },
    open(id: string) {
      const params = new URLSearchParams(window.location.search);
      params.set(key, id);
      const target = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      if (router.query.get(key) !== null) {
        // Already open: swap the record, keeping whether this entry is ours.
        router.navigate(target, { replace: true, keepScroll: true, state: window.history.state });
      } else {
        router.navigate(target, { keepScroll: true, state: { [PANEL_STATE]: true } });
      }
    },
    close() {
      // Undo our own history entry; a deep-linked panel just drops the key.
      const state = window.history.state as Record<string, unknown> | null;
      if (state?.[PANEL_STATE]) window.history.back();
      else router.setQuery({ [key]: null });
    },
  };
}

/**
 * Click handler for a link that opens a record in the panel. Modifier and
 * middle clicks keep the link's own behaviour (full page, new tab).
 */
export function openInPanel(panel: DetailPanelState, id: string) {
  return (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    panel.open(id);
  };
}
